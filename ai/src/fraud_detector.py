"""Fraud risk detection module for the HomeLink AI Engine.

The detector is a transparent, rule-based scorer that flags listings
exhibiting common rental-scam signals. It returns a risk score in the
range ``[0.0, 1.0]`` together with a list of the specific indicators
that were triggered, so downstream consumers (backend / frontend) can
surface *why* a listing was flagged.

Scoring rules
-------------
Each triggered indicator adds a fixed amount to the base score:

- Price-per-sqm far below the Addis market range  -> +0.35 (unrealistic bargain)
- Price-per-sqm far above the Addis market range  -> +0.30 (inflated price)
- Description shorter than a minimum length       -> +0.25 (missing detail)
- Suspicious urgency / payment language           -> +0.15 per keyword, capped at +0.40
- Excessive exclamation marks                     -> +0.10 (pushy tone)

The score is clamped to ``[0.0, 1.0]``. A listing is flagged when the
score is ``>= FLAG_THRESHOLD``.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

#: Price-per-sqm (ETB) thresholds relative to the Addis Ababa market.
LOW_PER_SQM_THRESHOLD = 60.0
HIGH_PER_SQM_THRESHOLD = 2000.0

#: Minimum meaningful description length (characters).
MIN_DESC_LENGTH = 30

#: Minimum score at which a listing is considered fraudulent.
FLAG_THRESHOLD = 0.6

#: Contribution of each indicator type to the risk score.
SCORE_PRICE_TOO_LOW = 0.35
SCORE_PRICE_TOO_HIGH = 0.30
SCORE_SHORT_DESCRIPTION = 0.25
SCORE_SUSPICIOUS_KEYWORDS = 0.15
SCORE_SUSPICIOUS_KEYWORDS_CAP = 0.40
SCORE_EXCESSIVE_PUNCTUATION = 0.10

#: Phrases commonly associated with rental scams.
SUSPICIOUS_KEYWORDS: Tuple[str, ...] = (
    "urgent",
    "act fast",
    "today only",
    "limited time",
    "no deposit",
    "pay first",
    "pay in advance",
    "wire transfer",
    "western union",
    "moneygram",
    "money gram",
    "outside the country",
    "abroad",
    "bitcoin",
    "crypto",
    "external link",
    "agent fee",
    "refundable fee",
    "don't tell the landlord",
)


@dataclass(frozen=True)
class FraudReport:
    """Result of a fraud-risk assessment for a listing."""

    listing_id: str
    fraud_risk_score: float
    is_flagged: bool
    risk_indicators: List[str] = field(default_factory=list)


class FraudDetector:
    """Scores a listing's likelihood of being fraudulent."""

    def detect(
        self,
        listing_id: str,
        price_etb: float,
        area_sqm: float,
        description_text: str,
    ) -> FraudReport:
        """Assess a listing and return a :class:`FraudReport`.

        Args:
            listing_id: Backend identifier of the listing being checked.
            price_etb: Monthly asking price in ETB.
            area_sqm: Floor area in square metres.
            description_text: Free-text description of the listing.

        Returns:
            A :class:`FraudReport` with the risk score and indicators.
        """
        indicators: List[str] = []
        score = 0.0

        price, area, description = self._sanitize(
            price_etb=price_etb,
            area_sqm=area_sqm,
            description_text=description_text,
        )

        # -- price vs. size anomalies ---------------------------------------
        if area > 0 and price > 0:
            per_sqm = price / area
            if per_sqm < LOW_PER_SQM_THRESHOLD:
                indicators.append(
                    f"price per sqm (ETB {per_sqm:,.0f}) far below the Addis market range"
                )
                score += SCORE_PRICE_TOO_LOW
            elif per_sqm > HIGH_PER_SQM_THRESHOLD:
                indicators.append(
                    f"price per sqm (ETB {per_sqm:,.0f}) far above the Addis market range"
                )
                score += SCORE_PRICE_TOO_HIGH

        # -- description quality ---------------------------------------------
        if len(description) < MIN_DESC_LENGTH:
            indicators.append("description too short or missing (scam red flag)")
            score += SCORE_SHORT_DESCRIPTION

        # -- language / urgency signals --------------------------------------
        matched_keywords = self._find_suspicious_keywords(description)
        if matched_keywords:
            indicators.append(
                f"suspicious urgency or payment language: {', '.join(matched_keywords)}"
            )
            score += min(
                SCORE_SUSPICIOUS_KEYWORDS_CAP,
                len(matched_keywords) * SCORE_SUSPICIOUS_KEYWORDS,
            )

        if self._has_excessive_punctuation(description):
            indicators.append("excessive exclamation marks suggest a pushy ad")
            score += SCORE_EXCESSIVE_PUNCTUATION

        # -- finalise ---------------------------------------------------------
        final_score = min(max(score, 0.0), 1.0)
        is_flagged = final_score >= FLAG_THRESHOLD

        return FraudReport(
            listing_id=listing_id,
            fraud_risk_score=round(final_score, 4),
            is_flagged=is_flagged,
            risk_indicators=indicators,
        )

    # -- internals ----------------------------------------------------------

    def _sanitize(
        self,
        price_etb: float,
        area_sqm: float,
        description_text: str,
    ) -> Tuple[float, float, str]:
        """Coerce inputs to safe, non-negative values."""
        try:
            price = float(price_etb)
        except (TypeError, ValueError):
            price = 0.0
        try:
            area = float(area_sqm)
        except (TypeError, ValueError):
            area = 0.0
        description = re.sub(r"\s+", " ", str(description_text or "")).strip().lower()
        return max(price, 0.0), max(area, 0.0), description

    def _find_suspicious_keywords(self, description: str) -> List[str]:
        """Return the list of scam keywords present in a description."""
        return [keyword for keyword in SUSPICIOUS_KEYWORDS if keyword in description]

    def _has_excessive_punctuation(self, description: str) -> bool:
        """Return True when a description is over-punctuated with '!'."""
        return description.count("!") >= 3
