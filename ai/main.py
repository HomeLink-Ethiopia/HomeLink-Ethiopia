"""HomeLink AI Engine — FastAPI application entry point.

A microservice exposing ML capabilities (rent estimation, property
recommendation, and fraud-risk scoring) to the HomeLink-Ethiopia
backend/frontend.

Start the development server from within ``ai/``:

    uvicorn main:app --reload

Interactive docs are available at ``/docs`` (Swagger UI) and
``/redoc`` (ReDoc).
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.fraud_detector import FraudDetector
from src.recommend import Recommender
from src.rent_estimator import RentEstimator

app = FastAPI(
    title="HomeLink AI Engine",
    description=(
        "AI microservice for HomeLink-Ethiopia: monthly rent estimation in ETB, "
        "tenant property recommendations, and listing fraud-risk detection."
    ),
    version="0.1.0",
    contact={"name": "HomeLink-Ethiopia"},
)

# Permissive CORS for local development; tighten origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-loaded singletons so the modules can be instantiated once at boot.
_rent_estimator: Optional[RentEstimator] = None
_recommender: Optional[Recommender] = None
_fraud_detector: Optional[FraudDetector] = None


def get_rent_estimator() -> RentEstimator:
    """Return the shared rent estimator instance."""
    global _rent_estimator
    if _rent_estimator is None:
        _rent_estimator = RentEstimator()
    return _rent_estimator


def get_recommender() -> Recommender:
    """Return the shared recommender instance."""
    global _recommender
    if _recommender is None:
        _recommender = Recommender()
    return _recommender


def get_fraud_detector() -> FraudDetector:
    """Return the shared fraud detector instance."""
    global _fraud_detector
    if _fraud_detector is None:
        _fraud_detector = FraudDetector()
    return _fraud_detector


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class RentEstimateRequest(BaseModel):
    """Inputs for the rent estimation endpoint."""

    subcity: str = Field(..., description="Addis Ababa subcity, e.g. 'Bole'.")
    bedrooms: int = Field(..., ge=0, le=20, description="Number of bedrooms.")
    bathrooms: int = Field(..., ge=0, le=20, description="Number of bathrooms.")
    area_sqm: float = Field(..., gt=0, le=100000, description="Floor area in square metres.")
    has_water_tank: bool = Field(False, description="Whether the unit has a private water tank.")


class RentEstimateResponse(BaseModel):
    """Output of the rent estimation endpoint."""

    estimated_rent_etb: float = Field(..., description="Predicted monthly rent in ETB.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence (0-1).")
    model_used: str = Field(..., description="Name of the model or 'heuristic-baseline'.")
    input_summary: Dict[str, object] = Field(
        ..., description="Echo of the validated input used for the prediction."
    )


class RecommendRequest(BaseModel):
    """Inputs for the recommendation endpoint."""

    user_id: str = Field(..., min_length=1, description="Tenant identifier.")
    max_budget: float = Field(..., gt=0, description="Maximum monthly rent in ETB.")
    preferred_subcity: Optional[str] = Field(
        None, description="Optional preferred Addis Ababa subcity."
    )
    top_k: int = Field(5, ge=1, le=20, description="Maximum number of recommendations.")


class Recommendation(BaseModel):
    """A single recommended listing."""

    property_id: str = Field(..., description="Listing identifier from the catalog.")
    match_score: float = Field(..., ge=0.0, le=100.0, description="Composite match score (0-100).")
    explanation: str = Field(..., description="Human-readable match explanation.")
    details: Dict[str, object] = Field(..., description="Listing attributes that drove the match.")


class RecommendResponse(BaseModel):
    """Output of the recommendation endpoint."""

    user_id: str = Field(..., description="Echo of the requesting tenant id.")
    total_matches: int = Field(..., description="Number of recommendations returned.")
    recommendations: List[Recommendation] = Field(..., description="Ranked recommendations.")


class FraudDetectRequest(BaseModel):
    """Inputs for the fraud detection endpoint."""

    listing_id: str = Field(..., min_length=1, description="Listing identifier to assess.")
    price_etb: float = Field(..., gt=0, description="Monthly asking price in ETB.")
    area_sqm: float = Field(..., gt=0, description="Floor area in square metres.")
    description_text: str = Field(
        "", description="Free-text description of the listing."
    )


class FraudDetectResponse(BaseModel):
    """Output of the fraud detection endpoint."""

    listing_id: str = Field(..., description="Echo of the assessed listing id.")
    fraud_risk_score: float = Field(
        ..., ge=0.0, le=1.0, description="Fraud risk score (0.0 = safe, 1.0 = high risk)."
    )
    is_flagged: bool = Field(..., description="True when the listing should be flagged.")
    risk_indicators: List[str] = Field(..., description="Specific indicators that were triggered.")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/", response_model=Dict[str, str], tags=["system"])
def health_check() -> Dict[str, str]:
    """Health check endpoint.

    Returns:
        A simple status payload confirming the service is online.
    """
    return {"status": "online", "service": "HomeLink AI Engine"}


@app.post("/api/v1/estimate-rent", response_model=RentEstimateResponse, tags=["ml"])
def estimate_rent(request: RentEstimateRequest) -> RentEstimateResponse:
    """Predict the monthly rent in ETB for a residential property.

    Args:
        request: Property attributes (subcity, bedrooms, bathrooms,
            area, water tank).

    Returns:
        Predicted rent, model confidence, and an input summary.
    """
    estimator = get_rent_estimator()
    try:
        prediction = estimator.predict(
            subcity=request.subcity,
            bedrooms=request.bedrooms,
            bathrooms=request.bathrooms,
            area_sqm=request.area_sqm,
            has_water_tank=request.has_water_tank,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Rent estimation failed: {exc}") from exc

    return RentEstimateResponse(
        estimated_rent_etb=prediction.estimated_rent_etb,
        confidence=prediction.confidence,
        model_used=prediction.model_name,
        input_summary={
            "subcity": request.subcity,
            "bedrooms": request.bedrooms,
            "bathrooms": request.bathrooms,
            "area_sqm": request.area_sqm,
            "has_water_tank": request.has_water_tank,
        },
    )


@app.post("/api/v1/recommend", response_model=RecommendResponse, tags=["ml"])
def recommend(request: RecommendRequest) -> RecommendResponse:
    """Recommend listings for a tenant based on budget and preferences.

    Args:
        request: Tenant id, maximum budget, preferred subcity, and the
            desired number of recommendations.

    Returns:
        Ranked list of recommended property ids with explanations.
    """
    recommender = get_recommender()
    try:
        matches = recommender.recommend(
            user_id=request.user_id,
            max_budget=request.max_budget,
            preferred_subcity=request.preferred_subcity,
            top_k=request.top_k,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {exc}") from exc

    return RecommendResponse(
        user_id=request.user_id,
        total_matches=len(matches),
        recommendations=[
            Recommendation(
                property_id=item.property_id,
                match_score=item.match_score,
                explanation=item.explanation,
                details=item.details,
            )
            for item in matches
        ],
    )


@app.post("/api/v1/detect-fraud", response_model=FraudDetectResponse, tags=["ml"])
def detect_fraud(request: FraudDetectRequest) -> FraudDetectResponse:
    """Assess a listing for fraud risk.

    Args:
        request: Listing id, price, area, and description text.

    Returns:
        A fraud risk score (0-1), a flag, and the triggered indicators.
    """
    detector = get_fraud_detector()
    try:
        report = detector.detect(
            listing_id=request.listing_id,
            price_etb=request.price_etb,
            area_sqm=request.area_sqm,
            description_text=request.description_text,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Fraud detection failed: {exc}") from exc

    return FraudDetectResponse(
        listing_id=report.listing_id,
        fraud_risk_score=report.fraud_risk_score,
        is_flagged=report.is_flagged,
        risk_indicators=report.risk_indicators,
    )
