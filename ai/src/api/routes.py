from __future__ import annotations

from fastapi import APIRouter

from src.api.schemas import FraudAnalysisRequest, FraudAnalysisResponse
from src.fraud.risk_engine import analyze_listing_risk

router = APIRouter()


@router.post("/fraud/analyze", response_model=FraudAnalysisResponse, tags=["fraud"])
def fraud_analyze(request: FraudAnalysisRequest) -> FraudAnalysisResponse:
    """Run explainable fraud screening for a listing."""
    return analyze_listing_risk(request)
