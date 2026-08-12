"""Property recommendation module for the HomeLink AI Engine.

Recommendations are computed against a listing catalog. The catalog is
loaded from ``ai/models/catalog.json`` when present (produced by the
backend data pipeline), otherwise a small built-in demo catalog is used
so the service is runnable end to end.

Matching logic
--------------
When a trained pipeline exists (``ai/models/recommender_pipeline.joblib``)
listings are embedded with a ``ColumnTransformer`` — ``StandardScaler``
for numerical features (price, area, bedrooms, bathrooms) and
``OneHotEncoder`` for subcity — and ranked by **cosine similarity**
between the tenant's query preference vector and each catalog vector,
combined with explainable budget/value components (total 0 - 100):

- **Vector-space similarity** (40 pts): cosine similarity between the
  query vector (85% of the tenant's budget as target price, preferred
  subcity) and the listing embedding.
- **Budget fit** (40 pts): share of the budget the price consumes.
- **Value / quality** (20 pts): price relative to the most expensive
  affordable listing.

Without a trained pipeline a transparent rule-based fallback (subcity
match + budget fit + value) is used so the service always responds.

Indexing contract
-----------------
``ai/src/train_recommender.py`` fits the vectorizer on the active
catalog and saves the fitted ``ColumnTransformer`` plus catalog vectors
to ``ai/models/recommender_pipeline.joblib``. Re-run it whenever
``catalog.json`` changes.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
CATALOG_PATH = MODELS_DIR / "catalog.json"
RECOMMENDER_PIPELINE_PATH = MODELS_DIR / "recommender_pipeline.joblib"

#: Default number of recommendations to return.
DEFAULT_TOP_K = 5

#: Score weights (percent) for the matching components.
VECTOR_SIMILARITY_WEIGHT = 40.0
BUDGET_FIT_WEIGHT = 40.0
VALUE_WEIGHT = 20.0
SUBCITY_MATCH_WEIGHT = 40.0  # used only by the rule-based fallback

#: Fraction of the budget used as the target price in the query vector.
QUERY_PRICE_TARGET_FRACTION = 0.85

#: Feature layout shared between training and serving.
REC_VECTORIZER_COLUMNS: List[str] = [
    "price_etb",
    "area_sqm",
    "bedrooms",
    "bathrooms",
    "subcity",
]
REC_NUMERIC_COLUMNS: List[str] = ["price_etb", "area_sqm", "bedrooms", "bathrooms"]
REC_CATEGORICAL_COLUMNS: List[str] = ["subcity"]

#: Built-in demo catalog, used until a real ``catalog.json`` exists.
DEFAULT_CATALOG: List[Dict[str, object]] = [
    {"property_id": "P-0001", "subcity": "bole", "price_etb": 18000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 90.0},
    {"property_id": "P-0002", "subcity": "bole", "price_etb": 25000.0, "bedrooms": 3, "bathrooms": 3, "area_sqm": 130.0},
    {"property_id": "P-0003", "subcity": "arada", "price_etb": 22000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 105.0},
    {"property_id": "P-0004", "subcity": "yeka", "price_etb": 15000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 85.0},
    {"property_id": "P-0005", "subcity": "yeka", "price_etb": 12000.0, "bedrooms": 1, "bathrooms": 1, "area_sqm": 70.0},
    {"property_id": "P-0006", "subcity": "kirkos", "price_etb": 28000.0, "bedrooms": 3, "bathrooms": 3, "area_sqm": 140.0},
    {"property_id": "P-0007", "subcity": "kirkos", "price_etb": 19000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 100.0},
    {"property_id": "P-0008", "subcity": "gulele", "price_etb": 10000.0, "bedrooms": 1, "bathrooms": 1, "area_sqm": 60.0},
    {"property_id": "P-0009", "subcity": "nifas silk-lafto", "price_etb": 14000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 95.0},
    {"property_id": "P-0010", "subcity": "addis ketema", "price_etb": 9000.0, "bedrooms": 1, "bathrooms": 1, "area_sqm": 55.0},
]


@dataclass(frozen=True)
class Recommendation:
    """A single recommended listing with its match explanation."""

    property_id: str
    match_score: float
    explanation: str
    details: Dict[str, object]


class Recommender:
    """Ranks listings from a catalog against a tenant's budget/preferences."""

    def __init__(
        self,
        catalog_path: Path = CATALOG_PATH,
        pipeline_path: Path = RECOMMENDER_PIPELINE_PATH,
    ) -> None:
        """Initialize the recommender and load catalog + ML pipeline.

        Args:
            catalog_path: Optional path to a JSON catalog file.
            pipeline_path: Optional path to ``recommender_pipeline.joblib``.
        """
        self._catalog = load_catalog(catalog_path)
        self._pipeline_path = pipeline_path
        self._pipeline = None  # type: Optional[Dict[str, object]]
        self._load_pipeline()

    # -- public API ---------------------------------------------------------

    def recommend(
        self,
        user_id: str,
        max_budget: float,
        preferred_subcity: Optional[str] = None,
        top_k: int = DEFAULT_TOP_K,
    ) -> List[Recommendation]:
        """Return the best-matching listings for a tenant.

        Args:
            user_id: Tenant identifier (used for future personalisation).
            max_budget: Maximum monthly rent the tenant can afford, in ETB.
            preferred_subcity: Optional preferred Addis Ababa subcity.
            top_k: Maximum number of recommendations to return.

        Returns:
            A list of :class:`Recommendation` objects, best match first.
        """
        budget = float(max_budget)
        preferred = (preferred_subcity or "").strip().lower()
        candidates = [
            listing for listing in self._catalog if _as_float(listing.get("price_etb")) <= budget
        ]

        if self._pipeline is not None:
            query_row = self._query_row(budget=budget, preferred_subcity=preferred)
            scored = [
                self._score_vector_listing(
                    listing, query_row=query_row, max_budget=budget, preferred_subcity=preferred
                )
                for listing in candidates
            ]
        else:
            scored = [
                self._score_fallback_listing(listing, max_budget=budget, preferred_subcity=preferred)
                for listing in candidates
            ]

        scored.sort(key=lambda rec: rec.match_score, reverse=True)
        return scored[: max(int(top_k), 0)]

    def catalog_size(self) -> int:
        """Return the number of listings in the catalog."""
        return len(self._catalog)

    def model_loaded(self) -> bool:
        """Return whether the ML recommendation pipeline is in use."""
        return self._pipeline is not None

    # -- ML internals -------------------------------------------------------

    def _load_pipeline(self) -> None:
        """Attempt to load the trained recommendation pipeline, if present."""
        try:
            import joblib
        except ImportError:  # pragma: no cover - joblib ships with sklearn
            logger.warning("joblib unavailable; using rule-based fallback.")
            return

        if not self._pipeline_path.exists():
            logger.info("No recommender pipeline at %s; using rule fallback.", self._pipeline_path)
            return

        try:
            bundle = joblib.load(self._pipeline_path)
            if "vectorizer" not in bundle:
                raise ValueError("pipeline bundle missing 'vectorizer'")
            self._pipeline = bundle
            logger.info("Loaded recommender pipeline from %s", self._pipeline_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load recommender pipeline (%s); using rule fallback.", exc)
            self._pipeline = None

    def _score_vector_listing(
        self,
        listing: Dict[str, object],
        query_row: pd.DataFrame,
        max_budget: float,
        preferred_subcity: str,
    ) -> Recommendation:
        """Score a listing using vector-space similarity + budget/value."""
        price = _as_float(listing.get("price_etb"))
        bedrooms = int(listing.get("bedrooms") or 0)
        bathrooms = int(listing.get("bathrooms") or 1)
        area = _as_float(listing.get("area_sqm"))
        listing_subcity = str(listing.get("subcity", "")).strip().lower()

        cosine = self._cosine_similarity(query_row, listing)
        cos01 = (cosine + 1.0) / 2.0
        vector_score = cos01 * VECTOR_SIMILARITY_WEIGHT

        if max_budget > 0:
            budget_fit = min((price / max_budget) * BUDGET_FIT_WEIGHT, BUDGET_FIT_WEIGHT)
        else:
            budget_fit = 0.0

        max_price = max(
            (_as_float(item.get("price_etb")) for item in self._catalog
             if _as_float(item.get("price_etb")) <= max_budget),
            default=1.0,
        )
        value_score = (price / max_price) * VALUE_WEIGHT if max_price > 0 else 0.0

        total = round(vector_score + budget_fit + value_score, 2)
        explanation = self._build_explanation(
            listing_subcity=listing_subcity,
            preferred_subcity=preferred_subcity,
            price=price,
            max_budget=max_budget,
            bedrooms=bedrooms,
            area=area,
            cos_pct=cos01 * 100.0,
        )

        return Recommendation(
            property_id=str(listing.get("property_id")),
            match_score=total,
            explanation=explanation,
            details={
                "subcity": listing_subcity,
                "price_etb": price,
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
                "area_sqm": area,
                "vector_similarity": round(cos01, 4),
            },
        )

    def _query_row(self, budget: float, preferred_subcity: str) -> pd.DataFrame:
        """Build the user's query preference vector as a single-row frame."""
        areas = [_as_float(item.get("area_sqm")) for item in self._catalog]
        bedrooms = [int(item.get("bedrooms") or 0) for item in self._catalog]
        bathrooms = [int(item.get("bathrooms") or 1) for item in self._catalog]

        row = {
            "price_etb": budget * QUERY_PRICE_TARGET_FRACTION,
            "area_sqm": float(np.median(areas)) if areas else 0.0,
            "bedrooms": float(np.median(bedrooms)) if bedrooms else 1.0,
            "bathrooms": float(np.median(bathrooms)) if bathrooms else 1.0,
            "subcity": preferred_subcity,
        }
        return pd.DataFrame([row], columns=REC_VECTORIZER_COLUMNS)

    def _listing_row(self, listing: Dict[str, object]) -> pd.DataFrame:
        """Build a catalog listing's vectorizer row (same layout as training)."""
        row = {
            "price_etb": _as_float(listing.get("price_etb")),
            "area_sqm": _as_float(listing.get("area_sqm")),
            "bedrooms": float(int(listing.get("bedrooms") or 0)),
            "bathrooms": float(int(listing.get("bathrooms") or 1)),
            "subcity": str(listing.get("subcity", "")).strip().lower(),
        }
        return pd.DataFrame([row], columns=REC_VECTORIZER_COLUMNS)

    def _cosine_similarity(self, query_row: pd.DataFrame, listing: Dict[str, object]) -> float:
        """Compute cosine similarity between query and listing embeddings.

        Equivalent to ``sklearn.metrics.pairwise.cosine_similarity`` but
        returns 0.0 for zero-norm vectors (e.g. an empty preferred
        subcity block) instead of relying on library edge behaviour.
        """
        vectorizer = self._pipeline["vectorizer"]
        query_vec = np.asarray(vectorizer.transform(query_row).toarray()).ravel()
        listing_vec = np.asarray(vectorizer.transform(self._listing_row(listing)).toarray()).ravel()

        query_norm = float(np.linalg.norm(query_vec))
        listing_norm = float(np.linalg.norm(listing_vec))
        if query_norm == 0.0 or listing_norm == 0.0:
            return 0.0
        return float(np.dot(query_vec, listing_vec) / (query_norm * listing_norm))

    # -- rule-based fallback -------------------------------------------------

    def _score_fallback_listing(
        self,
        listing: Dict[str, object],
        max_budget: float,
        preferred_subcity: str,
    ) -> Recommendation:
        """Score a listing using the explainable rule-based fallback."""
        listing_subcity = str(listing.get("subcity", "")).strip().lower()
        price = _as_float(listing.get("price_etb"))
        bedrooms = int(listing.get("bedrooms") or 0)
        area = _as_float(listing.get("area_sqm"))

        subcity_score = SUBCITY_MATCH_WEIGHT if listing_subcity == preferred_subcity else 0.0
        if max_budget > 0:
            budget_fit = min((price / max_budget) * BUDGET_FIT_WEIGHT, BUDGET_FIT_WEIGHT)
        else:
            budget_fit = 0.0

        max_price = max(
            (_as_float(item.get("price_etb")) for item in self._catalog
             if _as_float(item.get("price_etb")) <= max_budget),
            default=1.0,
        )
        value_score = (price / max_price) * VALUE_WEIGHT if max_price > 0 else 0.0

        total = round(subcity_score + budget_fit + value_score, 2)
        explanation = self._build_explanation(
            listing_subcity=listing_subcity,
            preferred_subcity=preferred_subcity,
            price=price,
            max_budget=max_budget,
            bedrooms=bedrooms,
            area=area,
        )

        return Recommendation(
            property_id=str(listing.get("property_id")),
            match_score=total,
            explanation=explanation,
            details={
                "subcity": listing_subcity,
                "price_etb": price,
                "bedrooms": bedrooms,
                "area_sqm": area,
            },
        )

    def _build_explanation(
        self,
        listing_subcity: str,
        preferred_subcity: str,
        price: float,
        max_budget: float,
        bedrooms: int,
        area: float,
        cos_pct: Optional[float] = None,
    ) -> str:
        """Build a human-readable explanation for a match."""
        parts: List[str] = []
        if cos_pct is not None:
            parts.append(f"{cos_pct:.0f}% vector-space similarity to your preferences")
        if preferred_subcity and listing_subcity == preferred_subcity:
            parts.append(f"in your preferred subcity {listing_subcity.title()}")
        if max_budget > 0:
            utilization = min((price / max_budget) * 100.0, 100.0)
            parts.append(f"uses {utilization:.0f}% of your ETB {max_budget:,.0f} budget")
        parts.append(f"{bedrooms}-bedroom, {area:,.0f} sqm unit")
        if not parts:
            parts.append("within your search criteria")
        return "; ".join(parts)


def load_catalog(catalog_path: Path = CATALOG_PATH) -> List[Dict[str, object]]:
    """Load the listing catalog from JSON, falling back to the demo data."""
    if catalog_path.exists():
        try:
            with catalog_path.open("r", encoding="utf-8") as handle:
                raw = json.load(handle)
            listings = raw if isinstance(raw, list) else raw.get("listings", [])
            logger.info("Loaded listing catalog (%d items) from %s", len(listings), catalog_path)
            return [item for item in listings if isinstance(item, dict)]
        except (OSError, ValueError) as exc:  # noqa: BLE001
            logger.warning("Failed to load catalog %s (%s); using demo data.", catalog_path, exc)

    logger.info("No catalog at %s; using built-in demo catalog.", catalog_path)
    return [dict(item) for item in DEFAULT_CATALOG]


def _as_float(value: object) -> float:
    """Safely coerce a value to float, returning 0.0 on failure."""
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0
