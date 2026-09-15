"""Train and persist the HomeLink rent estimation model on cleaned real market data.

Reads ``ai/data/processed/encoded_rentals.csv``, trains an ``XGBRegressor``
(XGBoost) to predict ``rent_price_etb`` (or ``price``) from numeric features
(``bedrooms``, ``bathrooms``, ``area_sqm``) and one-hot encoded ``subcity_*`` features.

Run from ``ai/``::

    python -m src.train_rent_model
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split
from xgboost import XGBRegressor

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

AI_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = AI_DIR / "data"
MODELS_DIR = AI_DIR / "models"
PRIMARY_DATA_PATH = DATA_DIR / "processed" / "encoded_rentals.csv"
FALLBACK_DATA_PATH = DATA_DIR / "processed" / "cleaned_rentals.csv"

RENT_MODEL_PATH = MODELS_DIR / "rent_model.joblib"
METRICS_PATH = MODELS_DIR / "rent_model_metrics.json"

TARGET_CANDIDATES = ["rent_price_etb", "price", "price_etb"]
BASE_NUMERIC_FEATURES = ["bedrooms", "bathrooms", "area_sqm"]

MODEL_SEED = 42
TEST_SIZE = 0.2


def load_data(data_path: Path = PRIMARY_DATA_PATH) -> Tuple[pd.DataFrame, pd.Series, List[str]]:
    """Load the encoded real dataset and return feature matrix X, target y, and feature column names."""
    if not data_path.exists():
        if FALLBACK_DATA_PATH.exists():
            logger.info("Primary path %s not found, falling back to %s", data_path, FALLBACK_DATA_PATH)
            data_path = FALLBACK_DATA_PATH
        else:
            raise FileNotFoundError(f"Neither {data_path} nor {FALLBACK_DATA_PATH} exists.")

    data = pd.read_csv(data_path)

    # Determine target column
    target_col = None
    for candidate in TARGET_CANDIDATES:
        if candidate in data.columns:
            target_col = candidate
            break

    if target_col is None:
        raise ValueError(f"No target column found. Expected one of {TARGET_CANDIDATES}")

    # If dataset has subcity column as string, one-hot encode it
    if "subcity" in data.columns and not any(c.startswith("subcity_") for c in data.columns):
        data = pd.get_dummies(data, columns=["subcity"], prefix="subcity", prefix_sep="_", dtype=int)

    # Determine feature columns
    subcity_cols = sorted([col for col in data.columns if col.startswith("subcity_")])
    feature_cols = [c for c in BASE_NUMERIC_FEATURES if c in data.columns] + subcity_cols

    # Ensure all required features are present
    missing = [c for c in BASE_NUMERIC_FEATURES if c not in data.columns]
    if missing:
        raise ValueError(f"Missing required numeric feature columns: {missing}")

    # Drop missing or non-positive targets
    data = data.dropna(subset=[target_col] + feature_cols).copy()
    data[target_col] = pd.to_numeric(data[target_col], errors="coerce")
    data = data[data[target_col] > 0].copy()

    for col in feature_cols:
        data[col] = pd.to_numeric(data[col], errors="coerce")
    data = data.dropna(subset=feature_cols).copy()

    X = data[feature_cols].copy()
    y = data[target_col].astype(float)

    logger.info("Loaded %d rows with %d features from %s (target: %s)", len(X), len(feature_cols), data_path, target_col)
    return X, y, feature_cols


def train_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Tuple[XGBRegressor, Dict[str, Any]]:
    """Train XGBRegressor with tuned hyperparameters and evaluate metrics."""
    logger.info("Training XGBRegressor on %d samples...", len(X_train))

    model = XGBRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=MODEL_SEED,
        n_jobs=-1,
        verbosity=0,
    )

    # 5-fold cross validation on training set
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="r2")
    cv_r2_mean = float(cv_scores.mean())
    cv_r2_std = float(cv_scores.std())

    # Fit final model
    model.fit(X_train, y_train)

    # Predictions
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # Metrics
    train_r2 = float(r2_score(y_train, y_pred_train))
    test_r2 = float(r2_score(y_test, y_pred_test))
    train_mae = float(mean_absolute_error(y_train, y_pred_train))
    test_mae = float(mean_absolute_error(y_test, y_pred_test))
    train_rmse = float(np.sqrt(mean_squared_error(y_train, y_pred_train)))
    test_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))

    metrics = {
        "model_name": "XGBRegressor (Cleaned Market Data)",
        "cv_r2_mean": round(cv_r2_mean, 4),
        "cv_r2_std": round(cv_r2_std, 4),
        "train_r2": round(train_r2, 4),
        "test_r2": round(test_r2, 4),
        "train_mae": round(train_mae, 2),
        "test_mae": round(test_mae, 2),
        "train_rmse": round(train_rmse, 2),
        "test_rmse": round(test_rmse, 2),
        "hyperparameters": {
            "n_estimators": 200,
            "learning_rate": 0.05,
            "max_depth": 6,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "random_state": MODEL_SEED,
        },
    }

    return model, metrics


def main() -> Dict[str, Any]:
    """Execute training pipeline, evaluate, and save model artifact."""
    X, y, feature_cols = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=MODEL_SEED
    )
    logger.info("Dataset split: %d train samples, %d test samples", len(X_train), len(X_test))

    model, metrics = train_model(X_train, y_train, X_test, y_test)

    # Print evaluation metrics clearly to console
    print("\n" + "=" * 50)
    print("      RENT ESTIMATION MODEL EVALUATION METRICS    ")
    print("=" * 50)
    print(f"Algorithm:       {metrics['model_name']}")
    print(f"Train Samples:   {len(X_train)}")
    print(f"Test Samples:    {len(X_test)}")
    print(f"Features ({len(feature_cols)}):   {', '.join(feature_cols[:4])} ... + {len(feature_cols) - 4} subcities")
    print("-" * 50)
    print(f"5-Fold CV R2:    {metrics['cv_r2_mean']:.4f} (+/- {metrics['cv_r2_std']:.4f})")
    print(f"Holdout Test R2: {metrics['test_r2']:.4f}")
    print(f"Holdout Test MAE:ETB {metrics['test_mae']:,.2f}")
    print(f"Holdout Test RMSE:ETB {metrics['test_rmse']:,.2f}")
    print("=" * 50 + "\n")

    # Persist model artifact
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, RENT_MODEL_PATH)
    logger.info("Saved trained model artifact to %s", RENT_MODEL_PATH)

    # Persist metrics JSON
    metrics_payload = {
        "final_model": metrics,
        "feature_columns": feature_cols,
        "n_samples": len(X),
        "data_source": str(PRIMARY_DATA_PATH),
    }
    METRICS_PATH.write_text(json.dumps(metrics_payload, indent=2), encoding="utf-8")
    logger.info("Saved model metrics to %s", METRICS_PATH)

    return metrics


if __name__ == "__main__":
    main()
