"""Train and persist a baseline rent-estimation model for Addis Ababa rental data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR = BASE_DIR / "models"
DOCS_DIR = BASE_DIR / "docs"
METRICS_PATH = DOCS_DIR / "rent_model_metrics.json"
MODEL_PATH = MODELS_DIR / "baseline_rent_model.joblib"

FEATURE_COLUMNS = ["subcity", "bedrooms", "bathrooms", "size_sqm", "furnished"]
TARGET_COLUMN = "price_etb"


def load_dataset() -> pd.DataFrame:
    """Load the cleaned dataset, falling back to the earlier processed export if needed."""
    for candidate in [
        DATA_DIR / "cleaned_rent_data.csv",
        DATA_DIR / "real_listings_cleaned.csv",
        DATA_DIR / "rentals_cleaned.csv",
    ]:
        if candidate.exists():
            return pd.read_csv(candidate)
    raise FileNotFoundError("No cleaned rent dataset found in ai/data/processed/")


def prepare_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """Return feature matrix and target series in the expected ML contract."""
    missing = [col for col in FEATURE_COLUMNS + [TARGET_COLUMN] if col not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    X = df[FEATURE_COLUMNS].copy()
    y = pd.to_numeric(df[TARGET_COLUMN], errors="coerce")
    X = X[y.notna()].copy()
    y = y[y.notna()].copy()
    return X.reset_index(drop=True), y.reset_index(drop=True)


def build_pipelines() -> Dict[str, Pipeline]:
    """Create the baseline model pipelines."""
    numeric_features = ["bedrooms", "bathrooms", "size_sqm", "furnished"]
    categorical_features = ["subcity"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    ridge_pipe = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", Ridge(random_state=42)),
        ]
    )

    forest_pipe = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", RandomForestRegressor(n_estimators=100, random_state=42)),
        ]
    )

    return {"ridge": ridge_pipe, "random_forest": forest_pipe}


def compute_metrics(y_true: pd.Series, y_pred: np.ndarray) -> Dict[str, float]:
    """Return MAE, RMSE, and R² for a prediction array."""
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def train_and_select_model() -> Dict[str, Any]:
    """Train the candidates, compare performance, and return the selection summary."""
    df = load_dataset()
    X, y = prepare_features(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    candidates = build_pipelines()
    results: Dict[str, Dict[str, Any]] = {}

    for name, pipeline in candidates.items():
        pipeline.fit(X_train, y_train)
        preds = pipeline.predict(X_test)
        results[name] = {
            "metrics": compute_metrics(y_test, preds),
            "model": pipeline,
        }

    best_name = min(
        results,
        key=lambda name: (
            -results[name]["metrics"]["r2"],
            results[name]["metrics"]["mae"],
        ),
    )
    best_model = results[best_name]["model"]

    metric_summary = {
        "models": {name: metrics["metrics"] for name, metrics in results.items()},
        "best_model": best_name,
        "metrics": {
            "best_model": best_name,
            "best_r2": results[best_name]["metrics"]["r2"],
            "best_mae": results[best_name]["metrics"]["mae"],
            "best_rmse": results[best_name]["metrics"]["rmse"],
        },
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, MODEL_PATH)
    with METRICS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(metric_summary, handle, indent=2)

    return metric_summary


def main() -> Dict[str, Any]:
    """Public entry point for training and artifact generation."""
    return train_and_select_model()


if __name__ == "__main__":
    metrics = main()
    print("\n=== BASELINE RENT MODEL TRAINING COMPLETED ===")
    print(f"Best Model: {metrics.get('best_model')}")
    print("Metrics Summary:")
    print(json.dumps(metrics.get("models"), indent=2))
