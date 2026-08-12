"""Train and persist the HomeLink rent estimation model.

Reads ``ai/data/ethiopia_housing_data.csv`` (produced by
``ai/src/generate_dataset.py``), trains a ``RandomForestRegressor`` to
predict ``rent_price_etb``, and saves the full preprocessing + model
pipeline to ``ai/models/rent_model.joblib``.

Includes:
- Baseline model comparison (LinearRegression vs RandomForestRegressor)
- Cross-validation for robust evaluation
- Hyperparameter search using GridSearchCV
- Comprehensive metrics (R², MAE, RMSE) saved to JSON

Run from ``ai/``:

    python -m src.train_rent_model

The saved pipeline is loaded by ``ai/src/rent_estimator.py`` to serve
live predictions through the FastAPI service.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

try:  # supports both `python -m src.train_rent_model` and direct execution
    from rent_estimator import (
        CATEGORICAL_FEATURE_COLUMNS,
        DATA_PATH,
        MODEL_FEATURE_COLUMNS,
        MODELS_DIR,
        NUMERIC_FEATURE_COLUMNS,
        TARGET_COLUMN,
    )
except ImportError:  # pragma: no cover - fallback for direct execution
    from src.rent_estimator import (
        CATEGORICAL_FEATURE_COLUMNS,
        DATA_PATH,
        MODEL_FEATURE_COLUMNS,
        MODELS_DIR,
        NUMERIC_FEATURE_COLUMNS,
        TARGET_COLUMN,
    )

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

RENT_MODEL_PATH = MODELS_DIR / "rent_model.joblib"
METRICS_PATH = MODELS_DIR / "rent_model_metrics.json"

MODEL_SEED = 42
TEST_SIZE = 0.2
N_ESTIMATORS = 300


def load_data(data_path: Path = DATA_PATH) -> tuple[pd.DataFrame, pd.Series]:
    """Load the CSV and split features from the target.

    The ``subcity`` column is normalised to lowercase so that requests
    coming into the service (also lowercased) match the trained
    one-hot categories regardless of casing.

    Args:
        data_path: Path to the generated housing CSV.

    Returns:
        A tuple ``(X, y)`` of features and target.
    """
    data = pd.read_csv(data_path)
    data["subcity"] = data["subcity"].astype(str).str.strip().str.lower()

    # Coerce boolean flags to 0/1 (handles both numeric and True/False CSVs).
    for column in ("has_water_tank", "has_generator", "is_furnished"):
        data[column] = (
            data[column].astype(str).str.strip().str.lower().map(
                lambda value: 1 if value in {"1", "true", "yes"} else 0
            )
        )

    missing = [col for col in MODEL_FEATURE_COLUMNS + [TARGET_COLUMN] if col not in data.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    X = data[MODEL_FEATURE_COLUMNS].copy()
    y = data[TARGET_COLUMN].astype(float)
    return X, y


def build_pipeline() -> Pipeline:
    """Build the preprocessing + RandomForest pipeline.

    Numeric features are passed through unchanged (tree models do not
    require scaling); ``subcity`` is one-hot encoded with unknown
    categories tolerated.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURE_COLUMNS),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURE_COLUMNS),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=MODEL_SEED, n_jobs=-1)),
        ]
    )


def build_baseline_pipeline() -> Pipeline:
    """Build a baseline LinearRegression pipeline for comparison."""
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURE_COLUMNS),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURE_COLUMNS),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", LinearRegression()),
        ]
    )


def evaluate_model(
    pipeline: Pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_name: str = "Model",
) -> dict:
    """Evaluate model on train and test sets with cross-validation.

    Args:
        pipeline: Fitted pipeline to evaluate
        X_train: Training features
        y_train: Training target
        X_test: Test features
        y_test: Test target
        model_name: Name of the model for logging

    Returns:
        Dictionary with evaluation metrics
    """
    # Cross-validation on training set
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring="r2")
    
    # Test set predictions
    y_pred_train = pipeline.predict(X_train)
    y_pred_test = pipeline.predict(X_test)

    # Calculate metrics
    train_r2 = r2_score(y_train, y_pred_train)
    test_r2 = r2_score(y_test, y_pred_test)
    
    train_mae = mean_absolute_error(y_train, y_pred_train)
    test_mae = mean_absolute_error(y_test, y_pred_test)
    
    train_rmse = float(np.sqrt(mean_squared_error(y_train, y_pred_train)))
    test_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))

    logger.info(f"\n{model_name} Evaluation:")
    logger.info(f"  Cross-Validation R² (mean ± std): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    logger.info(f"  Train R² = {train_r2:.4f}, Test R² = {test_r2:.4f}")
    logger.info(f"  Train MAE = ETB {train_mae:.0f}, Test MAE = ETB {test_mae:.0f}")
    logger.info(f"  Train RMSE = ETB {train_rmse:.0f}, Test RMSE = ETB {test_rmse:.0f}")

    return {
        "model_name": model_name,
        "cross_val_r2_mean": float(cv_scores.mean()),
        "cross_val_r2_std": float(cv_scores.std()),
        "train_r2": float(train_r2),
        "test_r2": float(test_r2),
        "train_mae": float(train_mae),
        "test_mae": float(test_mae),
        "train_rmse": float(train_rmse),
        "test_rmse": float(test_rmse),
    }


def main() -> None:
    """Train baseline and final models, evaluate with cross-validation, and persist."""
    X, y = load_data()
    logger.info("Loaded %d rows from %s", len(X), DATA_PATH)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=MODEL_SEED
    )
    logger.info("Split into %d train and %d test samples", len(X_train), len(X_test))

    # =====================================================================
    # BASELINE MODEL (LinearRegression)
    # =====================================================================
    logger.info("\n" + "=" * 70)
    logger.info("BASELINE MODEL: LinearRegression")
    logger.info("=" * 70)
    baseline_pipeline = build_baseline_pipeline()
    baseline_pipeline.fit(X_train, y_train)
    baseline_metrics = evaluate_model(baseline_pipeline, X_train, y_train, X_test, y_test, "LinearRegression Baseline")

    # =====================================================================
    # HYPERPARAMETER TUNING: GridSearchCV for RandomForestRegressor
    # =====================================================================
    logger.info("\n" + "=" * 70)
    logger.info("HYPERPARAMETER TUNING: RandomForestRegressor with GridSearchCV")
    logger.info("=" * 70)

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURE_COLUMNS),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURE_COLUMNS),
        ]
    )

    # Define parameter grid
    param_grid = {
        "model__n_estimators": [100, 300],
        "model__max_depth": [10, 20, None],
        "model__min_samples_split": [2, 5],
        "model__min_samples_leaf": [1, 2],
    }

    # GridSearchCV
    base_pipeline = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", RandomForestRegressor(random_state=MODEL_SEED, n_jobs=-1)),
        ]
    )
    
    grid_search = GridSearchCV(
        base_pipeline, param_grid, cv=5, scoring="r2", n_jobs=-1, verbose=1
    )
    grid_search.fit(X_train, y_train)

    logger.info(f"Best hyperparameters: {grid_search.best_params_}")
    logger.info(f"Best cross-validation R²: {grid_search.best_score_:.4f}")

    # =====================================================================
    # FINAL MODEL: RandomForestRegressor with best hyperparameters
    # =====================================================================
    logger.info("\n" + "=" * 70)
    logger.info("FINAL MODEL: RandomForestRegressor (tuned)")
    logger.info("=" * 70)
    final_pipeline = grid_search.best_estimator_
    final_metrics = evaluate_model(final_pipeline, X_train, y_train, X_test, y_test, "RandomForestRegressor (Tuned)")

    # =====================================================================
    # MODEL COMPARISON & SELECTION
    # =====================================================================
    logger.info("\n" + "=" * 70)
    logger.info("MODEL COMPARISON")
    logger.info("=" * 70)
    logger.info(f"Baseline (LinearRegression) Test R²: {baseline_metrics['test_r2']:.4f}")
    logger.info(f"Final (RandomForest) Test R²: {final_metrics['test_r2']:.4f}")
    logger.info(f"Improvement: {(final_metrics['test_r2'] - baseline_metrics['test_r2']) / abs(baseline_metrics['test_r2']) * 100:.2f}%")

    # =====================================================================
    # SAVE MODEL & METRICS
    # =====================================================================
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_pipeline, RENT_MODEL_PATH)
    logger.info(f"Saved trained pipeline to {RENT_MODEL_PATH}")

    # Save comprehensive metrics as JSON
    metrics_output = {
        "baseline_model": baseline_metrics,
        "final_model": final_metrics,
        "best_hyperparameters": grid_search.best_params_,
        "improvement_pct": float((final_metrics['test_r2'] - baseline_metrics['test_r2']) / abs(baseline_metrics['test_r2']) * 100),
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_output, f, indent=2)
    logger.info(f"Saved evaluation metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
