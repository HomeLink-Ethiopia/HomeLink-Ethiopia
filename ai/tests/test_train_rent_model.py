import json
import sys
from pathlib import Path

import joblib
import pandas as pd

AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from src.models.train_rent_model import main


def test_train_rent_model_creates_model_and_metrics():
    metrics = main()

    model_path = AI_ROOT / "models" / "baseline_rent_model.joblib"
    metrics_path = AI_ROOT / "docs" / "rent_model_metrics.json"

    assert model_path.exists()
    assert metrics_path.exists()

    model = joblib.load(model_path)
    sample = pd.DataFrame([
        {
            "subcity": "Bole",
            "bedrooms": 2,
            "bathrooms": 2,
            "size_sqm": 90,
            "furnished": False,
        }
    ])

    prediction = model.predict(sample)

    assert isinstance(prediction, (list, tuple, pd.Series, object))
    assert len(prediction) == 1
    assert float(prediction[0]) > 0

    payload = json.loads(metrics_path.read_text(encoding="utf-8"))
    assert "models" in payload
    assert "best_model" in payload
    assert "metrics" in payload
    assert payload["best_model"] in payload["models"]
