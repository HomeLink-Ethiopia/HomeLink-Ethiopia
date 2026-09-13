"""Fraud risk detection module for the HomeLink AI Engine.

The detector combines **unsupervised anomaly detection** and **NLP text
analysis** with a transparent rule-based baseline:

1. **Tabular anomaly detection** — an ``IsolationForest`` trained on
   ``rent_price_etb``, ``area_sqm``, ``price_per_sqm`` and an ordinal
   ``subcity_rank`` feature flags listings that are statistical outliers
   relative to the Addis Ababa market. The ML anomaly score is the share
   of the training data that the listing is *more anomalous than*
   (0.0 = typical, 1.0 = extreme outlier).

2. **NLP text suspiciousness** — a ``TfidfVectorizer`` embeds the
   property description; the score is the cosine similarity of the text
   to hand-crafted scam-prototype centroids relative to the benign
   corpus centroid (0.0 = benign-looking, 1.0 = scam-looking).

3. **Rule-based baseline** — keyword/price/description heuristics that
   guarantee the service works even when no model artifact exists.

The final risk score is ``max(rule_score, ml_score)`` so critical
heuristic red flags are never masked, and a ``score_breakdown`` dict
exposes each component for explainability (defense / audit use case).

Model artifact contract
-----------------------
``ai/src/train_fraud_model.py`` trains and saves
``ai/models/fraud_model.joblib`` — a dict with keys::

    {
        "isolation_forest": IsolationForest,
        "train_decision_scores": np.ndarray,   # sorted training score_samples
        "tfidf": TfidfVectorizer,
        "benign_centroid": np.ndarray,         # shape (1, n_features)
        "suspicious_centroid": np.ndarray,     # shape (1, n_features)
        "feature_columns": List[str],
    }
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & feature layout
# ---------------------------------------------------------------------------

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
FRAUD_MODEL_PATH = MODELS_DIR / "fraud_model.joblib"
_MANIFEST_PATH = MODELS_DIR / "model_manifest.json"

#: Columns the IsolationForest is trained/predicted on.
FRAUD_FEATURE_COLUMNS: List[str] = [
    "rent_price_etb",
    "area_sqm",
    "price_per_sqm",
    "subcity_rank",
]

#: Ordinal subcity rank by expensiveness (higher = more expensive market).
SUBCITY_RANK: Dict[str, int] = {
    "bole": 9,
    "kirkos": 8,
    "arada": 7,
    "yeka": 6,
    "nifas silk": 5,
    "nifas silk-lafto": 5,  # alias
    "gulele": 4,
    "gullele": 4,  # alias
    "kolfe": 3,
    "kolfe keranio": 3,  # alias
    "lidetta": 2,
    "lideta": 2,  # alias
    "addis ketema": 1,
    "akaky kaliti": 0,
}
#: Rank assumed when no subcity is provided.
DEFAULT_SUBCITY_RANK = 4

#: Hand-crafted scam descriptions used to build the suspicious centroid.
SUSPICIOUS_DESCRIPTIONS: Tuple[str, ...] = (
    "URGENT! act fast today only, no deposit, pay first via Western Union",
    "Contact me abroad, wire transfer before viewing, money gram accepted",
    "Pay in advance to secure this deal, do not tell the landlord, bitcoin accepted",
    "Special deal today only, refundable agent fee, external link for photos",
    "No deposit required if you pay now, urgent move in, contact outside the country",
)

# ---------------------------------------------------------------------------
# Rule-based baseline constants
# ---------------------------------------------------------------------------

#: Price-per-sqm (ETB) thresholds relative to the Addis Ababa market.
LOW_PER_SQM_THRESHOLD = 60.0
HIGH_PER_SQM_THRESHOLD = 2000.0

#: Minimum meaningful description length (characters).
MIN_DESC_LENGTH = 30

#: Minimum score at which a listing is considered fraudulent.
FLAG_THRESHOLD = 0.6

#: Contribution of each rule indicator type to the risk score.
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

# ---------------------------------------------------------------------------
# ML score constants
# ---------------------------------------------------------------------------

#: Relative weight of the tabular vs. NLP component in the ML score.
TABULAR_WEIGHT = 0.6
TEXT_WEIGHT = 0.4

#: Thresholds at which ML components surface an indicator.
TABULAR_FLAG_THRESHOLD = 0.8
TEXT_FLAG_THRESHOLD = 0.6

_EPS = 1e-8

# ---------------------------------------------------------------------------
# Multi-signal analysis constants
# ---------------------------------------------------------------------------

#: Maximum points each signal can contribute to the final 0-100 score.
PRICE_SIGNAL_MAX = 40.0
TEXT_SIGNAL_MAX = 30.0
ML_SIGNAL_MAX = 30.0

#: Risk-level thresholds on the 0-100 scale.
RISK_LOW_MAX = 30
RISK_HIGH_MIN = 60

#: Price deviation thresholds (ratio of listing price to market estimate).
UNDERPRICE_SEVERE = -0.45   # listing < 55% of estimate
UNDERPRICE_MODERATE = -0.25 # listing < 75% of estimate
OVERPRICE_MODERATE = 1.0    # listing > 200% of estimate
OVERPRICE_SEVERE = 1.5      # listing > 250% of estimate

#: Unrealistic area-per-bedroom ratio (sqm per bedroom).
LOW_AREA_PER_BEDROOM = 10.0

#: Description length below which a short-desc flag is raised.
SHORT_DESC_THRESHOLD = 20

#: Phrases that strongly indicate advance-payment scam patterns.
ADVANCE_PAYMENT_KEYWORDS: Tuple[str, ...] = (
    "wire transfer",
    "western union",
    "moneygram",
    "money gram",
    "pay in advance",
    "pay first",
    "bitcoin",
    "crypto",
    "before viewing",
    "send money",
    "deposit before",
)

#: Phrases that indicate urgency-pressure tactics.
URGENCY_KEYWORDS: Tuple[str, ...] = (
    "urgent",
    "act fast",
    "today only",
    "limited time",
    "hurry",
    "last chance",
    "dont wait",
    "don't wait",
    "before it's gone",
    "moving soon",
)


def _score_to_level(score: int) -> str:
    """Map a 0-100 risk score to a human-readable risk level."""
    if score < RISK_LOW_MAX:
        return "low"
    if score >= RISK_HIGH_MIN:
        return "high"
    return "medium"


@dataclass(frozen=True)
class FraudReport:
    """Result of a fraud-risk assessment for a listing."""

    listing_id: str
    fraud_risk_score: float
    is_flagged: bool
    risk_indicators: List[str] = field(default_factory=list)
    score_breakdown: Optional[Dict[str, float]] = None


@dataclass(frozen=True)
class FraudAnalysisReport:
    """Structured, explainable result of the multi-signal fraud analysis."""

    listing_id: str
    risk_score: int
    risk_level: str
    red_flags: List[str]
    price_deviation_percent: float
    confidence: float
    model_version: str
    signal_breakdown: Dict[str, float]


class FraudDetector:
    """Scores a listing's likelihood of being fraudulent."""

    def __init__(self, model_path: Path = FRAUD_MODEL_PATH) -> None:
        """Initialize the detector and attempt to load the ML model bundle.

        Args:
            model_path: Path to ``fraud_model.joblib``, if available.
        """
        self._model_path = model_path
        self._bundle = None  # type: Optional[Dict[str, object]]
        self._model_version = self._load_manifest_version()
        self._load_model()

    # -- public API ---------------------------------------------------------

    def detect(
        self,
        listing_id: str,
        price_etb: float,
        area_sqm: float,
        description_text: str,
        subcity: Optional[str] = None,
    ) -> FraudReport:
        """Assess a listing and return a :class:`FraudReport`.

        Args:
            listing_id: Backend identifier of the listing being checked.
            price_etb: Monthly asking price in ETB.
            area_sqm: Floor area in square metres.
            description_text: Free-text description of the listing.
            subcity: Optional Addis Ababa subcity, e.g. ``"Bole"``.

        Returns:
            A :class:`FraudReport` with the risk score, indicators and a
            component score breakdown.
        """
        price, area, description = self._sanitize(
            price_etb=price_etb,
            area_sqm=area_sqm,
            description_text=description_text,
        )

        rule_score, indicators = self._rule_score(price=price, area=area, description=description)

        ml_breakdown: Optional[Dict[str, float]] = None
        ml_score: Optional[float] = None
        if self._bundle is not None:
            try:
                ml_score, ml_breakdown = self._ml_score(
                    price=price,
                    area=area,
                    subcity=subcity,
                    description=description,
                )
                if ml_breakdown.get("ml_tabular", 0.0) >= TABULAR_FLAG_THRESHOLD:
                    indicators.append(
                        "ML tabular anomaly: statistically unusual price/size for its subcity"
                    )
                if ml_breakdown.get("ml_text", 0.0) >= TEXT_FLAG_THRESHOLD:
                    indicators.append(
                        "description semantically similar to known scam templates"
                    )
            except Exception as exc:  # noqa: BLE001 - degrade gracefully
                logger.warning("ML fraud scoring failed (%s); rule fallback only.", exc)

        final_score = rule_score if ml_score is None else max(rule_score, ml_score)
        final_score = min(max(final_score, 0.0), 1.0)
        breakdown = {"rule_based": round(rule_score, 4)}
        if ml_breakdown is not None:
            breakdown.update({key: round(value, 4) for key, value in ml_breakdown.items()})

        return FraudReport(
            listing_id=listing_id,
            fraud_risk_score=round(final_score, 4),
            is_flagged=final_score >= FLAG_THRESHOLD,
            risk_indicators=indicators,
            score_breakdown=breakdown,
        )

    def model_loaded(self) -> bool:
        """Return whether the ML model bundle is currently in use."""
        return self._bundle is not None

    def analyze(
        self,
        listing_id: str,
        price_etb: float,
        area_sqm: float,
        bedrooms: int,
        bathrooms: int,
        description_text: str,
        subcity: Optional[str] = None,
    ) -> FraudAnalysisReport:
        """Multi-signal risk analysis returning a 0-100 score with red flags.

        Combines three weighted signals:

        1. **Price anomaly** (0-40 pts): compares listing price against
           the rent model's market estimate.
        2. **Text & metadata red flags** (0-30 pts): scans the description
           for urgency language, advance-payment requests, short/missing
           descriptions, and checks area-per-bedroom realism.
        3. **ML anomaly** (0-30 pts): IsolationForest + TF-IDF scores
           from ``fraud_model.joblib``.

        Args:
            listing_id: Backend identifier of the listing.
            price_etb: Monthly asking price in ETB.
            area_sqm: Floor area in square metres.
            bedrooms: Number of bedrooms.
            bathrooms: Number of bathrooms.
            description_text: Free-text listing description.
            subcity: Optional Addis Ababa subcity.

        Returns:
            A :class:`FraudAnalysisReport` with score, level, and flags.
        """
        price = max(float(price_etb), 0.0)
        area = max(float(area_sqm), 0.0)
        desc = re.sub(r"\s+", " ", str(description_text or "")).strip()

        # --- Signal 1: Price anomaly ---
        price_score, price_dev_pct, price_flags = self._price_anomaly_signal(
            price=price, area=area, bedrooms=int(bedrooms),
            bathrooms=int(bathrooms), subcity=subcity,
        )

        # --- Signal 2: Text & metadata red flags ---
        text_score, text_flags = self._text_metadata_signal(
            description=desc, area=area, bedrooms=int(bedrooms),
        )

        # --- Signal 3: ML anomaly ---
        ml_score, ml_flags = self._ml_anomaly_signal(
            price=price, area=area, subcity=subcity, description=desc,
        )

        # --- Combine ---
        raw_score = price_score + text_score + ml_score
        risk_score = int(min(max(round(raw_score), 0), 100))
        risk_level = _score_to_level(risk_score)
        all_flags = price_flags + text_flags + ml_flags

        # Confidence: higher when ML model is available
        confidence = 0.85 if self._bundle is not None else 0.65

        return FraudAnalysisReport(
            listing_id=listing_id,
            risk_score=risk_score,
            risk_level=risk_level,
            red_flags=all_flags,
            price_deviation_percent=round(price_dev_pct, 1),
            confidence=confidence,
            model_version=self._model_version,
            signal_breakdown={
                "price_anomaly": round(price_score, 2),
                "text_metadata": round(text_score, 2),
                "ml_anomaly": round(ml_score, 2),
                "total": round(raw_score, 2),
            },
        )

    # -- multi-signal internals ---------------------------------------------

    def _price_anomaly_signal(
        self,
        price: float,
        area: float,
        bedrooms: int,
        bathrooms: int,
        subcity: Optional[str],
    ) -> Tuple[float, float, List[str]]:
        """Compute price-anomaly score (0-40), deviation %, and flags."""
        flags: List[str] = []
        estimated = self._estimate_market_rent(
            area=area, bedrooms=bedrooms, bathrooms=bathrooms, subcity=subcity,
        )
        if estimated <= 0:
            return 0.0, 0.0, flags

        deviation = (price - estimated) / estimated
        dev_pct = deviation * 100.0

        score = 0.0
        if deviation < UNDERPRICE_SEVERE:
            score = PRICE_SIGNAL_MAX
            flags.append(
                f"Severe underpricing: listed ETB {price:,.0f} is {abs(dev_pct):.0f}% "
                f"below market estimate of ETB {estimated:,.0f}"
            )
        elif deviation < UNDERPRICE_MODERATE:
            score = PRICE_SIGNAL_MAX * 0.6
            flags.append(
                f"Moderate underpricing: listed ETB {price:,.0f} is {abs(dev_pct):.0f}% "
                f"below market estimate of ETB {estimated:,.0f}"
            )
        elif deviation > OVERPRICE_SEVERE:
            score = PRICE_SIGNAL_MAX * 0.85
            flags.append(
                f"Extreme overpricing: listed ETB {price:,.0f} is {dev_pct:.0f}% "
                f"above market estimate of ETB {estimated:,.0f}"
            )
        elif deviation > OVERPRICE_MODERATE:
            score = PRICE_SIGNAL_MAX * 0.4
            flags.append(
                f"Significant overpricing: listed ETB {price:,.0f} is {dev_pct:.0f}% "
                f"above market estimate of ETB {estimated:,.0f}"
            )

        return score, dev_pct, flags

    def _estimate_market_rent(
        self,
        area: float,
        bedrooms: int,
        bathrooms: int,
        subcity: Optional[str],
    ) -> float:
        """Estimate market rent using the rent model or heuristic fallback."""
        try:
            from src.rent_estimator import RentEstimator
            estimator = RentEstimator()
            result = estimator.predict(
                subcity=subcity or "addis ketema",
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                area_sqm=area,
                has_water_tank=False,
                has_generator=False,
                is_furnished=False,
            )
            return result.estimated_rent_etb
        except Exception:  # noqa: BLE001
            # Fallback: simple heuristic
            rate = SUBCITY_RANK.get((subcity or "").strip().lower(), DEFAULT_SUBCITY_RANK)
            return max(area * 250.0 + bedrooms * 2200.0 + bathrooms * 1200.0, 1.0)

    def _text_metadata_signal(
        self,
        description: str,
        area: float,
        bedrooms: int,
    ) -> Tuple[float, float, List[str]]:
        """Compute text/metadata red-flag score (0-30) and flags."""
        flags: List[str] = []
        score = 0.0

        # Short or missing description
        if len(description) < SHORT_DESC_THRESHOLD:
            score += 10.0
            flags.append("Description is very short or missing (common in scam listings)")

        # Urgency language
        matched_urgency = [kw for kw in URGENCY_KEYWORDS if kw in description.lower()]
        if matched_urgency:
            score += 8.0
            flags.append(f"Urgency pressure language detected: {', '.join(matched_urgency)}")

        # Advance-payment / wire-transfer language
        matched_payment = [kw for kw in ADVANCE_PAYMENT_KEYWORDS if kw in description.lower()]
        if matched_payment:
            score += 12.0
            flags.append(f"Advance payment / wire-transfer language detected: {', '.join(matched_payment)}")

        # Excessive exclamation marks
        if description.count("!") >= 3:
            score += 3.0
            flags.append("Excessive exclamation marks suggest pushy advertising")

        # Unrealistic area-per-bedroom ratio
        if bedrooms > 0 and area > 0:
            area_per_bed = area / bedrooms
            if area_per_bed < LOW_AREA_PER_BEDROOM:
                score += 7.0
                flags.append(
                    f"Unrealistic area-to-bedroom ratio: {area_per_bed:.0f} sqm/bedroom "
                    f"(minimum realistic: {LOW_AREA_PER_BEDROOM:.0f})"
                )

        return min(score, TEXT_SIGNAL_MAX), flags

    def _ml_anomaly_signal(
        self,
        price: float,
        area: float,
        subcity: Optional[str],
        description: str,
    ) -> Tuple[float, float, List[str]]:
        """Compute ML-based anomaly score (0-30) and flags."""
        flags: List[str] = []

        if self._bundle is None:
            return 0.0, flags

        try:
            # Tabular anomaly
            tabular = self._tabular_anomaly_score(price=price, area=area, subcity=subcity)
            # Text suspiciousness
            text_susp = self._text_suspiciousness_score(description=description)
            combined = TABULAR_WEIGHT * tabular + TEXT_WEIGHT * text_susp
            ml_pts = combined * ML_SIGNAL_MAX

            if tabular >= TABULAR_FLAG_THRESHOLD:
                flags.append(
                    "ML tabular anomaly: statistically unusual price/size for its subcity"
                )
            if text_susp >= TEXT_FLAG_THRESHOLD:
                flags.append(
                    "Description semantically similar to known scam templates"
                )

            return ml_pts, flags
        except Exception:  # noqa: BLE001
            logger.warning("ML fraud scoring failed in analyze(); returning 0.")
            return 0.0, flags

    # -- ML internals -------------------------------------------------------

    def _load_manifest_version(self) -> str:
        """Read fraud model version from ``model_manifest.json``."""
        try:
            import json as _json
            with open(_MANIFEST_PATH, encoding="utf-8") as fh:
                manifest = _json.load(fh)
            return manifest.get("fraud_model", {}).get("version", "fraud-v1.0.0")
        except (OSError, ValueError, KeyError):
            return "fraud-v1.0.0"

    def _load_model(self) -> None:
        """Attempt to load the ``.joblib`` fraud model bundle, if present."""
        try:
            import joblib
        except ImportError:  # pragma: no cover - joblib ships with sklearn
            logger.warning("joblib unavailable; using rule fallback.")
            return

        if not self._model_path.exists():
            logger.info("No fraud model at %s; using rule fallback.", self._model_path)
            return

        try:
            bundle = joblib.load(self._model_path)
            required = {
                "isolation_forest",
                "train_decision_scores",
                "tfidf",
                "benign_centroid",
                "suspicious_centroid",
            }
            if not required.issubset(bundle.keys()):
                raise ValueError(f"bundle missing keys: {required - bundle.keys()}")
            self._bundle = bundle
            logger.info("Loaded fraud model bundle from %s", self._model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load fraud model (%s); using rule fallback.", exc)
            self._bundle = None

    def _ml_score(
        self,
        price: float,
        area: float,
        subcity: Optional[str],
        description: str,
    ) -> Tuple[float, Dict[str, float]]:
        """Compute the combined ML anomaly + text suspiciousness score."""
        tabular = self._tabular_anomaly_score(price=price, area=area, subcity=subcity)
        text = self._text_suspiciousness_score(description=description)
        combined = TABULAR_WEIGHT * tabular + TEXT_WEIGHT * text
        return min(max(combined, 0.0), 1.0), {
            "ml_tabular": tabular,
            "ml_text": text,
            "ml_overall": combined,
        }

    def _tabular_anomaly_score(self, price: float, area: float, subcity: Optional[str]) -> float:
        """Return the IsolationForest anomaly score in ``[0.0, 1.0]``.

        The score is the share of training listings that the current
        listing is more anomalous than (empirical percentile of the
        decision function, inverted).
        """
        if price <= 0.0 or area <= 0.0:
            return 0.5  # neutral - not enough signal

        rank = SUBCITY_RANK.get((subcity or "").strip().lower(), DEFAULT_SUBCITY_RANK)
        row = np.array([[price, area, price / area, rank]], dtype=np.float64)

        forest = self._bundle["isolation_forest"]
        decision = float(forest.score_samples(row)[0])
        train_scores = np.asarray(self._bundle["train_decision_scores"])
        anomaly = 1.0 - float(np.mean(train_scores < decision))
        return min(max(anomaly, 0.0), 1.0)

    def _text_suspiciousness_score(self, description: str) -> float:
        """Return TF-IDF cosine suspiciousness in ``[0.0, 1.0]``."""
        if not description:
            return 0.0

        from sklearn.metrics.pairwise import cosine_similarity

        tfidf = self._bundle["tfidf"]
        vector = tfidf.transform([description])
        sim_susp = float(cosine_similarity(vector, self._bundle["suspicious_centroid"])[0, 0])
        sim_benign = float(cosine_similarity(vector, self._bundle["benign_centroid"])[0, 0])
        score = sim_susp / (sim_susp + sim_benign + _EPS)
        return min(max(score, 0.0), 1.0)

    # -- rule-based internals -----------------------------------------------

    def _rule_score(self, price: float, area: float, description: str) -> Tuple[float, List[str]]:
        """Compute the heuristic risk score and its indicators."""
        indicators: List[str] = []
        score = 0.0

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

        if len(description) < MIN_DESC_LENGTH:
            indicators.append("description too short or missing (scam red flag)")
            score += SCORE_SHORT_DESCRIPTION

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

        return min(max(score, 0.0), 1.0), indicators

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
