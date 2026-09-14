"""Live recommendation endpoint test script."""
import sys
import json
import warnings

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, ".")
warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

payload = {
    "max_budget_etb": 45000.0,
    "preferred_subcities": ["Bole", "Kirkos"],
    "min_bedrooms": 2,
    "min_bathrooms": 1,
    "require_furnished": False,
    "limit": 5,
    "candidate_properties": [
        {"property_id": "P001", "price_etb": 42000, "bedrooms": 2, "bathrooms": 1,
         "subcity": "bole",   "area_sqm": 90,  "is_furnished": False},
        {"property_id": "P002", "price_etb": 38000, "bedrooms": 3, "bathrooms": 2,
         "subcity": "kirkos", "area_sqm": 110, "is_furnished": True},
        {"property_id": "P003", "price_etb": 55000, "bedrooms": 2, "bathrooms": 1,
         "subcity": "bole",   "area_sqm": 95,  "is_furnished": True},
        {"property_id": "P004", "price_etb": 28000, "bedrooms": 1, "bathrooms": 1,
         "subcity": "yeka",   "area_sqm": 60,  "is_furnished": False},
        {"property_id": "P005", "price_etb": 44500, "bedrooms": 2, "bathrooms": 2,
         "subcity": "bole",   "area_sqm": 100, "is_furnished": False},
    ],
}

r = client.post("/api/v1/recommend", json=payload)
data = r.json()

print("Status:", r.status_code)
print("Total Candidates Evaluated:", data.get("total_candidates_evaluated"))
print("Model Version:", data.get("model_version"))
print("=" * 60)

for rec in data.get("recommendations", []):
    score = rec["match_score"]
    pid   = rec["property_id"]
    print(f"  [{score:5.1f}/100] {pid}")
    for reason in rec.get("match_reasons", []):
        print(f"          - {reason}")
    print()
