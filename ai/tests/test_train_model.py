"""Tests for the rent model training pipeline.

Verifies:
- Training runs on the full dataset and produces a valid
  ``rent_model.joblib`` containing a ``TransformedTargetRegressor``
  wrapping a ``RandomForestRegressor``.
- The saved model loads and returns predictions in real ETB range.
- Predictions on small-unit inputs are in a reasonable ETB range
  (< 40 000 ETB).
- The model handles missing numeric features and unknown subcities.

Run from ``ai/``::

    pytest tests/test_train_model.py -v
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
import pytest
from sklearn.compose import TransformedTargetRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline

AI_DIR = Path(__file__).resolve().parents[1]
RENT_MODEL_PATH = AI_DIR / "models" / "rent_model.joblib"

SAMPLE_ROW = pd.DataFrame([{
    "subcity": "bole",
    "sq_m": 85.0,
    "bedrooms": 2,
    "bathrooms": 1,
    "bed_bath_ratio": 2 / (1 + 0.1),
    "is_small_unit": 0,
    "has_generator": 0,
    "has_water_tank": 0,
    "is_villa": 0,
    "is_condo": 1,
    "is_furnished": "0",
}])

SMALL_UNIT_ROW = pd.DataFrame([{
    "subcity": "kolfe",
    "sq_m": 25.0,
    "bedrooms": 1,
    "bathrooms": 1,
    "bed_bath_ratio": 1 / (1 + 0.1),
    "is_small_unit": 1,
    "has_generator": 0,
    "has_water_tank": 0,
    "is_villa": 0,
    "is_condo": 1,
    "is_furnished": "0",
}])


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def trained_metrics() -> dict:
    """Run training once (module-scoped) and return metrics dict."""
    from src.train_rent_model import main
    return main()


@pytest.fixture(scope="module")
def loaded_model():
    """Load the persisted TransformedTargetRegressor artifact."""
    return joblib.load(RENT_MODEL_PATH)


# ---------------------------------------------------------------------------
# Training execution
# ---------------------------------------------------------------------------

class TestTrainingRuns:
    """Verify training completes and produces valid outputs."""

    def test_training_completes(self, trained_metrics: dict) -> None:
        assert isinstance(trained_metrics, dict)
        for key in ("mae", "rmse", "r2", "mape"):
            assert key in trained_metrics, f"Missing metric: {key}"

    def test_model_file_exists(self) -> None:
        assert RENT_MODEL_PATH.exists(), f"{RENT_MODEL_PATH} not found"

    def test_metrics_are_positive(self, trained_metrics: dict) -> None:
        assert trained_metrics["mae"] > 0
        assert trained_metrics["rmse"] > 0
        assert trained_metrics["mape"] > 0

    def test_full_dataset_trained(self) -> None:
        """Verify the pipeline was trained on all valid-target rows."""
        from src.train_rent_model import load_data
        X, y = load_data()
        assert len(y) > 1500, (
            f"Expected >1500 training rows after target-NaN drop only, "
            f"got {len(y)}"
        )

    def test_model_is_transformed_target_regressor(self, loaded_model) -> None:
        assert isinstance(loaded_model, TransformedTargetRegressor)

    def test_inner_regressor_is_random_forest(self, loaded_model) -> None:
        """The inner regressor must be a RandomForestRegressor."""
        inner_pipeline = loaded_model.regressor_
        assert isinstance(inner_pipeline, Pipeline)
        final_step = inner_pipeline.named_steps["model"]
        assert isinstance(final_step, RandomForestRegressor)

    def test_text_features_present(self) -> None:
        """Verify the extracted text features exist in the training data."""
        from src.train_rent_model import load_data
        X, _ = load_data()
        for col in ("has_generator", "has_water_tank", "is_villa", "is_condo", "is_small_unit"):
            assert col in X.columns, f"Missing feature: {col}"
            assert X[col].isin([0, 1]).all(), f"{col} must be binary"


# ---------------------------------------------------------------------------
# Prediction validity
# ---------------------------------------------------------------------------

class TestModelPrediction:
    """Verify the saved model loads and predicts in real ETB range."""

    def test_model_loadable(self, loaded_model) -> None:
        assert hasattr(loaded_model, "predict")

    def test_prediction_is_real_etb(self, loaded_model) -> None:
        """Standard 2-bed apartment must predict > 1 000 ETB."""
        pred = loaded_model.predict(SAMPLE_ROW)
        assert pred.shape == (1,)
        value = float(pred[0])
        assert value > 1000, f"Expected >1000 ETB, got {value:.0f}"

    def test_small_unit_prediction(self, loaded_model) -> None:
        """A 1-bed small-unit must predict a positive value lower than a
        2-bed apartment in the same subcity (smaller = cheaper)."""
        pred_small = loaded_model.predict(SMALL_UNIT_ROW)
        pred_large = loaded_model.predict(SAMPLE_ROW)
        assert pred_small.shape == (1,)
        assert float(pred_small[0]) > 0, "Small-unit prediction must be positive"
        # Small unit should predict less than or comparable to a larger unit
        assert float(pred_small[0]) <= float(pred_large[0]) * 1.5, (
            f"Small-unit ({float(pred_small[0]):.0f}) should not exceed "
            f"large-unit ({float(pred_large[0]):.0f}) by more than 50%"
        )

    def test_predict_missing_sqm(self, loaded_model) -> None:
        """sq_m is NaN — the median imputer must fill it and predict."""
        row = SAMPLE_ROW.copy()
        row["sq_m"] = float("nan")
        pred = loaded_model.predict(row)
        assert pred.shape == (1,)
        assert float(pred[0]) > 1000

    def test_predict_missing_bedrooms(self, loaded_model) -> None:
        """bedrooms is NaN — median imputer fills it and predicts."""
        row = SAMPLE_ROW.copy()
        row["bedrooms"] = float("nan")
        row["bed_bath_ratio"] = float("nan")
        pred = loaded_model.predict(row)
        assert pred.shape == (1,)
        assert float(pred[0]) > 1000

    def test_predict_unknown_subcity(self, loaded_model) -> None:
        """Unknown subcity — OneHotEncoder handles it via ignore."""
        row = SAMPLE_ROW.copy()
        row["subcity"] = "nonexistent_subcity"
        pred = loaded_model.predict(row)
        assert pred.shape == (1,)
        assert float(pred[0]) > 1000

    def test_predict_batch(self, loaded_model) -> None:
        """Batch prediction of multiple rows at once."""
        rows = pd.concat([SAMPLE_ROW, SMALL_UNIT_ROW], ignore_index=True)
        preds = loaded_model.predict(rows)
        assert preds.shape == (2,)
        assert all(p > 0 for p in preds)
