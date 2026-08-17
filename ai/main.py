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

import json
import time
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from src.fraud_detector import FraudDetector
from src.recommend import Recommender, rank_properties
from src.rent_estimator import RentEstimator

#: Path to the model manifest written by ``src.train``.
_MANIFEST_PATH = Path(__file__).resolve().parent / "models" / "model_manifest.json"

#: Timestamp when the application started (used by uptime reporting).
_STARTUP_TIME = time.time()


def _load_manifest_versions() -> Dict[str, str]:
    """Read model versions from ``model_manifest.json``, falling back to defaults."""
    defaults = {"rent": "rent-v1.0.0", "fraud": "fraud-v1.0.0"}
    try:
        with open(_MANIFEST_PATH, encoding="utf-8") as fh:
            manifest = json.load(fh)
        return {
            "rent": manifest.get("rent_model", {}).get("version", defaults["rent"]),
            "fraud": manifest.get("fraud_model", {}).get("version", defaults["fraud"]),
        }
    except (OSError, ValueError, KeyError):
        return defaults


_MODEL_VERSIONS = _load_manifest_versions()

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

    subcity: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Addis Ababa subcity, e.g. 'Bole'.",
    )
    bedrooms: int = Field(..., ge=0, le=20, description="Number of bedrooms.")
    bathrooms: int = Field(..., ge=0, le=20, description="Number of bathrooms.")
    area_sqm: float = Field(
        ..., gt=0, le=100_000,
        description="Floor area in square metres (realistic range: 10-1000).",
    )
    has_water_tank: bool = Field(False, description="Whether the unit has a private water tank.")
    has_generator: bool = Field(False, description="Whether the unit has a backup generator.")
    is_furnished: bool = Field(False, description="Whether the unit is rented furnished.")

    @model_validator(mode="after")
    def _validate_realistic_ranges(self) -> "RentEstimateRequest":
        """Reject inputs that are technically numeric but realistically invalid."""
        if self.bedrooms == 0 and self.bathrooms == 0:
            raise ValueError(
                "A property must have at least one bedroom or bathroom."
            )
        if self.area_sqm < 10.0:
            raise ValueError(
                f"area_sqm={self.area_sqm} is unrealistically small for a residential property."
            )
        return self


class RentEstimateResponse(BaseModel):
    """Output of the rent estimation endpoint."""

    estimated_rent_etb: float = Field(
        ..., description="Predicted monthly rent in ETB."
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0,
        description="Model confidence (0=low, 1=high). ML model: 0.92, heuristic: 0.58.",
    )
    model_used: str = Field(
        ...,
        description="Model artifact name, e.g. 'rent_model.joblib' or 'heuristic-baseline'.",
    )
    model_version: str = Field(
        default="0.1.0",
        description="API/model version of the prediction engine.",
    )
    input_summary: Dict[str, object] = Field(
        ..., description="Echo of the validated input used for the prediction."
    )


class CandidateProperty(BaseModel):
    """A single property the backend sends for scoring."""

    property_id: str = Field(..., min_length=1, description="Listing identifier.")
    price_etb: float = Field(..., gt=0, description="Monthly asking price in ETB.")
    bedrooms: int = Field(..., ge=0, le=20, description="Number of bedrooms.")
    bathrooms: int = Field(..., ge=0, le=20, description="Number of bathrooms.")
    subcity: str = Field(..., min_length=1, description="Addis Ababa subcity.")
    area_sqm: float = Field(0.0, ge=0, description="Floor area in square metres.")
    is_furnished: bool = Field(False, description="Whether the unit is furnished.")


class RecommendationRequest(BaseModel):
    """Inputs for the property recommendation endpoint."""

    max_budget_etb: float = Field(
        ..., gt=0,
        description="Maximum monthly rent the tenant can afford, in ETB.",
    )
    preferred_subcities: List[str] = Field(
        ...,
        min_length=1,
        description="Ordered list of preferred Addis Ababa subcities (at least one).",
    )
    min_bedrooms: int = Field(
        1, ge=0, le=20,
        description="Minimum number of bedrooms required.",
    )
    min_bathrooms: int = Field(
        1, ge=0, le=20,
        description="Minimum number of bathrooms required.",
    )
    preferred_property_type: Optional[str] = Field(
        None, description="Optional property-type filter (e.g. 'apartment').",
    )
    is_furnished_required: Optional[bool] = Field(
        None, description="If True only furnished listings are returned.",
    )
    limit: int = Field(
        5, ge=1, le=50,
        description="Maximum number of recommendations to return.",
    )
    candidate_properties: Optional[List[CandidateProperty]] = Field(
        None,
        description=(
            "Optional batch of candidate properties supplied by the backend. "
            "When provided, these listings are scored instead of the built-in catalog."
        ),
    )

    @model_validator(mode="after")
    def _validate_subcities(self) -> "RecommendationRequest":
        """Ensure at least one non-empty subcity is provided."""
        cleaned = [s.strip() for s in self.preferred_subcities if s.strip()]
        if not cleaned:
            raise ValueError("preferred_subcities must contain at least one non-empty string.")
        self.preferred_subcities = cleaned
        return self


class RecommendationItem(BaseModel):
    """A single recommended listing in the response."""

    property_id: str = Field(..., description="Listing identifier from the catalog.")
    match_score: float = Field(..., ge=0.0, le=100.0, description="Composite match score (0–100).")
    match_reasons: List[str] = Field(
        default_factory=list,
        description="Human-readable reasons explaining the match.",
    )
    estimated_market_rent: Optional[float] = Field(
        None, description="ML-estimated market rent in ETB (if available).",
    )


class RecommendationResponse(BaseModel):
    """Output of the recommendation endpoint."""

    total_candidates_evaluated: int = Field(
        ..., description="Number of candidate listings evaluated.",
    )
    recommendations: List[RecommendationItem] = Field(
        ..., description="Ranked recommendations (best match first).",
    )
    model_version: str = Field(
        default="rec-v1.0.0",
        description="Version of the recommendation engine.",
    )


class FraudCheckRequest(BaseModel):
    """Inputs for the multi-signal fraud analysis endpoint."""

    listing_id: str = Field(
        ..., min_length=1, max_length=100,
        description="Listing identifier to assess.",
    )
    price_etb: float = Field(
        ..., gt=0,
        description="Monthly asking price in ETB.",
    )
    area_sqm: float = Field(
        ..., gt=0, le=100_000,
        description="Floor area in square metres.",
    )
    bedrooms: int = Field(
        ..., ge=0, le=20,
        description="Number of bedrooms.",
    )
    bathrooms: int = Field(
        ..., ge=0, le=20,
        description="Number of bathrooms.",
    )
    description_text: str = Field(
        "",
        max_length=5000,
        description="Free-text description of the listing.",
    )
    subcity: Optional[str] = Field(
        None,
        min_length=1,
        max_length=50,
        description="Addis Ababa subcity, e.g. 'Bole'.",
    )

    @model_validator(mode="after")
    def _validate_ranges(self) -> "FraudCheckRequest":
        """Reject unrealistically small areas."""
        if self.area_sqm < 10.0:
            raise ValueError(
                f"area_sqm={self.area_sqm} is unrealistically small for a residential property."
            )
        return self


class FraudCheckResponse(BaseModel):
    """Output of the multi-signal fraud analysis endpoint."""

    listing_id: str = Field(
        ..., description="Echo of the assessed listing id."
    )
    risk_score: int = Field(
        ..., ge=0, le=100,
        description="Composite risk score (0=safe, 100=critical).",
    )
    risk_level: str = Field(
        ...,
        description="Human-readable risk level: 'low', 'medium', or 'high'.",
    )
    red_flags: List[str] = Field(
        default_factory=list,
        description="Actionable red-flag descriptions explaining detected risks.",
    )
    price_deviation_percent: float = Field(
        ...,
        description=(
            "Percentage difference between listed price and market estimate. "
            "Negative = underpriced, positive = overpriced."
        ),
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0,
        description="Analysis confidence (ML model loaded: 0.85, fallback: 0.65).",
    )
    model_version: str = Field(
        default="fraud-v1.1.0",
        description="Version of the fraud analysis engine.",
    )
    signal_breakdown: Optional[Dict[str, float]] = Field(
        None,
        description="Component scores: price_anomaly (0-40), text_metadata (0-30), ml_anomaly (0-30).",
    )


class HealthResponse(BaseModel):
    """Liveness probe response."""

    status: str = Field(..., description="Service status ('ok').")
    uptime_seconds: float = Field(..., description="Seconds since the process started.")
    api_version: str = Field(..., description="FastAPI application version.")
    timestamp: float = Field(..., description="Unix timestamp of the response.")


class ReadyResponse(BaseModel):
    """Readiness probe response (HTTP 200)."""

    status: str = Field(..., description="Readiness status ('ready').")
    models_loaded: bool = Field(..., description="True if all ML models are loaded in memory.")
    manifest_version: Optional[str] = Field(
        None, description="Model manifest schema version, if available."
    )


class ReadyErrorResponse(BaseModel):
    """Readiness probe failure response (HTTP 503)."""

    status: str = Field(..., description="Readiness status ('not_ready').")
    models_loaded: bool = Field(default=False, description="Always false when not ready.")
    errors: List[str] = Field(..., description="List of failed readiness checks.")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    """Liveness probe — confirms the process is running.

    Returns:
        Status, uptime, API version, and a timestamp.
    """
    return HealthResponse(
        status="ok",
        uptime_seconds=round(time.time() - _STARTUP_TIME, 2),
        api_version=app.version,
        timestamp=time.time(),
    )


@app.get("/ready", response_model=ReadyResponse, tags=["system"])
def ready() -> ReadyResponse:
    """Readiness probe — verifies models and manifest are available.

    Returns HTTP 200 when all checks pass, or HTTP 503 with a list of
    specific failures when the service is not ready to serve traffic.
    """
    errors: List[str] = []

    # Check model artifacts exist on disk.
    rent_artifact = Path(__file__).resolve().parent / "models" / "rent_model.joblib"
    fraud_artifact = Path(__file__).resolve().parent / "models" / "fraud_model.joblib"

    if not rent_artifact.exists():
        errors.append("rent_model.joblib not found on disk")
    if not fraud_artifact.exists():
        errors.append("fraud_model.joblib not found on disk")

    # Check manifest is readable.
    if not _MANIFEST_PATH.exists():
        errors.append("model_manifest.json not found on disk")
    else:
        try:
            with open(_MANIFEST_PATH, encoding="utf-8") as fh:
                json.load(fh)
        except (OSError, ValueError) as exc:
            errors.append(f"model_manifest.json unreadable: {exc}")

    # Check models are loaded in memory.
    if _rent_estimator is None:
        errors.append("rent estimator not loaded in memory")
    if _fraud_detector is None:
        errors.append("fraud detector not loaded in memory")

    manifest_version: Optional[str] = None
    try:
        with open(_MANIFEST_PATH, encoding="utf-8") as fh:
            manifest_version = json.load(fh).get("schema_version")
    except (OSError, ValueError):
        pass

    if errors:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=503,
            content=ReadyErrorResponse(
                status="not_ready",
                models_loaded=False,
                errors=errors,
            ).model_dump(),
        )

    return ReadyResponse(
        status="ready",
        models_loaded=True,
        manifest_version=manifest_version,
    )


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
            has_generator=request.has_generator,
            is_furnished=request.is_furnished,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Rent estimation failed: {exc}") from exc

    return RentEstimateResponse(
        estimated_rent_etb=prediction.estimated_rent_etb,
        confidence=prediction.confidence,
        model_used=prediction.model_name,
        model_version=_MODEL_VERSIONS["rent"],
        input_summary={
            "subcity": request.subcity,
            "bedrooms": request.bedrooms,
            "bathrooms": request.bathrooms,
            "area_sqm": request.area_sqm,
            "has_water_tank": request.has_water_tank,
            "has_generator": request.has_generator,
            "is_furnished": request.is_furnished,
        },
    )


@app.post("/api/v1/recommend", response_model=RecommendationResponse, tags=["ml"])
def recommend(request: RecommendationRequest) -> RecommendationResponse:
    """Recommend listings for a tenant based on budget and preferences.

    Computes a weighted match score (0–100) across four signals:
    budget fit (35%), subcity/location match (35%), room/space fit
    (20%), and furnishing & amenities (10%).

    Args:
        request: Tenant budget, preferred subcities, room requirements,
            and an optional batch of candidate properties.

    Returns:
        Ranked list of recommendations with per-item match reasons.
    """
    candidate_dicts = (
        [prop.model_dump() for prop in request.candidate_properties]
        if request.candidate_properties
        else get_recommender()._catalog
    )

    try:
        results = rank_properties(
            candidates=candidate_dicts,
            max_budget_etb=request.max_budget_etb,
            preferred_subcities=request.preferred_subcities,
            min_bedrooms=request.min_bedrooms,
            min_bathrooms=request.min_bathrooms,
            is_furnished_required=request.is_furnished_required,
            limit=request.limit,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {exc}") from exc

    return RecommendationResponse(
        total_candidates_evaluated=len(candidate_dicts),
        recommendations=[
            RecommendationItem(
                property_id=item.property_id,
                match_score=item.match_score,
                match_reasons=item.match_reasons,
                estimated_market_rent=item.estimated_market_rent,
            )
            for item in results
        ],
    )


@app.post("/api/v1/detect-fraud", response_model=FraudCheckResponse, tags=["ml"])
def detect_fraud(request: FraudCheckRequest) -> FraudCheckResponse:
    """Multi-signal fraud risk analysis for a property listing.

    Computes a 0-100 risk score from three weighted signals:
    price anomaly (vs. market estimate), text/metadata red flags,
    and ML-based anomaly detection.

    Args:
        request: Listing details (price, area, bedrooms, description).

    Returns:
        Structured risk analysis with score, level, and red flags.
    """
    detector = get_fraud_detector()
    try:
        report = detector.analyze(
            listing_id=request.listing_id,
            price_etb=request.price_etb,
            area_sqm=request.area_sqm,
            bedrooms=request.bedrooms,
            bathrooms=request.bathrooms,
            description_text=request.description_text,
            subcity=request.subcity,
        )
    except Exception as exc:  # noqa: BLE001 - surface as 500
        raise HTTPException(status_code=500, detail=f"Fraud analysis failed: {exc}") from exc

    return FraudCheckResponse(
        listing_id=report.listing_id,
        risk_score=report.risk_score,
        risk_level=report.risk_level,
        red_flags=report.red_flags,
        price_deviation_percent=report.price_deviation_percent,
        confidence=report.confidence,
        model_version=report.model_version,
        signal_breakdown=report.signal_breakdown,
    )
