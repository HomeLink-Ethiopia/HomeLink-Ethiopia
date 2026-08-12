"""Property recommendation module for the HomeLink AI Engine.

Recommendations are computed against a listing catalog. The catalog is
loaded from ``ai/models/catalog.json`` when present (produced by the
backend data pipeline), otherwise a small built-in demo catalog is used
so the service is runnable end to end.

Matching logic
--------------
Each listing is scored on three weighted components (total 0 - 100):

- **Subcity match** (40 pts): listing subcity equals the tenant's
  preferred subcity.
- **Budget fit** (40 pts): the share of the tenant's budget the listing
  price consumes; closer to 100% is a stronger match while staying
  within budget.
- **Value / quality** (20 pts): how the listing price compares with the
  most expensive listing in the candidate pool, rewarding larger, more
  premium units the tenant can afford.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
CATALOG_PATH = MODELS_DIR / "catalog.json"

#: Default number of recommendations to return.
DEFAULT_TOP_K = 5

#: Score weights (percent) for the matching components.
SUBCITY_MATCH_WEIGHT = 40.0
BUDGET_FIT_WEIGHT = 40.0
VALUE_WEIGHT = 20.0

#: Built-in demo catalog, used until a real ``catalog.json`` exists.
DEFAULT_CATALOG: List[Dict[str, object]] = [
    {"property_id": "P-0001", "subcity": "bole", "price_etb": 18000.0, "bedrooms": 2, "area_sqm": 90.0},
    {"property_id": "P-0002", "subcity": "bole", "price_etb": 25000.0, "bedrooms": 3, "area_sqm": 130.0},
    {"property_id": "P-0003", "subcity": "arada", "price_etb": 22000.0, "bedrooms": 2, "area_sqm": 105.0},
    {"property_id": "P-0004", "subcity": "yeka", "price_etb": 15000.0, "bedrooms": 2, "area_sqm": 85.0},
    {"property_id": "P-0005", "subcity": "yeka", "price_etb": 12000.0, "bedrooms": 1, "area_sqm": 70.0},
    {"property_id": "P-0006", "subcity": "kirkos", "price_etb": 28000.0, "bedrooms": 3, "area_sqm": 140.0},
    {"property_id": "P-0007", "subcity": "kirkos", "price_etb": 19000.0, "bedrooms": 2, "area_sqm": 100.0},
    {"property_id": "P-0008", "subcity": "gullele", "price_etb": 10000.0, "bedrooms": 1, "area_sqm": 60.0},
    {"property_id": "P-0009", "subcity": "nifas silk-lafto", "price_etb": 14000.0, "bedrooms": 2, "area_sqm": 95.0},
    {"property_id": "P-0010", "subcity": "addis ketema", "price_etb": 9000.0, "bedrooms": 1, "area_sqm": 55.0},
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

    def __init__(self, catalog_path: Path = CATALOG_PATH) -> None:
        """Initialize the recommender and load the listing catalog.

        Args:
            catalog_path: Optional path to a JSON catalog file.
        """
        self._catalog = self._load_catalog(catalog_path)

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
        candidates = [listing for listing in self._catalog if _as_float(listing.get("price_etb")) <= budget]

        scored: List[Recommendation] = []
        for listing in candidates:
            scored.append(
                self._score_listing(listing, max_budget=budget, preferred_subcity=preferred)
            )

        scored.sort(key=lambda rec: rec.match_score, reverse=True)
        return scored[: max(int(top_k), 0)]

    def catalog_size(self) -> int:
        """Return the number of listings in the catalog."""
        return len(self._catalog)

    # -- internals ----------------------------------------------------------

    def _score_listing(
        self,
        listing: Dict[str, object],
        max_budget: float,
        preferred_subcity: str,
    ) -> Recommendation:
        """Compute the composite match score and explanation for one listing."""
        listing_subcity = str(listing.get("subcity", "")).strip().lower()
        price = _as_float(listing.get("price_etb"))
        bedrooms = int(listing.get("bedrooms") or 0)
        area = _as_float(listing.get("area_sqm"))

        # 1) Subcity match (0-40).
        subcity_score = SUBCITY_MATCH_WEIGHT if listing_subcity == preferred_subcity else 0.0

        # 2) Budget fit (0-40): price within budget, prefer closer to budget.
        if max_budget > 0:
            budget_fit = (price / max_budget) * BUDGET_FIT_WEIGHT
        else:
            budget_fit = 0.0

        # 3) Value / quality (0-20): relative price within the candidate pool.
        pool_prices = [
            _as_float(item.get("price_etb"))
            for item in self._catalog
            if _as_float(item.get("price_etb")) <= max_budget
        ]
        max_price = max(pool_prices, default=1.0)
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
    ) -> str:
        """Build a human-readable explanation for a match."""
        parts: List[str] = []
        if preferred_subcity and listing_subcity == preferred_subcity:
            parts.append(f"in your preferred subcity {listing_subcity.title()}")
        if max_budget > 0:
            utilization = min((price / max_budget) * 100.0, 100.0)
            parts.append(f"uses {utilization:.0f}% of your ETB {max_budget:,.0f} budget")
        parts.append(f"{bedrooms}-bedroom, {area:,.0f} sqm unit")
        if not parts:
            parts.append("within your search criteria")
        return "; ".join(parts)

    def _load_catalog(self, catalog_path: Path) -> List[Dict[str, object]]:
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
