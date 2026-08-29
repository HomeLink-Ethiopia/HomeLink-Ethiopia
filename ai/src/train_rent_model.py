"""Train and persist the HomeLink rent estimation model on real data.

Reads ``ai/data/processed/rentals_cleaned.csv``, extracts binary
keyword features from ``title`` and ``description``, engineers
small-unit indicators, trains a ``RandomForestRegressor`` to predict
``price_etb`` wrapped in a ``TransformedTargetRegressor`` that
applies ``np.log1p`` to the target during training and
``np.expm1`` to revert predictions to raw ETB.

Run from ``ai/``::

    python -m src.train_rent_model
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

AI_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = AI_DIR / "data"
MODELS_DIR = AI_DIR / "models"
DATA_PATH = DATA_DIR / "processed" / "rentals_cleaned.csv"

RENT_MODEL_PATH = MODELS_DIR / "rent_model.joblib"

TARGET_COLUMN = "price_etb"

# Text-derived binary features matched via regex on combined title + description.
_TEXT_FEATURES: dict[str, re.Pattern] = {
    "has_generator": re.compile(r"generator|gen-set|power backup"),
    "has_water_tank": re.compile(r"water tank|tanker|reservoir"),
    "is_villa": re.compile(r"villa|g\+1|g\+2|g\+3|compound"),
    "is_condo": re.compile(r"condo|condominium|apartment"),
}

CATEGORICAL_FEATURES = ["subcity", "is_furnished"]
NUMERIC_FEATURES = [
    "sq_m", "bedrooms", "bathrooms", "bed_bath_ratio",
    "is_small_unit",
    "has_generator", "has_water_tank", "is_villa", "is_condo",
]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

MODEL_SEED = 42
TEST_SIZE = 0.2


def _extract_text_features(data: pd.DataFrame) -> pd.DataFrame:
    """Combine title + description and extract binary keyword features."""
    text_full = (
        data["title"].fillna("").astype(str).str.lower()
        + " "
        + data["description"].fillna("").astype(str).str.lower()
    )
    for col, pattern in _TEXT_FEATURES.items():
        data[col] = text_full.str.contains(pattern).astype(int)
    return data


def load_data(data_path: Path = DATA_PATH) -> tuple[pd.DataFrame, pd.Series]:
    """Load the cleaned CSV, extract text features, and return (X, y).

    Drops rows only when ``price_etb`` is NaN or non-finite.
    """
    data = pd.read_csv(data_path)

    csv_columns = [TARGET_COLUMN, "title", "description"] + CATEGORICAL_FEATURES + ["sq_m", "bedrooms", "bathrooms"]
    missing = [col for col in csv_columns if col not in data.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    data["subcity"] = data["subcity"].astype(str).str.strip().str.lower()

    data["is_furnished"] = (
        data["is_furnished"]
        .astype(str)
        .str.strip()
        .str.lower()
        .map(lambda v: "1" if v in {"1", "true", "yes"} else "0")
    )

    data = data.dropna(subset=[TARGET_COLUMN]).copy()
    data[TARGET_COLUMN] = pd.to_numeric(data[TARGET_COLUMN], errors="coerce")
    data = data.dropna(subset=[TARGET_COLUMN]).copy()
    logger.info("Dropped rows with missing/invalid target; %d rows remain", len(data))

    # Feature engineering
    data = _extract_text_features(data)
    data["bed_bath_ratio"] = data["bedrooms"] / (data["bathrooms"] + 0.1)
    data["is_small_unit"] = (data["bedrooms"] <= 1).astype(int)

    X = data[ALL_FEATURES].copy()
    y = data[TARGET_COLUMN].astype(float)
    return X, y


def build_pipeline() -> Pipeline:
    """Build preprocessing + RandomForestRegressor pipeline.

    Numeric features are median-imputed then scaled.
    Categorical features are constant-imputed then one-hot encoded.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
                    ("encoder", OneHotEncoder(handle_unknown="ignore")),
                ]),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocess", preprocessor),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=200,
                    max_depth=15,
                    min_samples_leaf=2,
                    random_state=MODEL_SEED,
                ),
            ),
        ]
    )


def _mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error (skipped where y_true == 0)."""
    mask = y_true != 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def main() -> dict:
    """Train the model, evaluate, and export the pipeline artifact."""
    X, y = load_data()
    logger.info("Loaded %d rows from %s", len(X), DATA_PATH)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=MODEL_SEED,
    )
    logger.info("Split into %d train / %d test samples", len(X_train), len(X_test))

    inner_pipeline = build_pipeline()
    model = TransformedTargetRegressor(
        regressor=inner_pipeline,
        func=np.log1p,
        inverse_func=np.expm1,
    )
    model.fit(X_train, y_train)

    y_pred_test = model.predict(X_test)

    # --- Overall metrics ---
    mae = float(mean_absolute_error(y_test, y_pred_test))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
    r2 = float(r2_score(y_test, y_pred_test))
    mape = _mape(y_test.values, y_pred_test)

    logger.info("=== Overall Test Metrics ===")
    logger.info("  MAE  = ETB %.0f", mae)
    logger.info("  RMSE = ETB %.0f", rmse)
    logger.info("  MAPE = %.2f%%", mape)
    logger.info("  R²   = %.4f", r2)

    # --- Small-unit segmented metrics ---
    small_mask = (X_test["bedrooms"] <= 1) | (y_test <= 30_000)
    if small_mask.sum() > 0:
        y_small_true = y_test[small_mask].values
        y_small_pred = y_pred_test[small_mask]
        small_mae = float(mean_absolute_error(y_small_true, y_small_pred))
        small_mape = _mape(y_small_true, y_small_pred)
        logger.info("=== Small-Unit Test Metrics (%d samples) ===", int(small_mask.sum()))
        logger.info("  Small-Unit MAE  = ETB %.0f", small_mae)
        logger.info("  Small-Unit MAPE = %.2f%%", small_mape)
    else:
        small_mae = 0.0
        small_mape = 0.0
        logger.info("No small-unit samples in test set")

    # --- Export ---
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, RENT_MODEL_PATH)
    logger.info("Saved trained TransformedTargetRegressor to %s", RENT_MODEL_PATH)

    return {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "mape": mape,
        "small_unit_mae": small_mae,
        "small_unit_mape": small_mape,
    }


if __name__ == "__main__":
    main()
