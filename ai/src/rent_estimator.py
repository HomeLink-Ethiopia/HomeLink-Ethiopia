"""Rent estimation module for the HomeLink AI Engine.

Two operating modes are supported:

1. **ML-backed** — when a trained pipeline exists at
   ``ai/models/rent_model.joblib`` it is loaded and used for
   predictions (higher confidence score).

   Two model formats are supported automatically:

   * **Pipeline model** (legacy): a scikit-learn ``Pipeline`` that
     accepts a DataFrame with a raw ``subcity`` string column and
     performs one-hot encoding internally.

   * **Encoded model** (current): a plain ``RandomForestRegressor``
     trained on pre-encoded one-hot ``subcity_*`` columns.  The
     feature column list is read from ``rent_model_metrics.json``.

2. **Heuristic baseline** — a deterministic, rule-based fallback that
   guarantees the service works out of the box with no trained model.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & feature layout
# ---------------------------------------------------------------------------

AI_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = AI_DIR / "models"
DATA_DIR = AI_DIR / "data"
RENT_MODEL_PATH = MODELS_DIR / "rent_model.joblib"
METRICS_PATH = MODELS_DIR / "rent_model_metrics.json"
DATA_PATH = DATA_DIR / "ethiopia_housing_data.csv"

#: Canonical feature columns a trained Pipeline model expects (order matters).
#: Used only for the legacy Pipeline format.
MODEL_FEATURE_COLUMNS: List[str] = [
    "subcity",
    "bedrooms",
    "bathrooms",
    "area_sqm",
    "has_water_tank",
    "has_generator",
    "is_furnished",
]

#: Known Addis Ababa subcity names (lowercase, matching training encoding).
KNOWN_SUBCITIES: List[str] = [
    "addis ketema",
    "akaky kaliti",
    "arada",
    "bole",
    "gulele",
    "kirkos",
    "kolfe",
    "lidetta",
    "nifas silk",
    "yeka",
]

#: Numeric (tree-friendly, passed through) and categorical feature sets.
NUMERIC_FEATURE_COLUMNS: List[str] = [
    "bedrooms",
    "bathrooms",
    "area_sqm",
    "has_water_tank",
    "has_generator",
    "is_furnished",
]
CATEGORICAL_FEATURE_COLUMNS: List[str] = ["subcity"]

#: Target column name used by the training script.
TARGET_COLUMN = "rent_price_etb"

# ---------------------------------------------------------------------------
# Heuristic baseline coefficients (aligned with generate_dataset.py)
# ---------------------------------------------------------------------------

#: Average monthly rent (ETB) per square metre per Addis Ababa subcity.
SUBCITY_BASE_RATE: Dict[str, float] = {
    "bole": 340.0,
    "kirkos": 320.0,
    "arada": 300.0,
    "yeka": 265.0,
    "nifas silk": 240.0,
    "nifas silk-lafto": 240.0,  # alias
    "gulele": 225.0,
    "gullele": 225.0,  # alias
    "kolfe": 215.0,
    "kolfe keranio": 215.0,  # alias
    "lidetta": 210.0,
    "lideta": 210.0,  # alias
    "addis ketema": 205.0,
    "akaky kaliti": 190.0,
}
DEFAULT_SUBCITY_RATE = 250.0

#: Fixed monthly premium (ETB) per additional bedroom / bathroom.
BEDROOM_COEF = 2200.0
BATHROOM_COEF = 1200.0

#: Monthly premium (ETB) for a private water tank / generator.
WATER_TANK_BONUS = 1800.0
GENERATOR_PREMIUM = 2600.0

#: Multiplicative uplift applied to furnished units.
FURNISHED_MULTIPLIER = 1.15

#: Confidence of the heuristic fallback vs. a trained model.
HEURISTIC_CONFIDENCE = 0.58
ML_CONFIDENCE = 0.92


@dataclass(frozen=True)
class RentPrediction:
    """Result of a rent estimation call."""

    estimated_rent_etb: float
    confidence: float
    using_model: bool
    model_name: str
    feature_columns: Optional[List[str]] = field(
        default_factory=lambda: list(MODEL_FEATURE_COLUMNS)
    )


class RentEstimator:
    """Estimates monthly rent in ETB for a residential property."""

    def __init__(self, model_path: Path = RENT_MODEL_PATH) -> None:
        """Initialize the estimator and attempt to load a trained model.

        Args:
            model_path: Path to a ``.joblib`` pipeline, if available.
        """
        self._model_path = model_path
        self._model = None  # type: Optional[object]
        self._load_model()

    # -- public API ---------------------------------------------------------

    def predict(
        self,
        subcity: str,
        bedrooms: int,
        bathrooms: int,
        area_sqm: float,
        has_water_tank: bool,
        has_generator: bool = False,
        is_furnished: bool = False,
    ) -> RentPrediction:
        """Predict the monthly rent in ETB for a property.

        Args:
            subcity: Addis Ababa subcity, e.g. ``"Bole"``.
            bedrooms: Number of bedrooms.
            bathrooms: Number of bathrooms.
            area_sqm: Floor area in square metres.
            has_water_tank: Whether the unit has a private water tank.
            has_generator: Whether the unit has a backup generator.
            is_furnished: Whether the unit is rented furnished.

        Returns:
            A :class:`RentPrediction` with the estimate and confidence.
        """
        if self._model is not None:
            try:
                feature_row = self._build_feature_row(
                    subcity=subcity,
                    bedrooms=bedrooms,
                    bathrooms=bathrooms,
                    area_sqm=area_sqm,
                    has_water_tank=has_water_tank,
                    has_generator=has_generator,
                    is_furnished=is_furnished,
                )
                estimated = float(self._model.predict(feature_row).ravel()[0])
                return RentPrediction(
                    estimated_rent_etb=round(estimated, 2),
                    confidence=ML_CONFIDENCE,
                    using_model=True,
                    model_name=self._model_path.name,
                )
            except Exception as exc:  # noqa: BLE001 - degrade gracefully
                logger.warning("ML rent prediction failed (%s); using heuristic.", exc)

        estimated = self._heuristic_estimate(
            subcity=subcity,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            area_sqm=area_sqm,
            has_water_tank=has_water_tank,
            has_generator=has_generator,
            is_furnished=is_furnished,
        )
        return RentPrediction(
            estimated_rent_etb=round(estimated, 2),
            confidence=HEURISTIC_CONFIDENCE,
            using_model=False,
            model_name="heuristic-baseline",
        )

    def model_loaded(self) -> bool:
        """Return whether a trained model is currently in use."""
        return self._model is not None

    # -- internals ----------------------------------------------------------

    def _load_model(self) -> None:
        """Attempt to load the trained ``.joblib`` model, if present.

        Also reads ``rent_model_metrics.json`` to detect whether the saved
        artifact is a pre-encoded (one-hot) model or a legacy Pipeline.
        """
        try:
            import joblib
        except ImportError:  # pragma: no cover - joblib ships with sklearn
            logger.warning("joblib unavailable; using heuristic baseline.")
            return

        if not self._model_path.exists():
            logger.info("No trained rent model at %s; using heuristic baseline.", self._model_path)
            return

        try:
            self._model = joblib.load(self._model_path)
            logger.info("Loaded rent estimator model from %s", self._model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load rent model (%s); using heuristic baseline.", exc)
            self._model = None
            return

        # Detect model format: encoded (plain RF) vs. legacy Pipeline.
        # The metrics JSON written by train_rent_model.py contains
        # ``feature_columns`` only when the encoded format was used.
        self._encoded_feature_cols: Optional[List[str]] = None
        try:
            if METRICS_PATH.exists():
                metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
                cols = metrics.get("feature_columns")
                if cols and any(c.startswith("subcity_") for c in cols):
                    self._encoded_feature_cols = cols
                    logger.info(
                        "Detected encoded model format with %d feature columns.",
                        len(cols),
                    )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not read metrics JSON (%s); assuming legacy Pipeline.", exc)

    def _build_feature_row(
        self,
        subcity: str,
        bedrooms: int,
        bathrooms: int,
        area_sqm: float,
        has_water_tank: bool,
        has_generator: bool,
        is_furnished: bool,
    ) -> pd.DataFrame:
        """Build a single-row DataFrame matching the training feature layout.

        Automatically handles both model formats:

        * **Encoded model** — produces one-hot ``subcity_*`` columns that
          match the columns the model was trained on.
        * **Legacy Pipeline** — passes the raw ``subcity`` string so the
          pipeline's internal encoder handles it.
        """
        subcity_norm = subcity.strip().lower()

        if self._encoded_feature_cols:
            # Build one-hot encoded row matching the exact training columns.
            row: Dict[str, object] = {
                "bedrooms": int(bedrooms),
                "bathrooms": int(bathrooms),
                "area_sqm": float(area_sqm),
            }
            for col in self._encoded_feature_cols:
                if col.startswith("subcity_"):
                    row[col] = 1 if col == f"subcity_{subcity_norm}" else 0
            # Return in the exact column order the model was trained on.
            return pd.DataFrame([row], columns=self._encoded_feature_cols)

        # Legacy Pipeline format — raw subcity string.
        return pd.DataFrame(
            [
                {
                    "subcity": subcity_norm,
                    "bedrooms": int(bedrooms),
                    "bathrooms": int(bathrooms),
                    "area_sqm": float(area_sqm),
                    "has_water_tank": int(bool(has_water_tank)),
                    "has_generator": int(bool(has_generator)),
                    "is_furnished": int(bool(is_furnished)),
                }
            ],
            columns=MODEL_FEATURE_COLUMNS,
        )

    def _heuristic_estimate(
        self,
        subcity: str,
        bedrooms: int,
        bathrooms: int,
        area_sqm: float,
        has_water_tank: bool,
        has_generator: bool,
        is_furnished: bool,
    ) -> float:
        """Compute a deterministic baseline rent estimate in ETB."""
        rate = SUBCITY_BASE_RATE.get(subcity.strip().lower(), DEFAULT_SUBCITY_RATE)
        estimate = (
            rate * float(area_sqm)
            + int(bedrooms) * BEDROOM_COEF
            + int(bathrooms) * BATHROOM_COEF
        )
        if has_water_tank:
            estimate += WATER_TANK_BONUS
        if has_generator:
            estimate += GENERATOR_PREMIUM
        if is_furnished:
            estimate *= 1.0 + FURNISHED_MULTIPLIER
        return max(estimate, 0.0)
