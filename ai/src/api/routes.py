from __future__ import annotations

from fastapi import APIRouter

from src.api.schemas import (
    DocumentForensicsRequest,
    DocumentForensicsResponse,
    FraudAnalysisRequest,
    FraudAnalysisResponse,
)
from src.fraud.document_forensics import analyze_document_authenticity
from src.fraud.risk_engine import analyze_listing_risk

router = APIRouter()


@router.post("/fraud/analyze", response_model=FraudAnalysisResponse, tags=["fraud"])
def fraud_analyze(request: FraudAnalysisRequest) -> FraudAnalysisResponse:
    """Run explainable fraud screening for a listing."""
    return analyze_listing_risk(request)


@router.post("/fraud/document-forensics", response_model=DocumentForensicsResponse, tags=["fraud"])
def document_forensics(request: DocumentForensicsRequest) -> DocumentForensicsResponse:
    """Run automated computer vision & forensic checks on uploaded identity or title deed documents."""
    result = analyze_document_authenticity(
        document_type=request.document_type,
        file_name=request.file_name,
        mime_type=request.mime_type,
        file_size_bytes=request.file_size_bytes,
        account_legal_name=request.account_legal_name,
        metadata=request.metadata,
    )
    return DocumentForensicsResponse(**result)

