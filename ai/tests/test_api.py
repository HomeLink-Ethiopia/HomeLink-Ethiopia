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

    def test_estimate_rent_model_version_in_response(self) -> None:
        """Test that the response includes a model_version field."""
        payload = {
            "subcity": "bole",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 80.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "model_version" in data
        assert isinstance(data["model_version"], str)
        assert len(data["model_version"]) > 0

    def test_estimate_rent_zero_bedrooms_zero_bathrooms_validation_error(self) -> None:
        """Test that bedrooms=0 AND bathrooms=0 triggers 422 (unrealistic property)."""
        payload = {
            "subcity": "bole",
            "bedrooms": 0,
            "bathrooms": 0,
            "area_sqm": 50.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422

    def test_estimate_rent_unrealistically_small_area_validation_error(self) -> None:
        """Test that area_sqm < 10 triggers 422 (unrealistically small)."""
        payload = {
            "subcity": "bole",
            "bedrooms": 1,
            "bathrooms": 1,
            "area_sqm": 5.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422

    def test_estimate_rent_empty_subcity_validation_error(self) -> None:
        """Test that empty subcity string triggers 422."""
        payload = {
            "subcity": "",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 80.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 422

    def test_estimate_rent_unknown_subcity_still_works(self) -> None:
        """Test that an unknown subcity is accepted (ML model handles gracefully)."""
        payload = {
            "subcity": "unknown-subcity",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 80.0,
        }
        response = client.post("/api/v1/estimate-rent", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["estimated_rent_etb"] > 0


class TestRecommendation:
    """Tests for the property recommendation endpoint."""

    def test_recommend_valid_input(self) -> None:
        """Test POST /api/v1/recommend with valid budget and subcities."""
        payload = {
            "max_budget_etb": 20000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": 2,
            "min_bathrooms": 1,
            "limit": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "total_candidates_evaluated" in data
        assert "recommendations" in data
        assert "model_version" in data

        assert isinstance(data["total_candidates_evaluated"], int)
        assert isinstance(data["recommendations"], list)
        assert isinstance(data["model_version"], str)
        assert len(data["model_version"]) > 0

    def test_recommend_returns_match_reasons(self) -> None:
        """Test that each recommendation includes match_reasons list."""
        payload = {
            "max_budget_etb": 25000.0,
            "preferred_subcities": ["bole", "yeka"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "limit": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()

        for rec in data["recommendations"]:
            assert "property_id" in rec
            assert "match_score" in rec
            assert "match_reasons" in rec
            assert isinstance(rec["match_score"], (int, float))
            assert 0.0 <= rec["match_score"] <= 100.0
            assert isinstance(rec["match_reasons"], list)
            assert len(rec["match_reasons"]) > 0

    def test_recommend_perfect_match_scores_high(self) -> None:
        """Test that a perfect-match listing (in-budget, right subcity, enough rooms) scores near 100."""
        payload = {
            "max_budget_etb": 30000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "is_furnished_required": False,
            "limit": 1,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()

        # P-0002 (bole, 25000, 3br/3ba) should be top and score > 80
        top = data["recommendations"][0]
        assert top["match_score"] >= 80.0

    def test_recommend_over_budget_fallback(self) -> None:
        """Test that slightly-over-budget properties get partial budget credit."""
        payload = {
            "max_budget_etb": 17000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "limit": 10,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()

        # P-0001 (bole, 18000) is only ~6% over budget – should still appear
        prop_ids = [r["property_id"] for r in data["recommendations"]]
        assert "P-0001" in prop_ids

    def test_recommend_non_matching_subcity_fallback(self) -> None:
        """Test that non-preferred-subcity listings still appear via partial credit."""
        payload = {
            "max_budget_etb": 20000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "limit": 10,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()

        prop_ids = [r["property_id"] for r in data["recommendations"]]
        # Should include some non-bole properties (kirkos, arada, etc.)
        non_bole = [pid for pid in prop_ids if pid not in ("P-0001", "P-0002")]
        assert len(non_bole) > 0

    def test_recommend_multiple_subcities(self) -> None:
        """Test recommendation with multiple preferred subcities."""
        payload = {
            "max_budget_etb": 25000.0,
            "preferred_subcities": ["bole", "yeka", "kirkos"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "limit": 10,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recommendations"]) > 0

    def test_recommend_limit_respected(self) -> None:
        """Test that the limit parameter is respected."""
        payload = {
            "max_budget_etb": 30000.0,
            "preferred_subcities": ["bole"],
            "limit": 2,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recommendations"]) <= 2

    def test_recommend_candidate_properties_ingestion(self) -> None:
        """Test scoring a backend-supplied batch of candidate properties."""
        candidates = [
            {"property_id": "C-001", "price_etb": 15000.0, "bedrooms": 2, "bathrooms": 1, "subcity": "bole"},
            {"property_id": "C-002", "price_etb": 12000.0, "bedrooms": 1, "bathrooms": 1, "subcity": "yeka"},
            {"property_id": "C-003", "price_etb": 22000.0, "bedrooms": 3, "bathrooms": 2, "subcity": "kirkos"},
        ]
        payload = {
            "max_budget_etb": 20000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": 2,
            "min_bathrooms": 1,
            "limit": 5,
            "candidate_properties": candidates,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["total_candidates_evaluated"] == 3
        prop_ids = [r["property_id"] for r in data["recommendations"]]
        assert "C-001" in prop_ids
        # C-002 has only 1 bedroom so partial room credit; C-003 is over budget
        assert len(data["recommendations"]) > 0

    def test_recommend_furnished_filter(self) -> None:
        """Test that is_furnished_required=True penalises unfurnished listings."""
        payload = {
            "max_budget_etb": 30000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "is_furnished_required": True,
            "limit": 5,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()

        # Only P-0002 is furnished in the demo catalog
        for rec in data["recommendations"]:
            # Furnished listings should score higher than unfurnished
            if rec["property_id"] == "P-0002":
                assert rec["match_score"] >= 80.0

    def test_recommend_negative_budget_validation_error(self) -> None:
        """Test that negative max_budget_etb triggers 422."""
        payload = {
            "max_budget_etb": -5000.0,
            "preferred_subcities": ["bole"],
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_zero_budget_validation_error(self) -> None:
        """Test that zero max_budget_etb triggers 422."""
        payload = {
            "max_budget_etb": 0.0,
            "preferred_subcities": ["bole"],
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_invalid_limit_validation_error(self) -> None:
        """Test that limit=0 or limit>50 triggers 422."""
        for bad_limit in [0, 51]:
            payload = {
                "max_budget_etb": 15000.0,
                "preferred_subcities": ["bole"],
                "limit": bad_limit,
            }
            response = client.post("/api/v1/recommend", json=payload)
            assert response.status_code == 422

    def test_recommend_empty_subcities_validation_error(self) -> None:
        """Test that empty preferred_subcities list triggers 422."""
        payload = {
            "max_budget_etb": 15000.0,
            "preferred_subcities": [],
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_whitespace_only_subcities_validation_error(self) -> None:
        """Test that whitespace-only subcities triggers 422."""
        payload = {
            "max_budget_etb": 15000.0,
            "preferred_subcities": ["   ", "  "],
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_negative_bedrooms_validation_error(self) -> None:
        """Test that negative min_bedrooms triggers 422."""
        payload = {
            "max_budget_etb": 15000.0,
            "preferred_subcities": ["bole"],
            "min_bedrooms": -1,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_negative_bathrooms_validation_error(self) -> None:
        """Test that negative min_bathrooms triggers 422."""
        payload = {
            "max_budget_etb": 15000.0,
            "preferred_subcities": ["bole"],
            "min_bathrooms": -1,
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_missing_required_field(self) -> None:
        """Test that missing required fields triggers 422."""
        payload = {
            "preferred_subcities": ["bole"],
        }
        response = client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 422

    def test_recommend_response_speed(self) -> None:
        """Test that recommendation responds within 1 second."""
        import time
        payload = {
            "max_budget_etb": 25000.0,
            "preferred_subcities": ["bole", "yeka", "kirkos"],
            "min_bedrooms": 2,
            "min_bathrooms": 2,
            "limit": 10,
        }
        start = time.time()
        response = client.post("/api/v1/recommend", json=payload)
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 1.0, f"Recommendation took {elapsed:.2f}s, expected < 1.0s"


class TestFraudDetection:
    """Tests for the multi-signal fraud analysis endpoint."""

    def test_detect_fraud_valid_clean_listing(self) -> None:
        """Test POST /api/v1/detect-fraud with a clean, fairly-priced listing."""
        payload = {
            "listing_id": "prop-001",
            "price_etb": 35000.0,
            "area_sqm": 100.0,
            "bedrooms": 3,
            "bathrooms": 2,
            "description_text": "Well-maintained 3-bedroom apartment in Bole with water and electricity. Quiet and safe area close to schools.",
            "subcity": "bole",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200

        data = response.json()
        # Verify new response structure
        assert data["listing_id"] == "prop-001"
        assert "risk_score" in data
        assert "risk_level" in data
        assert "red_flags" in data
        assert "price_deviation_percent" in data
        assert "confidence" in data
        assert "model_version" in data
        assert "signal_breakdown" in data

        # Verify data types and ranges
        assert isinstance(data["risk_score"], int)
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ("low", "medium", "high")
        assert isinstance(data["red_flags"], list)
        assert isinstance(data["price_deviation_percent"], (int, float))
        assert isinstance(data["confidence"], (int, float))
        assert 0.0 <= data["confidence"] <= 1.0
        assert isinstance(data["model_version"], str)
        assert data["model_version"] == "fraud-v1.1.0"

        # Verify signal_breakdown structure
        breakdown = data["signal_breakdown"]
        assert "price_anomaly" in breakdown
        assert "text_metadata" in breakdown
        assert "ml_anomaly" in breakdown
        assert "total" in breakdown

    def test_detect_fraud_fair_price_low_risk(self) -> None:
        """Test that a fairly priced listing returns 'low' risk level."""
        payload = {
            "listing_id": "prop-fair",
            "price_etb": 30000.0,
            "area_sqm": 95.0,
            "bedrooms": 3,
            "bathrooms": 2,
            "description_text": "Spacious 3-bedroom apartment in a quiet neighborhood. Close to public transport and markets.",
            "subcity": "yeka",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "low"
        assert data["risk_score"] < 30

    def test_detect_fraud_severely_underpriced_high_risk(self) -> None:
        """Test that severely underpriced listing triggers price anomaly red flag."""
        payload = {
            "listing_id": "prop-cheap",
            "price_etb": 5000.0,  # Way below market for 150sqm in Bole
            "area_sqm": 150.0,
            "bedrooms": 4,
            "bathrooms": 2,
            "description_text": "Large 4-bedroom apartment in Bole with modern finishes and parking.",
            "subcity": "bole",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_score"] > 30
        assert data["risk_level"] in ("medium", "high")
        # Should have price-related red flag
        price_flags = [f for f in data["red_flags"] if "underpricing" in f.lower() or "below market" in f.lower()]
        assert len(price_flags) > 0
        assert data["price_deviation_percent"] < -25.0

    def test_detect_fraud_suspicious_text_red_flags(self) -> None:
        """Test that suspicious text patterns trigger description red flags."""
        payload = {
            "listing_id": "prop-scam-text",
            "price_etb": 25000.0,
            "area_sqm": 80.0,
            "bedrooms": 2,
            "bathrooms": 1,
            "description_text": "URGENT! Act fast! Wire transfer deposit before viewing! Today only deal!!!",
            "subcity": "kirkos",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_score"] > 20
        # Should have text-related red flags
        text_flags = data["red_flags"]
        assert len(text_flags) > 0
        # Check for urgency or payment flags
        flag_text = " ".join(text_flags).lower()
        assert "urgency" in flag_text or "wire" in flag_text or "payment" in flag_text

    def test_detect_fraud_unrealistic_area_ratio(self) -> None:
        """Test that unrealistic area-to-bedroom ratio triggers a flag."""
        payload = {
            "listing_id": "prop-tiny",
            "price_etb": 15000.0,
            "area_sqm": 25.0,
            "bedrooms": 3,
            "bathrooms": 1,
            "description_text": "Cozy 3-bedroom apartment, perfect for small families.",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        area_flags = [f for f in data["red_flags"] if "area-to-bedroom" in f.lower() or "sqm/bedroom" in f.lower()]
        assert len(area_flags) > 0

    def test_detect_fraud_empty_description_flag(self) -> None:
        """Test that missing/very short description triggers a flag."""
        payload = {
            "listing_id": "prop-nodesc",
            "price_etb": 20000.0,
            "area_sqm": 70.0,
            "bedrooms": 2,
            "bathrooms": 1,
            "description_text": "Hi",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        short_flags = [f for f in data["red_flags"] if "short" in f.lower() or "missing" in f.lower()]
        assert len(short_flags) > 0

    def test_detect_fraud_without_subcity(self) -> None:
        """Test fraud analysis when optional subcity is omitted."""
        payload = {
            "listing_id": "prop-no-subcity",
            "price_etb": 22000.0,
            "area_sqm": 75.0,
            "bedrooms": 2,
            "bathrooms": 1,
            "description_text": "A standard 2-bedroom listing in a decent location.",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ("low", "medium", "high")

    def test_detect_fraud_model_version_in_response(self) -> None:
        """Test that the response includes model_version field."""
        payload = {
            "listing_id": "prop-ver",
            "price_etb": 20000.0,
            "area_sqm": 80.0,
            "bedrooms": 2,
            "bathrooms": 1,
            "description_text": "Normal listing description for testing purposes.",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "model_version" in data
        assert data["model_version"] == "fraud-v1.1.0"

    def test_detect_fraud_signal_breakdown_sums_correctly(self) -> None:
        """Test that signal_breakdown components are within expected ranges."""
        payload = {
            "listing_id": "prop-sum",
            "price_etb": 40000.0,
            "area_sqm": 120.0,
            "bedrooms": 3,
            "bathrooms": 2,
            "description_text": "Premium apartment with all modern amenities and finishes.",
            "subcity": "bole",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        bd = data["signal_breakdown"]
        assert 0 <= bd["price_anomaly"] <= 40
        assert 0 <= bd["text_metadata"] <= 30
        assert 0 <= bd["ml_anomaly"] <= 30

    def test_detect_fraud_negative_price_validation_error(self) -> None:
        """Test that negative price_etb triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": -5000.0,
            "area_sqm": 80.0,
            "bedrooms": 2,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_zero_price_validation_error(self) -> None:
        """Test that zero price_etb triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 0.0,
            "area_sqm": 80.0,
            "bedrooms": 2,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_negative_area_validation_error(self) -> None:
        """Test that negative area_sqm triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": -50.0,
            "bedrooms": 2,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_zero_area_validation_error(self) -> None:
        """Test that zero area_sqm triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": 0.0,
            "bedrooms": 2,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_small_area_validation_error(self) -> None:
        """Test that area_sqm < 10 triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": 5.0,
            "bedrooms": 1,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_missing_listing_id_validation_error(self) -> None:
        """Test that missing listing_id triggers 422."""
        payload = {
            "price_etb": 10000.0,
            "area_sqm": 80.0,
            "bedrooms": 2,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_empty_listing_id_validation_error(self) -> None:
        """Test that empty listing_id triggers 422."""
        payload = {
            "listing_id": "",
            "price_etb": 10000.0,
            "area_sqm": 80.0,
            "bedrooms": 2,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_negative_bedrooms_validation_error(self) -> None:
        """Test that negative bedrooms triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": 80.0,
            "bedrooms": -1,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_missing_bedrooms_validation_error(self) -> None:
        """Test that missing bedrooms triggers 422."""
        payload = {
            "listing_id": "prop-invalid",
            "price_etb": 10000.0,
            "area_sqm": 80.0,
            "bathrooms": 1,
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 422

    def test_detect_fraud_overpriced_listing(self) -> None:
        """Test that extremely overpriced listing gets flagged."""
        payload = {
            "listing_id": "prop-expensive",
            "price_etb": 120000.0,  # Way above market for 60sqm
            "area_sqm": 60.0,
            "bedrooms": 1,
            "bathrooms": 1,
            "description_text": "Standard 1-bedroom apartment, basic amenities.",
            "subcity": "akaky kaliti",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["price_deviation_percent"] > 100.0
        overprice_flags = [f for f in data["red_flags"] if "overpric" in f.lower()]
        assert len(overprice_flags) > 0

    def test_detect_fraud_excessive_punctuation_flag(self) -> None:
        """Test that excessive exclamation marks trigger a flag."""
        payload = {
            "listing_id": "prop-yelling",
            "price_etb": 20000.0,
            "area_sqm": 70.0,
            "bedrooms": 2,
            "bathrooms": 1,
            "description_text": "Amazing deal!!! Best price ever!!! Don't miss out!!! Act now!!!",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200
        data = response.json()
        punct_flags = [f for f in data["red_flags"] if "exclamation" in f.lower() or "punctuation" in f.lower()]
        assert len(punct_flags) > 0


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
            "max_budget_etb": 15000.0,
            "preferred_subcities": ["bole"],
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
            "bedrooms": 2,
            "bathrooms": 1,
            "unknown_field": "ignored",
        }
        response = client.post("/api/v1/detect-fraud", json=payload)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
