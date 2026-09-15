from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoint_returns_service_status():
    response = client.get('/health')
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] in {'ok', 'healthy'}
    assert 'api_version' in payload or 'service' in payload


def test_rent_predict_returns_200_for_valid_payload():
    payload = {
        'subcity': 'Bole',
        'bedrooms': 2,
        'bathrooms': 1,
        'size_sqm': 80,
        'furnished': 1,
    }
    response = client.post('/rent/predict', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['currency'] == 'ETB'
    assert data['model_version'] == 'baseline-v1'
    assert data['estimated_market_rent'] > 0


def test_rent_predict_rejects_invalid_size():
    payload = {
        'subcity': 'Bole',
        'bedrooms': 2,
        'bathrooms': 1,
        'size_sqm': -50,
        'furnished': 0,
    }
    response = client.post('/rent/predict', json=payload)
    assert response.status_code == 422
