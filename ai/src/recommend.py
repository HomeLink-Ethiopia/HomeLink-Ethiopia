"""Property recommendation module for the HomeLink AI Engine.

Recommends listings by computing a weighted match score (0–100) across
four independent signals against the tenant's stated criteria:

Signal weights
~~~~~~~~~~~~~~
- **Budget Fit** (35 pts): How well the listing price fits within the
  tenant's maximum budget. Full points when price ≤ budget; partial
  credit up to +30% over budget.
- **Subcity / Location Match** (35 pts): Exact subcity match gives full
  points; neighbouring subcity gives partial credit via an adjacency
  map of Addis Ababa subcities.
- **Room / Space Fit** (20 pts): Whether bedrooms and bathrooms meet
  the tenant's minimum requirements.
- **Furnishing & Amenities Fit** (10 pts): Whether the listing meets
  the tenant's furnishing preference.

When ``candidate_properties`` is provided in the request, those
listings are scored directly; otherwise the built-in demo catalog (or
a ``catalog.json`` on disk) is used.

Constraint relaxation
~~~~~~~~~~~~~~~~~~~~~
If the number of exact / high-confidence matches is smaller than the
requested ``limit``, the scorer automatically includes top-scoring
partial matches with explanatory notes such as
"Slightly exceeds target budget (+8%)".
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
CATALOG_PATH = MODELS_DIR / "catalog.json"
RECOMMENDER_PIPELINE_PATH = MODELS_DIR / "recommender_pipeline.joblib"

_cached_estimator = None

#: Default number of recommendations to return.
DEFAULT_LIMIT = 5

#: Hard cap on the ``limit`` parameter.
MAX_LIMIT = 50

# ---------------------------------------------------------------------------
# Signal weights (must sum to 100)
# ---------------------------------------------------------------------------
BUDGET_WEIGHT = 35.0
SUBCITY_WEIGHT = 35.0
ROOM_WEIGHT = 20.0
FURNISHING_WEIGHT = 10.0

# ---------------------------------------------------------------------------
# Subcity adjacency graph for Addis Ababa
# ---------------------------------------------------------------------------
_SUBCITY_ADJACENCY: Dict[str, List[str]] = {
    "bole": ["kirkos", "yeka"],
    "kirkos": ["bole", "arada", "yeka"],
    "arada": ["kirkos", "addis ketema"],
    "yeka": ["bole", "kirkos", "nifas silk-lafto"],
    "nifas silk-lafto": ["yeka", "akaky kaliti"],
    "gulele": ["kolfe", "addis ketema"],
    "kolfe": ["gulele", "lideta"],
    "lideta": ["kolfe", "akaky kaliti"],
    "addis ketema": ["arada", "gulele"],
    "akaky kaliti": ["nifas silk-lafto", "lideta"],
}

#: Fraction of budget tolerance for partial budget-match credit
#: (e.g. 0.30 = up to 30 % over budget gets partial credit).
BUDGET_OVER_TOLERANCE = 0.30

#: Neighbouring-subcity partial score as a fraction of the full subcity
#: weight (e.g. 0.55 = 55 % of 35 pts = ~19 pts).
NEIGHBOUR_SUBCITY_FRACTION = 0.55

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Recommendation:
    """A single recommended listing with its match explanation."""

    property_id: str
    match_score: float
    match_reasons: List[str] = field(default_factory=list)
    estimated_market_rent: Optional[float] = None


# ---------------------------------------------------------------------------
# Scoring helpers (module-level, stateless)
# ---------------------------------------------------------------------------

def _budget_fit_score(price: float, budget: float) -> tuple[float, list[str]]:
    """Return (score, reasons) for the budget fit signal (0–BUDGET_WEIGHT)."""
    if budget <= 0:
        return 0.0, []

    if price <= budget:
        pct = (price / budget) * 100.0 if budget else 0.0
        return BUDGET_WEIGHT, [f"Within budget ({pct:.0f}% of ETB {budget:,.0f})"]

    over_ratio = (price - budget) / budget
    if over_ratio <= BUDGET_OVER_TOLERANCE:
        fraction = 1.0 - (over_ratio / BUDGET_OVER_TOLERANCE)
        score = fraction * BUDGET_WEIGHT
        pct_over = over_ratio * 100.0
        return round(score, 2), [f"Slightly exceeds target budget (+{pct_over:.0f}%)"]

    return 0.0, [f"Exceeds budget (price ETB {price:,.0f} vs budget ETB {budget:,.0f})"]


def _subcity_match_score(
    listing_subcity: str,
    preferred_subcities: Sequence[str],
) -> tuple[float, list[str]]:
    """Return (score, reasons) for the location signal (0–SUBCITY_WEIGHT)."""
    normalised = listing_subcity.strip().lower()
    preferred = [s.strip().lower() for s in preferred_subcities if s.strip()]

    if not preferred:
        return SUBCITY_WEIGHT / 2.0, ["No subcity preference specified"]

    if normalised in preferred:
        return SUBCITY_WEIGHT, [f"In preferred subcity {normalised.title()}"]

    for pref in preferred:
        neighbours = [n.strip().lower() for n in _SUBCITY_ADJACENCY.get(pref, [])]
        if normalised in neighbours:
            score = SUBCITY_WEIGHT * NEIGHBOUR_SUBCITY_FRACTION
            return round(score, 2), [
                f"Neighbouring subcity to preferred {pref.title()}",
            ]

    return 0.0, [f"Subcity {normalised.title()} not in preferred list"]


def _room_fit_score(
    bedrooms: int,
    bathrooms: int,
    min_bedrooms: int,
    min_bathrooms: int,
) -> tuple[float, list[str]]:
    """Return (score, reasons) for the room fit signal (0–ROOM_WEIGHT)."""
    reasons: list[str] = []
    bedroom_pts = 0.0
    bathroom_pts = 0.0

    half = ROOM_WEIGHT / 2.0

    if bedrooms >= min_bedrooms:
        bedroom_pts = half
        reasons.append(f"Meets bedroom requirement ({bedrooms} ≥ {min_bedrooms})")
    else:
        fraction = bedrooms / min_bedrooms if min_bedrooms > 0 else 1.0
        bedroom_pts = round(fraction * half, 2)
        reasons.append(f"Below bedroom requirement ({bedrooms} < {min_bedrooms})")

    if bathrooms >= min_bathrooms:
        bathroom_pts = half
        reasons.append(f"Meets bathroom requirement ({bathrooms} ≥ {min_bathrooms})")
    else:
        fraction = bathrooms / min_bathrooms if min_bathrooms > 0 else 1.0
        bathroom_pts = round(fraction * half, 2)
        reasons.append(f"Below bathroom requirement ({bathrooms} < {min_bathrooms})")

    return round(bedroom_pts + bathroom_pts, 2), reasons


def _furnishing_score(
    is_furnished: bool,
    is_furnished_required: Optional[bool],
) -> tuple[float, list[str]]:
    """Return (score, reasons) for the furnishing signal (0–FURNISHING_WEIGHT)."""
    if is_furnished_required is None:
        return FURNISHING_WEIGHT / 2.0, ["Furnishing preference not specified"]

    if is_furnished_required:
        if is_furnished:
            return FURNISHING_WEIGHT, ["Furnished as required"]
        return 0.0, ["Not furnished (furnishing required)"]

    return FURNISHING_WEIGHT, ["Furnishing not required"]


def _compute_total(
    budget_pts: float,
    subcity_pts: float,
    room_pts: float,
    furnish_pts: float,
) -> float:
    """Sum component scores and clamp to 0–100."""
    total = budget_pts + subcity_pts + room_pts + furnish_pts
    return round(min(total, 100.0), 2)


# ---------------------------------------------------------------------------
# Main public scorer
# ---------------------------------------------------------------------------

def rank_properties(
    *,
    candidates: Sequence[Dict[str, object]],
    max_budget_etb: float,
    preferred_subcities: Sequence[str],
    min_bedrooms: int = 1,
    min_bathrooms: int = 1,
    is_furnished_required: Optional[bool] = None,
    limit: int = DEFAULT_LIMIT,
) -> List[Recommendation]:
    """Score and rank candidate properties against tenant criteria.

    Each candidate dict is expected to contain at least:
    ``property_id``, ``price_etb``, ``bedrooms``, ``bathrooms``,
    ``subcity``.  Optional: ``is_furnished``, ``area_sqm``.

    Returns a list of :class:`Recommendation` objects sorted by
    ``match_score`` descending, truncated to ``limit``.
    """
    scored: list[tuple[float, Recommendation]] = []

    for prop in candidates:
        prop_id = str(prop.get("property_id", "unknown"))
        price = _as_float(prop.get("price_etb"))
        bedrooms = int(prop.get("bedrooms") or 0)
        bathrooms = int(prop.get("bathrooms") or 0)
        subcity = str(prop.get("subcity", "")).strip().lower()
        furnished = bool(prop.get("is_furnished", False))

        b_pts, b_reasons = _budget_fit_score(price, max_budget_etb)
        s_pts, s_reasons = _subcity_match_score(subcity, preferred_subcities)
        r_pts, r_reasons = _room_fit_score(
            bedrooms, bathrooms, min_bedrooms, min_bathrooms,
        )
        f_pts, f_reasons = _furnishing_score(furnished, is_furnished_required)

        total = _compute_total(b_pts, s_pts, r_pts, f_pts)
        reasons = b_reasons + s_reasons + r_reasons + f_reasons

        # Attempt to attach an estimated market rent via the rent estimator
        est_rent: Optional[float] = None
        try:
            global _cached_estimator
            if _cached_estimator is None:
                from src.rent_estimator import RentEstimator
                _cached_estimator = RentEstimator()
            prediction = _cached_estimator.predict(
                subcity=subcity,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                area_sqm=_as_float(prop.get("area_sqm")),
            )
            est_rent = round(prediction.estimated_rent_etb, 2)
        except Exception:  # noqa: BLE001
            pass

        rec = Recommendation(
            property_id=prop_id,
            match_score=total,
            match_reasons=reasons,
            estimated_market_rent=est_rent,
        )
        scored.append((total, rec))

    scored.sort(key=lambda t: t[0], reverse=True)

    # --- constraint relaxation ---
    # Exact / high matches (>= 60) first, then fill remainder with partial matches
    high = [(s, r) for s, r in scored if s >= 60.0]
    partial = [(s, r) for s, r in scored if s < 60.0]

    result: list[Recommendation] = []
    for _, rec in high:
        if len(result) >= limit:
            break
        result.append(rec)
    for _, rec in partial:
        if len(result) >= limit:
            break
        result.append(rec)

    return result[:limit]


# ---------------------------------------------------------------------------
# Legacy API wrapper – keeps old ``Recommender`` class usable
# ---------------------------------------------------------------------------

class Recommender:
    """Ranks listings from a catalog against a tenant's budget/preferences."""

    def __init__(
        self,
        catalog_path: Path = CATALOG_PATH,
        pipeline_path: Path = RECOMMENDER_PIPELINE_PATH,
    ) -> None:
        self._catalog = load_catalog(catalog_path)
        self._pipeline_path = pipeline_path
        self._pipeline = None
        self._load_pipeline()

    def recommend(
        self,
        user_id: str,
        max_budget: float,
        preferred_subcity: Optional[str] = None,
        top_k: int = DEFAULT_LIMIT,
        *,
        min_bedrooms: int = 1,
        min_bathrooms: int = 1,
        is_furnished_required: Optional[bool] = None,
        candidate_properties: Optional[List[Dict[str, object]]] = None,
    ) -> List[Recommendation]:
        """Return the best-matching listings for a tenant.

        Accepts the new-style parameters while remaining backwards-
        compatible with the old ``user_id + max_budget + top_k`` call
        signature.
        """
        candidates = candidate_properties if candidate_properties else self._catalog
        preferred = [preferred_subcity] if preferred_subcity else []
        return rank_properties(
            candidates=candidates,
            max_budget_etb=max_budget,
            preferred_subcities=preferred,
            min_bedrooms=min_bedrooms,
            min_bathrooms=min_bathrooms,
            is_furnished_required=is_furnished_required,
            limit=top_k,
        )

    def catalog_size(self) -> int:
        """Return the number of listings in the catalog."""
        return len(self._catalog)

    def model_loaded(self) -> bool:
        """Return whether the ML recommendation pipeline is in use."""
        return self._pipeline is not None

    # -- ML internals (kept for potential future use) -----------------------

    def _load_pipeline(self) -> None:
        try:
            import joblib  # noqa: F401
        except ImportError:  # pragma: no cover
            return

        if not self._pipeline_path.exists():
            return

        try:
            import joblib
            bundle = joblib.load(self._pipeline_path)
            if "vectorizer" not in bundle:
                raise ValueError("pipeline bundle missing 'vectorizer'")
            self._pipeline = bundle
            logger.info("Loaded recommender pipeline from %s", self._pipeline_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load recommender pipeline (%s); using rule fallback.", exc)
            self._pipeline = None


# ---------------------------------------------------------------------------
# Catalog loader
# ---------------------------------------------------------------------------

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


#: Built-in demo catalog, used until a real ``catalog.json`` exists.
DEFAULT_CATALOG: List[Dict[str, object]] = [
    {"property_id": "P-0001", "subcity": "bole", "price_etb": 18000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 90.0, "is_furnished": False},
    {"property_id": "P-0002", "subcity": "bole", "price_etb": 25000.0, "bedrooms": 3, "bathrooms": 3, "area_sqm": 130.0, "is_furnished": True},
    {"property_id": "P-0003", "subcity": "arada", "price_etb": 22000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 105.0, "is_furnished": False},
    {"property_id": "P-0004", "subcity": "yeka", "price_etb": 15000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 85.0, "is_furnished": False},
    {"property_id": "P-0005", "subcity": "yeka", "price_etb": 12000.0, "bedrooms": 1, "bathrooms": 1, "area_sqm": 70.0, "is_furnished": True},
    {"property_id": "P-0006", "subcity": "kirkos", "price_etb": 28000.0, "bedrooms": 3, "bathrooms": 3, "area_sqm": 140.0, "is_furnished": False},
    {"property_id": "P-0007", "subcity": "kirkos", "price_etb": 19000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 100.0, "is_furnished": False},
    {"property_id": "P-0008", "subcity": "gulele", "price_etb": 10000.0, "bedrooms": 1, "bathrooms": 1, "area_sqm": 60.0, "is_furnished": False},
    {"property_id": "P-0009", "subcity": "nifas silk-lafto", "price_etb": 14000.0, "bedrooms": 2, "bathrooms": 2, "area_sqm": 95.0, "is_furnished": False},
    {"property_id": "P-0010", "subcity": "addis ketema", "price_etb": 9000.0, "bedrooms": 1, "bathrooms": 1, "area_sqm": 55.0, "is_furnished": False},
]


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _as_float(value: object) -> float:
    """Safely coerce a value to float, returning 0.0 on failure."""
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0
