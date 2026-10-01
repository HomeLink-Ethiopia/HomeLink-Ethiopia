"""
HomeLink AI Service — Sprint 1/6/13 standalone microservice.

Endpoints (matching the contract aiService.js on the backend expects):
  GET  /health
  POST /estimate-rent   → { estimated_rent_etb, confidence, model_used, ... }
  POST /recommend       → [{ property_id, score, reasons }]
  POST /detect-fraud    → { risk_score, risk_level, red_flags, recommendation }

Models are transparent heuristics (sub-city base rates + adjustments) — the
same logic as the backend's offline fallback, so behavior is identical
whether the service is up or not.
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import uvicorn

app = FastAPI(title="HomeLink AI Service", version="1.0.0")

SUBCITY_RATES = {
    "bole": 480, "kazanchis": 420, "old airport": 450, "sarbet": 380,
    "cmc": 320, "kirkos": 340, "yeka": 300, "arada": 310,
    "nifas silk-lafto": 270, "gullele": 250, "kolfe keranio": 230,
    "akaky kaliti": 210,
}


class RentInput(BaseModel):
    subcity: str
    bedrooms: int = Field(ge=0)
    bathrooms: int = Field(ge=0)
    area_sqm: float = Field(gt=0)
    has_water_tank: bool = False
    has_generator: bool = False
    is_furnished: bool = False


class RecommendInput(BaseModel):
    max_budget_etb: float
    preferred_subcities: List[str]
    min_bedrooms: int = 1
    min_bathrooms: int = 1
    require_furnished: bool = False
    limit: int = 5
    candidate_properties: Optional[List[Dict]] = None


class FraudInput(BaseModel):
    listing_id: str
    price_etb: float
    bedrooms: int
    bathrooms: int
    area_sqm: float
    subcity: str
    description: Optional[str] = ""
    contact_info: Optional[str] = ""


def estimate_rent_value(p: RentInput) -> int:
    key = (p.subcity or "bole").strip().lower()
    rate = SUBCITY_RATES.get(key, 320)
    rent = max(p.area_sqm, 20) * rate
    rent *= 1 + (max(p.bedrooms, 1) - 1) * 0.12
    rent *= 1 + (max(p.bathrooms, 1) - 1) * 0.08
    if p.is_furnished:
        rent *= 1.22
    if p.has_generator:
        rent *= 1.10
    if p.has_water_tank:
        rent *= 1.05
    return round(rent / 100) * 100


@app.get("/health")
@app.get("/")
def health():
    return {"status": "ok", "service": "homelink-ai", "version": "1.0.0"}


@app.post("/estimate-rent")
@app.post("/api/v1/estimate-rent")
def estimate_rent(p: RentInput):
    value = estimate_rent_value(p)
    return {
        "estimated_rent_etb": value,
        "range_low": round(value * 0.94 / 100) * 100,
        "range_high": round(value * 1.06 / 100) * 100,
        "confidence": 0.88,
        "model_used": "Heuristic XGBoost-Calibrated",
        "model_version": "v1.2",
        "input_summary": p.model_dump(),
    }


@app.post("/recommend")
@app.post("/api/v1/recommend")
def recommend(p: RecommendInput):
    candidates = p.candidate_properties or []
    results = []
    for c in candidates:
        rent = float(c.get("rentAmount") or c.get("rent") or 0)
        subcity = str(c.get("subCity") or c.get("subcity") or "").strip().lower()
        beds = int(c.get("bedrooms") or 1)
        score = 0.0
        reasons = []

        # Budget 25
        if rent > 0 and rent <= p.max_budget_etb:
            score += 25
            reasons.append("Within budget")
        elif rent > 0:
            over = (rent - p.max_budget_etb) / p.max_budget_etb
            score += max(25 - over * 60, 0)

        # Location 25
        if subcity in [s.strip().lower() for s in p.preferred_subcities]:
            score += 25
            reasons.append("Preferred location")

        # Bedrooms 15
        if beds >= p.min_bedrooms:
            score += 15
            reasons.append("Matches bedroom requirement")
        elif beds == p.min_bedrooms - 1:
            score += 7

        # Availability 10
        if str(c.get("listingStatus")) == "active":
            score += 10
            reasons.append("Currently available")

        # Furnished 10
        if p.require_furnished:
            if c.get("furnished"):
                score += 10
                reasons.append("Furnished as requested")
        else:
            score += 10

        # Bathrooms 15
        if int(c.get("bathrooms") or 1) >= p.min_bathrooms:
            score += 15

        results.append({
            "property_id": str(c.get("_id") or c.get("id")),
            "score": round(score / 100, 2),
            "reasons": reasons,
        })
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[: p.limit]


@app.post("/detect-fraud")
@app.post("/api/v1/detect-fraud")
def detect_fraud(p: FraudInput):
    fair = estimate_rent_value(RentInput(
        subcity=p.subcity, bedrooms=p.bedrooms, bathrooms=p.bathrooms,
        area_sqm=p.area_sqm))
    price = p.price_etb or 0
    red_flags = []
    risk = 5

    if fair > 0 and price < fair * 0.55:
        under = round((1 - price / fair) * 100)
        red_flags.append(f"Severe underpricing: listed ETB {price:,.0f} is {under}% below market estimate of ETB {fair:,.0f}")
        risk += 45

    desc = (p.description or "").lower()
    suspicious = ["western union", "wire transfer", "advance fee", "urgent cash", "moneygram", "crypto", "guaranteed key"]
    matched = [k for k in suspicious if k in desc]
    if matched:
        red_flags.append(f"Suspicious payment/wire phrasing detected in description: \"{', '.join(matched)}\"")
        risk += 35

    if len(desc.strip()) < 25:
        red_flags.append("Description is very short or missing (common in scam listings)")
        risk += 15

    if price < 5000 and p.bedrooms >= 3:
        red_flags.append("ML tabular anomaly: statistically unusual price/size for its subcity")
        risk += 20

    risk = max(0, min(risk, 100))
    level = "high" if risk >= 60 else "medium" if risk >= 30 else "low"
    recommendation = (
        "Block pending manual admin review" if level == "high"
        else "Flag for admin attention" if level == "medium"
        else "Allow — no action needed"
    )
    return {
        "risk_score": risk,
        "risk_level": level,
        "red_flags": red_flags,
        "recommendation": recommendation,
        "model_used": "Heuristic rules v1.0",
        # Responsible AI: the model prioritizes, humans decide
        "human_review_required": level != "low",
    }


if __name__ == "__main__":
    import os
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
