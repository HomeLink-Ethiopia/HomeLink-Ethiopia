"""Evaluate the trained rent estimation model against a median baseline.

Loads ``rent_model.joblib`` and ``ethiopia_housing_data.csv``, splits the
data identically to the training script, then compares:

1. **ML model** (RandomForestRegressor pipeline from ``rent_model.joblib``)
2. **Median baseline** — median rent grouped by ``(subcity, bedrooms)``
   with a global-median fallback for unseen groups.

Metrics reported: MAE, RMSE, R² on the held-out test split.

Run from ``ai/``:

    python -m src.evaluate_rent_model
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

AI_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = AI_DIR / "data" / "ethiopia_housing_data.csv"
MODEL_PATH = AI_DIR / "models" / "rent_model.joblib"
METRICS_PATH = AI_DIR / "models" / "rent_model_metrics.json"

MODEL_SEED = 42
TEST_SIZE = 0.2

FEATURE_COLS = [
    "subcity", "bedrooms", "bathrooms", "area_sqm",
    "has_water_tank", "has_generator", "is_furnished",
]
TARGET_COL = "rent_price_etb"


def load_data() -> tuple[pd.DataFrame, pd.Series]:
    """Load and prepare the housing CSV identically to train_rent_model."""
    df = pd.read_csv(DATA_PATH)
    df["subcity"] = df["subcity"].astype(str).str.strip().str.lower()
    for col in ("has_water_tank", "has_generator", "is_furnished"):
        df[col] = (
            df[col].astype(str).str.strip().str.lower().map(
                lambda v: 1 if v in {"1", "true", "yes"} else 0
            )
        )
    X = df[FEATURE_COLS].copy()
    y = df[TARGET_COL].astype(float)
    return X, y


class MedianBaseline:
    """Simple baseline: median rent by (subcity, bedrooms) group."""

    def __init__(self) -> None:
        self._group_medians: dict[tuple[str, int], float] = {}
        self._global_median: float = 0.0

    def fit(self, X: pd.DataFrame, y: pd.Series) -> None:
        tmp = X[["subcity", "bedrooms"]].copy()
        tmp[TARGET_COL] = y.values
        grouped = tmp.groupby(["subcity", "bedrooms"])[TARGET_COL].median()
        self._group_medians = grouped.to_dict()
        self._global_median = float(y.median())

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        preds = []
        for _, row in X.iterrows():
            key = (row["subcity"], int(row["bedrooms"]))
            preds.append(self._group_medians.get(key, self._global_median))
        return np.array(preds)


def evaluate(y_true: np.ndarray, y_pred: np.ndarray, label: str) -> dict:
    """Compute MAE, RMSE, R² and print them."""
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    print(f"  {label:30s}  MAE={mae:>10,.0f} ETB  RMSE={rmse:>10,.0f} ETB  R²={r2:.4f}")
    return {"label": label, "mae": mae, "rmse": rmse, "r2": r2}


def main() -> None:
    X, y = load_data()
    print(f"Dataset: {len(X)} rows loaded from {DATA_PATH}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=MODEL_SEED,
    )
    print(f"Split:   {len(X_train)} train / {len(X_test)} test\n")

    # --- ML model -----------------------------------------------------------
    if not MODEL_PATH.exists():
        print(f"ERROR: Model not found at {MODEL_PATH}. Run train_rent_model.py first.")
        sys.exit(1)

    pipeline = joblib.load(MODEL_PATH)
    y_pred_ml = pipeline.predict(X_test)

    # --- Median baseline ----------------------------------------------------
    baseline = MedianBaseline()
    baseline.fit(X_train, y_train)
    y_pred_baseline = baseline.predict(X_test)

    # --- Evaluation ---------------------------------------------------------
    print("=" * 72)
    print("RENT ESTIMATION MODEL EVALUATION  (test split)")
    print("=" * 72)
    ml_metrics = evaluate(y_test.values, y_pred_ml, "ML Model (RandomForest)")
    bl_metrics = evaluate(y_test.values, y_pred_baseline, "Baseline (Median by subcity+bedroom)")
    print("=" * 72)

    improvement_mae = (bl_metrics["mae"] - ml_metrics["mae"]) / bl_metrics["mae"] * 100
    improvement_rmse = (bl_metrics["rmse"] - ml_metrics["rmse"]) / bl_metrics["rmse"] * 100
    improvement_r2 = ml_metrics["r2"] - bl_metrics["r2"]

    print(f"\nML vs Baseline improvement:")
    print(f"  MAE reduction:  {improvement_mae:+.1f}%")
    print(f"  RMSE reduction: {improvement_rmse:+.1f}%")
    print(f"  R² change:      {improvement_r2:+.4f}")

    # --- Persist updated metrics -------------------------------------------
    existing = {}
    if METRICS_PATH.exists():
        with open(METRICS_PATH) as f:
            existing = json.load(f)

    existing["median_baseline"] = {
        "model_name": "MedianBaseline (subcity+bedrooms)",
        "test_mae": bl_metrics["mae"],
        "test_rmse": bl_metrics["rmse"],
        "test_r2": bl_metrics["r2"],
    }
    existing["baseline_vs_ml_improvement"] = {
        "mae_reduction_pct": round(improvement_mae, 2),
        "rmse_reduction_pct": round(improvement_rmse, 2),
        "r2_delta": round(improvement_r2, 4),
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"\nMetrics saved to {METRICS_PATH}")


if __name__ == "__main__":
    main()
