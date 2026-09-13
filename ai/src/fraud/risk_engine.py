from __future__ import annotations

from pathlib import Path
from typing import List

import joblib
import pandas as pd

from src.api.schemas import FraudAnalysisRequest, FraudAnalysisResponse


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "models" / "baseline_rent_model.joblib"
HIGH_RISK_PATTERNS = [
    "advance payment",
    "wire transfer",
    "western union",
    "urgent cash",
    "pay before viewing",
    "bank transfer before inspection",
]


def _estimate_market_rent(request: FraudAnalysisRequest) -> float:
    """Estimate the market rent using the persisted baseline rent model if available."""
    try:
        model = joblib.load(MODEL_PATH)
        frame = pd.DataFrame([
            {
                "subcity": request.subcity,
                "bedrooms": request.bedrooms,
                "bathrooms": request.bathrooms,
                "size_sqm": request.size_sqm,
                "furnished": request.furnished,
            }
        ])
        prediction = float(model.predict(frame)[0])
        if prediction > 0:
            return prediction
    except Exception:
        pass

    base_rate = {
        "bole": 340.0,
        "kirkos": 320.0,
        "arada": 300.0,
        "yeka": 265.0,
        "nifas silk": 240.0,
        "nifas silk-lafto": 240.0,
        "gulele": 225.0,
        "gullele": 225.0,
        "kolfe": 215.0,
        "kolfe keranio": 215.0,
        "lidetta": 210.0,
        "lideta": 210.0,
        "addis ketema": 205.0,
        "akaky kaliti": 190.0,
    }
    subcity_key = request.subcity.strip().lower()
    rate = base_rate.get(subcity_key, 250.0)
    estimate = rate * request.size_sqm
    estimate += request.bedrooms * 2200.0
    estimate += request.bathrooms * 1200.0
    if request.furnished:
        estimate *= 1.15
    return estimate


def analyze_listing_risk(request: FraudAnalysisRequest) -> FraudAnalysisResponse:
    """Assess fraud risk using price anomaly checks and suspicious payment language detection."""
    estimated_rent = _estimate_market_rent(request)
    red_flags: List[str] = []
    risk_score = 0

    if request.price < 0.5 * estimated_rent:
        red_flags.append("Price is suspiciously below estimated market rent")
        risk_score += 40
    elif request.price > 2.0 * estimated_rent:
        red_flags.append("Price is significantly above estimated market rent")
        risk_score += 20

    text = f"{request.title} {request.description}".lower()
    suspicious_matches = [pattern for pattern in HIGH_RISK_PATTERNS if pattern in text]
    if suspicious_matches:
        red_flags.append("Suspicious payment language detected in description")
        risk_score += 35

    risk_score = max(0, min(100, risk_score))
    if 0 <= risk_score <= 30:
        risk_level = "low"
    elif risk_score <= 70:
        risk_level = "medium"
    else:
        risk_level = "high"

    confidence = 0.85
    return FraudAnalysisResponse(
        risk_score=risk_score,
        risk_level=risk_level,
        red_flags=red_flags,
        confidence=confidence,
        model_version="fraud-risk-v1",
    )
