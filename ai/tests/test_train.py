"""Tests for the unified training pipeline (ai/src/train.py).

Verifies:
- Full pipeline runs without error on a small sample.
- ``model_manifest.json`` is generated with a valid schema and non-null metrics.
- Saved ``.joblib`` artefacts are loadable and produce valid predictions.

Run from ``ai/``::

    pytest tests/test_train.py -v
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

AI_DIR = Path(__file__).resolve().parents[1]
MANIFEST_PATH = AI_DIR / "models" / "model_manifest.json"
RENT_MODEL_PATH = AI_DIR / "models" / "rent_model.joblib"
FRAUD_MODEL_PATH = AI_DIR / "models" / "fraud_model.joblib"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_SIZE = 200


@pytest.fixture(scope="module")
def manifest() -> dict:
    """Run the training pipeline once (module-scoped) and return the manifest."""
    from src.train import main
    return main(sample=SAMPLE_SIZE)


# ---------------------------------------------------------------------------
# Pipeline execution
# ---------------------------------------------------------------------------


class TestPipelineExecution:
    """Verify the pipeline runs end-to-end without error."""

    def test_main_returns_manifest_dict(self, manifest: dict) -> None:
        """``main()`` should return a non-empty dict."""
        assert isinstance(manifest, dict)
        assert len(manifest) > 0

    def test_manifest_file_written(self) -> None:
        """``model_manifest.json`` should exist on disk after a run."""
        assert MANIFEST_PATH.exists(), f"{MANIFEST_PATH} not found"


# ---------------------------------------------------------------------------
# Manifest schema
# ---------------------------------------------------------------------------


class TestManifestSchema:
    """Verify the manifest has the required top-level keys and structure."""

    def test_schema_version(self, manifest: dict) -> None:
        assert manifest.get("schema_version") == "1.0"

    def test_generated_at_is_iso(self, manifest: dict) -> None:
        ts = manifest.get("generated_at", "")
        assert "T" in ts, "generated_at should be ISO 8601"

    def test_dataset_section(self, manifest: dict) -> None:
        ds = manifest.get("dataset", {})
        assert "sha256" in ds and len(ds["sha256"]) == 64
        assert ds.get("rows", 0) > 0
        assert ds.get("columns", 0) > 0
        assert isinstance(ds.get("column_names"), list)

    def test_training_config(self, manifest: dict) -> None:
        cfg = manifest.get("training_config", {})
        assert cfg.get("random_state") == 42
        assert cfg.get("test_size") == 0.2

    def test_rent_model_section(self, manifest: dict) -> None:
        rm = manifest.get("rent_model", {})
        assert rm.get("version", "").startswith("rent-")
        assert rm.get("artifact") == "rent_model.joblib"
        assert "algorithm" in rm
        assert "hyperparameters" in rm
        assert isinstance(rm.get("feature_columns"), list)

    def test_rent_model_metrics(self, manifest: dict) -> None:
        metrics = manifest.get("rent_model", {}).get("metrics", {})
        assert "test_mae" in metrics and metrics["test_mae"] > 0
        assert "test_rmse" in metrics and metrics["test_rmse"] > 0
        assert "test_r2" in metrics and 0 < metrics["test_r2"] <= 1.0

    def test_baseline_comparison(self, manifest: dict) -> None:
        bc = manifest.get("rent_model", {}).get("baseline_comparison", {})
        bl = bc.get("median_baseline", {})
        assert bl.get("test_mae", 0) > 0
        assert bc.get("mae_reduction_pct", 0) > 0, "ML should beat baseline"

    def test_fraud_model_section(self, manifest: dict) -> None:
        fm = manifest.get("fraud_model", {})
        assert fm.get("version", "").startswith("fraud-")
        assert fm.get("artifact") == "fraud_model.joblib"
        assert "metrics" in fm
        fm_metrics = fm["metrics"]
        assert fm_metrics.get("n_training_samples", 0) > 0
        assert fm_metrics.get("tfidf_vocabulary_size", 0) > 0


# ---------------------------------------------------------------------------
# Artefact validity
# ---------------------------------------------------------------------------


class TestArtefactValidity:
    """Verify saved models are loadable and produce valid predictions."""

    def test_rent_model_loadable(self) -> None:
        """``rent_model.joblib`` should load as a scikit-learn Pipeline."""
        pipeline = joblib.load(RENT_MODEL_PATH)
        assert hasattr(pipeline, "predict")

    def test_rent_model_predicts(self) -> None:
        """The rent model should return a numeric prediction for valid input."""
        pipeline = joblib.load(RENT_MODEL_PATH)
        row = pd.DataFrame([{
            "subcity": "bole",
            "bedrooms": 2,
            "bathrooms": 1,
            "area_sqm": 85.0,
            "has_water_tank": 0,
            "has_generator": 0,
            "is_furnished": 0,
        }])
        pred = pipeline.predict(row)
        assert pred.shape == (1,)
        assert float(pred[0]) > 0, "Prediction should be positive ETB"

    def test_fraud_model_loadable(self) -> None:
        """``fraud_model.joblib`` should load with required keys."""
        bundle = joblib.load(FRAUD_MODEL_PATH)
        required = {
            "isolation_forest",
            "train_decision_scores",
            "tfidf",
            "benign_centroid",
            "suspicious_centroid",
        }
        assert required.issubset(bundle.keys())

    def test_fraud_model_tabular_score(self) -> None:
        """IsolationForest should produce a score_samples output."""
        bundle = joblib.load(FRAUD_MODEL_PATH)
        forest = bundle["isolation_forest"]
        row = np.array([[25000.0, 100.0, 250.0, 9]], dtype=np.float64)
        score = forest.score_samples(row)
        assert score.shape == (1,)
        assert isinstance(float(score[0]), float)
