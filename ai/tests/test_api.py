"""Comprehensive test suite for HomeLink AI FastAPI service.

Tests cover:
- Health check endpoint (GET /)
- Rent estimation (POST /api/v1/estimate-rent)
- Property recommendation (POST /api/v1/recommend)
- Fraud detection (POST /api/v1/detect-fraud)
- Pydantic validation edge cases (422 Unprocessable Entity responses)

Run with:
    pytest ai/tests/test_api.py -v
or
    .venv\Scripts\pytest ai/tests/test_api.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

# Create test client for the FastAPI app
client = TestClient(app)


class TestHealthCheck:
    """Tests for the health check endpoint."""

    def test_get_root_health_check(self) -> None:
        """Test GET / returns 200 with online status."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "online"
        assert "service" in data
        assert "HomeLink AI Engine" in data["service"]


class TestRentEstimation:
    """Tests for the rent estimation endpoint."""

    def test_estimate_rent_valid_input(self) -> None:
        """Test POST /api/v1/estimate-rent with valid housing payload."""
        payload = {
            "subcity": "bole",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 85.5,
            "has_water_tank": True,
            "has_generator": False,
            "is_furnished": True,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 200

        data = response.json()
        # Verify response structure
        assert "estimated_rent_etb" in data
        assert "confidence" in data
        assert "model_used" in data
        assert "input_summary" in data

        # Verify data types and ranges
        assert isinstance(data["estimated_rent_etb"], (int, float))
        assert data["estimated_rent_etb"] > 0
        assert isinstance(data["confidence"], (int, float))
        assert 0.0 <= data["confidence"] <= 1.0
        assert isinstance(data["model_used"], str)
        assert data["model_used"] in ["rent_model.joblib", "heuristic-baseline"]

        # Verify input echo
        assert data["input_summary"]["subcity"] == "bole"
        assert data["input_summary"]["bedrooms"] == 2
        assert data["input_summary"]["area_sqm"] == 85.5

    def test_estimate_rent_minimal_input(self) -> None:
        """Test POST /api/v1/estimate-rent with only required fields."""
        payload = {
            "subcity": "kolfe",
            "bedrooms": 1,
            "bathrooms": 1,
            "area_sqm": 50.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["estimated_rent_etb"] > 0
        assert 0.0 <= data["confidence"] <= 1.0

    def test_estimate_rent_different_subcities(self) -> None:
        """Test rent estimation across different Addis Ababa subcities."""
        subcities = ["bole", "nifas silk lafto", "yeka", "addis ketema"]
        for subcity in subcities:
            payload = {
                "subcity": subcity,
                "bedrooms": 2,
                "bathrooms": 1,
                "area_sqm": 75.0,
            }
            response = client.post("/api/v1/estimate-rent", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["estimated_rent_etb"] > 0

    def test_estimate_rent_large_property(self) -> None:
        """Test rent estimation for a large property."""
        payload = {
            "subcity": "bole",
            "bedrooms": 5,
            "bathrooms": 3,
            "area_sqm": 250.0,
            "has_water_tank": True,
            "has_generator": True,
            "is_furnished": True,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["estimated_rent_etb"] > 0

    def test_estimate_rent_negative_area_validation_error(self) -> None:
        """Test that negative area_sqm triggers 422 Unprocessable Entity."""
        payload = {
            "subcity": "bole",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": -50.0,  # Invalid: must be > 0
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422
        error = response.json()
        assert "detail" in error

    def test_estimate_rent_zero_area_validation_error(self) -> None:
        """Test that zero area_sqm triggers 422 Unprocessable Entity."""
        payload = {
            "subcity": "bole",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 0.0,  # Invalid: must be > 0
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422

    def test_estimate_rent_negative_bedrooms_validation_error(self) -> None:
        """Test that negative bedrooms triggers 422 Unprocessable Entity."""
        payload = {
            "subcity": "bole",
            "bedrooms": -1,  # Invalid: must be >= 0
            "bathrooms": 1,
            "area_sqm": 50.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422

    def test_estimate_rent_missing_required_field(self) -> None:
        """Test that missing required field triggers 422 Unprocessable Entity."""
        payload = {
            "subcity": "bole",
            "bedrooms": 2,
            # Missing bathrooms and area_sqm
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422


class TestRecommendation:
    """Tests for the property recommendation endpoint."""

    def test_recommend_valid_input(self) -> None:
        """Test POST /api/v1/recommend with valid budget and subcity."""
        payload = {
            "user_id": "tenant-001",
            "max_budget": 15000.0,
            "preferred_subcity": "bole",
            "top_k": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200

        data = response.json()
        # Verify response structure
        assert "user_id" in data
        assert "total_matches" in data
        assert "recommendations" in data

        # Verify user_id echo
        assert data["user_id"] == "tenant-001"

        # Verify recommendations structure
        if data["total_matches"] > 0:
            for rec in data["recommendations"]:
                assert "property_id" in rec
                assert "match_score" in rec
                assert "explanation" in rec
                assert "details" in rec
                assert isinstance(rec["match_score"], (int, float))
                assert 0.0 <= rec["match_score"] <= 100.0
                assert isinstance(rec["explanation"], str)

    def test_recommend_without_preferred_subcity(self) -> None:
        """Test recommendation without specifying preferred subcity."""
        payload = {
            "user_id": "tenant-002",
            "max_budget": 20000.0,
            "top_k": 3,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["user_id"] == "tenant-002"
        assert isinstance(data["total_matches"], int)

    def test_recommend_different_budgets(self) -> None:
        """Test recommendations for various budget levels."""
        budgets = [5000.0, 10000.0, 25000.0, 50000.0]
        for budget in budgets:
            payload = {
                "user_id": f"tenant-budget-{budget}",
                "max_budget": budget,
                "top_k": 5,
            }
            response = client.post("/api/v1/recommend", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["user_id"] == f"tenant-budget-{budget}"

    def test_recommend_top_k_limit(self) -> None:
        """Test that top_k parameter is respected."""
        payload = {
            "user_id": "tenant-topk",
            "max_budget": 15000.0,
            "top_k": 3,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert len(data["recommendations"]) <= 3

    def test_recommend_negative_budget_validation_error(self) -> None:
        """Test that negative max_budget triggers 422 Unprocessable Entity."""
        payload = {
            "user_id": "tenant-invalid",
            "max_budget": -5000.0,  # Invalid: must be > 0
            "top_k": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_zero_budget_validation_error(self) -> None:
        """Test that zero max_budget triggers 422 Unprocessable Entity."""
        payload = {
            "user_id": "tenant-invalid",
            "max_budget": 0.0,  # Invalid: must be > 0
            "top_k": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_invalid_top_k_validation_error(self) -> None:
        """Test that invalid top_k triggers 422 Unprocessable Entity."""
        payload = {
            "user_id": "tenant-invalid",
            "max_budget": 15000.0,
            "top_k": 0,  # Invalid: must be >= 1
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_missing_required_field(self) -> None:
        """Test that missing required field triggers 422 Unprocessable Entity."""
        payload = {
            # Missing user_id and max_budget
            "top_k": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422


class TestFraudDetection:
    """Tests for the fraud detection endpoint."""

    def test_detect_fraud_valid_clean_listing(self) -> None:
        """Test POST /api/v1/detect-fraud with a clean listing."""
        payload = {
            "listing_id": "prop-001",
            "price_etb": 12000.0,
            "area_sqm": 80.0,
            "description_text": "Well-maintained 2-bedroom apartment in Bole with water and electricity. Quiet and safe area.",
            "subcity": "bole",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200

        data = response.json()
        # Verify response structure
        assert "listing_id" in data
        assert "fraud_risk_score" in data
        assert "is_flagged" in data
        assert "risk_indicators" in data
        assert "score_breakdown" in data

        # Verify data types and ranges
        assert data["listing_id"] == "prop-001"
        assert isinstance(data["fraud_risk_score"], (int, float))
        assert 0.0 <= data["fraud_risk_score"] <= 1.0
        assert isinstance(data["is_flagged"], bool)
        assert isinstance(data["risk_indicators"], list)

    def test_detect_fraud_suspicious_listing(self) -> None:
        """Test fraud detection with suspicious/scam text indicators."""
        payload = {
            "listing_id": "prop-suspicious",
            "price_etb": 2000.0,  # Suspiciously low for premium location
            "area_sqm": 150.0,
            "description_text": "URGENT! Amazing deal! Too good to be true! Act now before it's gone! Deposit first!",
            "subcity": "bole",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data["fraud_risk_score"], (int, float))
        assert 0.0 <= data["fraud_risk_score"] <= 1.0
        # Suspicious listing should have higher fraud score
        # (may or may not be flagged depending on threshold)
        assert isinstance(data["is_flagged"], bool)

    def test_detect_fraud_various_descriptions(self) -> None:
        """Test fraud detection with various description types."""
        descriptions = [
            "Standard apartment listing with normal description.",
            "Premium furnished apartment with all amenities.",
            "Budget option, basic facilities but clean.",
            "",  # Empty description
        ]
        for desc in descriptions:
            payload = {
                "listing_id": f"prop-desc-{hash(desc) % 10000}",
                "price_etb": 10000.0,
                "area_sqm": 70.0,
                "description_text": desc,
                "subcity": "addis ketema",
            }
            response = client.post("/api/v1/detect-fraud", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert 0.0 <= data["fraud_risk_score"] <= 1.0

    def test_detect_fraud_without_description(self) -> None:
        """Test fraud detection when description is omitted (defaults to empty string)."""
        payload = {
            "listing_id": "prop-no-desc",
            "price_etb": 9500.0,
            "area_sqm": 65.0,
            # description_text omitted
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert 0.0 <= data["fraud_risk_score"] <= 1.0

    def test_detect_fraud_without_subcity(self) -> None:
        """Test fraud detection when optional subcity is omitted."""
        payload = {
            "listing_id": "prop-no-subcity",
            "price_etb": 11000.0,
            "area_sqm": 75.0,
            "description_text": "A normal listing without subcity info.",
            # subcity omitted
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert 0.0 <= data["fraud_risk_score"] <= 1.0

    def test_detect_fraud_negative_price_validation_error(self) -> None:
        """Test that negative price_etb triggers 422 Unprocessable Entity."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": -5000.0,  # Invalid: must be > 0
            "area_sqm": 80.0,
            "description_text": "Invalid listing",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_zero_price_validation_error(self) -> None:
        """Test that zero price_etb triggers 422 Unprocessable Entity."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 0.0,  # Invalid: must be > 0
            "area_sqm": 80.0,
            "description_text": "Invalid listing",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_negative_area_validation_error(self) -> None:
        """Test that negative area_sqm triggers 422 Unprocessable Entity."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": -50.0,  # Invalid: must be > 0
            "description_text": "Invalid listing",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_zero_area_validation_error(self) -> None:
        """Test that zero area_sqm triggers 422 Unprocessable Entity."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": 0.0,  # Invalid: must be > 0
            "description_text": "Invalid listing",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_missing_listing_id_validation_error(self) -> None:
        """Test that missing listing_id triggers 422 Unprocessable Entity."""
        payload = {
            # Missing listing_id
            "price_etb": 10000.0,
            "area_sqm": 80.0,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_empty_listing_id_validation_error(self) -> None:
        """Test that empty listing_id triggers 422 Unprocessable Entity."""
        payload = {
            "listing_id": "",  # Invalid: min_length=1
            "price_etb": 10000.0,
            "area_sqm": 80.0,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_continuous_score_range(self) -> None:
        """Test that fraud scores form a continuous range across listings."""
        scores = []
        for i in range(5):
            payload = {
                "listing_id": f"prop-score-{i}",
                "price_etb": 8000.0 + (i * 2000),
                "area_sqm": 60.0 + (i * 10),
                "description_text": f"Test listing {i}",
            }
            response = client.post("/api/v1/detect-fraud", json=payload)
            assert response.status_code == 200
            data = response.json()
            scores.append(data["fraud_risk_score"])

        # Verify all scores are in valid range
        for score in scores:
            assert 0.0 <= score <= 1.0


class TestErrorHandling:
    """Tests for error handling and edge cases."""

    def test_malformed_json_request(self) -> None:
        """Test that malformed JSON triggers 422 or 400 error."""
        response = client.post(
            "/api/v1/estimate-rent",
            content="{invalid json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in [400, 422]

    def test_estimate_rent_extra_fields_ignored(self) -> None:
        """Test that extra fields in request are ignored (Pydantic default)."""
        payload = {
            "subcity": "bole",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 80.0,
            "extra_field": "should be ignored",
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 200

    def test_recommend_extra_fields_ignored(self) -> None:
        """Test that extra fields in recommendation request are ignored."""
        payload = {
            "user_id": "tenant-001",
            "max_budget": 15000.0,
            "extra_ignored_field": "ignored",
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200

    def test_fraud_detect_extra_fields_ignored(self) -> None:
        """Test that extra fields in fraud request are ignored."""
        payload = {
            "listing_id": "prop-001",
            "price_etb": 10000.0,
            "area_sqm": 80.0,
            "unknown_field": "ignored",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
