from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_fair_listing_returns_low_risk():
    payload = {
        "title": "2BR apartment in Bole",
        "description": "Clean and spacious apartment in a safe neighborhood with water and electricity.",
        "price": 42000,
        "subcity": "bole",
        "bedrooms": 2,
        "bathrooms": 1,
        "size_sqm": 85,
        "furnished": 1,
    }
    response = client.post('/fraud/analyze', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['risk_score'] <= 30
    assert data['risk_level'] == 'low'
    assert data['red_flags'] == []


def test_suspicious_listing_returns_high_risk():
    payload = {
        "title": "Cheap 2BR in Bole",
        "description": "Urgent cash deal. Pay before viewing. Advance payment via Western Union to secure the apartment.",
        "price": 12000,
        "subcity": "bole",
        "bedrooms": 2,
        "bathrooms": 1,
        "size_sqm": 85,
        "furnished": 0,
    }
    response = client.post('/fraud/analyze', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['risk_score'] > 70
    assert data['risk_level'] == 'high'
    assert any('Price is suspiciously below estimated market rent' in flag for flag in data['red_flags'])
    assert any('Suspicious payment language detected in description' in flag for flag in data['red_flags'])


def test_invalid_payload_rejected_with_422():
    payload = {
        "title": "",
        "description": "A nice apartment",
        "price": -3000,
        "subcity": "bole",
        "bedrooms": 2,
        "bathrooms": 1,
        "size_sqm": 75,
        "furnished": 0,
    }
    response = client.post('/fraud/analyze', json=payload)
    assert response.status_code == 422
