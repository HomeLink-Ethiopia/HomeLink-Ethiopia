from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class FraudAnalysisRequest(BaseModel):
    """Input payload for a fraud risk assessment."""

    title: str = Field(..., min_length=1, description="Title of the listing.")
    description: str = Field(..., min_length=1, description="Listing description text.")
    price: float = Field(..., gt=0, description="Listed price in ETB.")
    subcity: str = Field(..., min_length=1, description="Addis Ababa subcity name.")
    bedrooms: int = Field(..., ge=0, description="Number of bedrooms.")
    bathrooms: int = Field(..., ge=0, description="Number of bathrooms.")
    size_sqm: float = Field(..., gt=0, description="Property size in square metres.")
    furnished: int = Field(..., ge=0, le=1, description="1 if furnished, else 0.")


class FraudAnalysisResponse(BaseModel):
    """Explainable fraud risk result for a listing."""

    risk_score: int = Field(..., ge=0, le=100, description="Composite risk score from 0 to 100.")
    risk_level: str = Field(..., description="Risk band: low, medium, or high.")
    red_flags: List[str] = Field(default_factory=list, description="List of red flags identified.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score for the risk assessment.")
    model_version: str = Field(default="fraud-risk-v1", description="Version of the fraud risk engine.")


class DocumentForensicsRequest(BaseModel):
    """Input payload for automated document authenticity and fraud analysis."""

    document_type: str = Field(default="kebele_id", description="Type of document, e.g. kebele_id, fayda_id, title_deed")
    file_name: str = Field(..., description="Uploaded original file name")
    mime_type: str = Field(default="image/jpeg", description="MIME type of uploaded file")
    file_size_bytes: int = Field(default=250000, description="File size in bytes")
    account_legal_name: str = Field(..., description="Registered account legal name for consistency check")
    metadata: dict = Field(default_factory=dict, description="Optional document metadata")


class DocumentForensicsResponse(BaseModel):
    """Comprehensive forensic report on document authenticity."""

    authenticityScore: int = Field(..., ge=0, le=100, description="Overall authenticity score 0-100")
    verdict: str = Field(..., description="'authentic', 'review_recommended', or 'suspected_counterfeit'")
    confidence: float = Field(default=0.94)
    summary: str
    detectedName: str
    nameMatchScore: int = Field(..., ge=0, le=100)
    checks: dict
    extractedData: dict
    redFlags: List[str] = Field(default_factory=list)

