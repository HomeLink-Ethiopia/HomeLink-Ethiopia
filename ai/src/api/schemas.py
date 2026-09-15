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
