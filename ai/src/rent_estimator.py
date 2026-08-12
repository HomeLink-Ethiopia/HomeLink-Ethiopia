"""Rent estimation module for the HomeLink AI Engine.

Two operating modes are supported:

1. **ML-backed** — when a trained pipeline exists at
   ``ai/models/rent_estimator.joblib`` it is loaded and used for
   predictions (higher confidence score).

2. **Heuristic baseline** — a deterministic, rule-based fallback that
   guarantees the service works out of the box with no trained model.

Training contract
-----------------
Any trained model must be a scikit-learn ``Pipeline`` whose ``predict``
accepts a 2-D array with columns, in order::

    ["area_sqm", "bedrooms", "bathrooms", "has_water_tank"]

``subcity`` is intentionally excluded from the numeric feature vector
here (the fallback applies per-subcity coefficients instead). If a
future pipeline encodes ``subcity`` as one-hot columns, they should be
appended *after* the numeric columns above and the training pipeline
kept as the single source of truth for feature layout. A reference
training notebook lives in ``ai/notebooks/``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & feature layout
# ---------------------------------------------------------------------------

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
RENT_MODEL_PATH = MODELS_DIR / "rent_estimator.joblib"

#: Canonical order of the numeric feature columns a trained model expects.
MODEL_FEATURE_COLUMNS: List[str] = [
    "area_sqm",
    "bedrooms",
    "bathrooms",
    "has_water_tank",
]

# ---------------------------------------------------------------------------
# Heuristic baseline coefficients
# ---------------------------------------------------------------------------

#: Average monthly rent (ETB) per square metre per Addis Ababa subcity.
SUBCITY_BASE_RATE: Dict[str, float] = {
    "bole": 320.0,
    "arada": 300.0,
    "kirkos": 290.0,
    "yeka": 260.0,
    "gullele": 240.0,
    "kolfe keranio": 230.0,
    "nifas silk-lafto": 225.0,
    "lideta": 220.0,
    "addis ketema": 210.0,
    "akaky kaliti": 190.0,
}
DEFAULT_SUBCITY_RATE = 250.0

#: Fixed monthly premium (ETB) per additional bedroom / bathroom.
BEDROOM_COEF = 2500.0
BATHROOM_COEF = 1500.0

#: Monthly premium (ETB) for a private water tank.
WATER_TANK_BONUS = 1800.0

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
    ) -> RentPrediction:
        """Predict the monthly rent in ETB for a property.

        Args:
            subcity: Addis Ababa subcity, e.g. ``"Bole"``.
            bedrooms: Number of bedrooms.
            bathrooms: Number of bathrooms.
            area_sqm: Floor area in square metres.
            has_water_tank: Whether the unit has a private water tank.

        Returns:
            A :class:`RentPrediction` with the estimate and confidence.
        """
        if self._model is not None:
            try:
                feature_vector = self._build_feature_vector(
                    bedrooms=bedrooms,
                    bathrooms=bathrooms,
                    area_sqm=area_sqm,
                    has_water_tank=has_water_tank,
                )
                estimated = float(np.asarray(self._model.predict(feature_vector)).ravel()[0])
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
        """Attempt to load the trained ``.joblib`` pipeline, if present."""
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

    def _build_feature_vector(
        self,
        bedrooms: int,
        bathrooms: int,
        area_sqm: float,
        has_water_tank: bool,
    ) -> np.ndarray:
        """Build the numeric feature row expected by a trained model."""
        return np.array(
            [[float(area_sqm), float(bedrooms), float(bathrooms), float(has_water_tank)]],
            dtype=np.float64,
        )

    def _heuristic_estimate(
        self,
        subcity: str,
        bedrooms: int,
        bathrooms: int,
        area_sqm: float,
        has_water_tank: bool,
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
        return max(estimate, 0.0)
