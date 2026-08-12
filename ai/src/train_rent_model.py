"""Train and persist the HomeLink rent estimation model.

Reads ``ai/data/ethiopia_housing_data.csv`` (produced by
``ai/src/generate_dataset.py``), trains a ``RandomForestRegressor`` to
predict ``rent_price_etb``, and saves the full preprocessing + model
pipeline to ``ai/models/rent_model.joblib``.

Run from ``ai/``:

    python -m src.train_rent_model

The saved pipeline is loaded by ``ai/src/rent_estimator.py`` to serve
live predictions through the FastAPI service.
"""

from __future__ import annotations

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
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


def main() -> None:
    """Train the model, report metrics, and persist the pipeline."""
    X, y = load_data()
    logger.info("Loaded %d rows from %s", len(X), DATA_PATH)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=MODEL_SEED
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    r2 = r2_score(y_test, predictions)
    mae = mean_absolute_error(y_test, predictions)
    rmse = float(np.sqrt(np.mean((y_test.to_numpy() - predictions) ** 2)))

    logger.info("Model metrics on held-out test set:")
    logger.info("  R2  = %.4f", r2)
    logger.info("  MAE = ETB %.0f", mae)
    logger.info("  RMSE = ETB %.0f", rmse)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, RENT_MODEL_PATH)
    logger.info("Saved trained pipeline to %s", RENT_MODEL_PATH)


if __name__ == "__main__":
    main()
