"""Unified, reproducible training pipeline for the HomeLink AI Engine.

Ingests ``ai/data/ethiopia_housing_data.csv``, evaluates models against
statistical baselines, saves optimised model artefacts, and writes a
versioned ``ai/models/model_manifest.json`` metadata file.

Models trained
--------------
- **Rent estimation** — ``RandomForestRegressor`` and
  ``GradientBoostingRegressor`` pipelines (ColumnTransformer +
  model); the model with the best test MAE is selected.
- **Fraud detection** — ``IsolationForest`` on tabular anomaly
  features plus ``TfidfVectorizer`` with benign/suspicious
  centroids for text scoring.

Run from ``ai/``::

    python -m src.train              # full pipeline
    python -m src.train --sample 200 # quick run on a 200-row sample
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest, RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

AI_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = AI_DIR / "data"
MODELS_DIR = AI_DIR / "models"
DATA_PATH = DATA_DIR / "ethiopia_housing_data.csv"
RENT_MODEL_PATH = MODELS_DIR / "rent_model.joblib"
FRAUD_MODEL_PATH = MODELS_DIR / "fraud_model.joblib"
MANIFEST_PATH = MODELS_DIR / "model_manifest.json"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_SEED = 42
TEST_SIZE = 0.2

#: Canonical feature columns the rent model expects (order matters).
RENT_FEATURE_COLUMNS: List[str] = [
    "subcity", "bedrooms", "bathrooms", "area_sqm",
    "has_water_tank", "has_generator", "is_furnished",
]
RENT_NUMERIC_COLUMNS: List[str] = [
    "bedrooms", "bathrooms", "area_sqm",
    "has_water_tank", "has_generator", "is_furnished",
]
RENT_CATEGORICAL_COLUMNS: List[str] = ["subcity"]
RENT_TARGET_COLUMN = "rent_price_etb"

#: Fraud IsolationForest feature columns.
FRAUD_FEATURE_COLUMNS: List[str] = [
    "rent_price_etb", "area_sqm", "price_per_sqm", "subcity_rank",
]

#: Ordinal subcity rank by expensiveness (higher = pricier).
SUBCITY_RANK: Dict[str, int] = {
    "bole": 9, "kirkos": 8, "arada": 7, "yeka": 6,
    "nifas silk": 5, "nifas silk-lafto": 5,
    "gulele": 4, "gullele": 4,
    "kolfe": 3, "kolfe keranio": 3,
    "lidetta": 2, "lideta": 2,
    "addis ketema": 1, "akaky kaliti": 0,
}
DEFAULT_SUBCITY_RANK = 4

#: Suspicious descriptions for the scam prototype centroid.
SUSPICIOUS_DESCRIPTIONS: Tuple[str, ...] = (
    "URGENT! act fast today only, no deposit, pay first via Western Union",
    "Contact me abroad, wire transfer before viewing, money gram accepted",
    "Pay in advance to secure this deal, do not tell the landlord, bitcoin accepted",
    "Special deal today only, refundable agent fee, external link for photos",
    "No deposit required if you pay now, urgent move in, contact outside the country",
)

#: Version strings written to the manifest.
RENT_MODEL_VERSION = "rent-v1.1.0"
FRAUD_MODEL_VERSION = "fraud-v1.1.0"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data loading & hashing
# ---------------------------------------------------------------------------


def compute_file_sha256(path: Path) -> str:
    """Return the hex SHA-256 digest of *path*."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_dataset(path: Path = DATA_PATH) -> pd.DataFrame:
    """Load and validate the housing CSV.

    Normalises ``subcity`` to lowercase, coerces boolean columns to
    0/1 integers, and raises if required columns are absent.
    """
    df = pd.read_csv(path)
    df["subcity"] = df["subcity"].astype(str).str.strip().str.lower()

    for col in ("has_water_tank", "has_generator", "is_furnished"):
        df[col] = (
            df[col].astype(str).str.strip().str.lower().map(
                lambda v: 1 if v in {"1", "true", "yes"} else 0,
            )
        )

    required = set(RENT_FEATURE_COLUMNS + [RENT_TARGET_COLUMN])
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")

    return df

# ---------------------------------------------------------------------------
# Baseline
# ---------------------------------------------------------------------------


class MedianBaseline:
    """Median rent grouped by (subcity, bedrooms) with global fallback."""

    def __init__(self) -> None:
        self._group_medians: Dict[Tuple[str, int], float] = {}
        self._global_median: float = 0.0

    def fit(self, X: pd.DataFrame, y: pd.Series) -> None:
        tmp = X[["subcity", "bedrooms"]].copy()
        tmp[RENT_TARGET_COLUMN] = y.values
        grouped = tmp.groupby(["subcity", "bedrooms"])[RENT_TARGET_COLUMN].median()
        self._group_medians = grouped.to_dict()
        self._global_median = float(y.median())

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return np.array([
            self._group_medians.get(
                (row["subcity"], int(row["bedrooms"])),
                self._global_median,
            )
            for _, row in X.iterrows()
        ])

# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------


def _eval_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Return MAE, RMSE, R²."""
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def _serialize(v: Any) -> Any:
    """Make grid-search params JSON-safe (numpy types to native Python)."""
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return float(v)
    if isinstance(v, np.ndarray):
        return v.tolist()
    return v

# ---------------------------------------------------------------------------
# Preprocessor
# ---------------------------------------------------------------------------


def _build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("num", "passthrough", RENT_NUMERIC_COLUMNS),
            ("cat", OneHotEncoder(handle_unknown="ignore"), RENT_CATEGORICAL_COLUMNS),
        ],
    )

# ---------------------------------------------------------------------------
# Rent model training
# ---------------------------------------------------------------------------


def train_rent_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Tuple[Pipeline, Dict[str, Any], Dict[str, Any]]:
    """Train candidate rent models, select the best, return it + metrics.

    Candidates:
    1. LinearRegression baseline (for reference only, not saved).
    2. RandomForestRegressor with GridSearchCV.
    3. GradientBoostingRegressor with GridSearchCV.

    The model with the **lowest test MAE** is selected.

    Returns:
        ``(best_pipeline, best_metrics, comparison)``
    """
    candidates: List[Tuple[str, Pipeline, Dict[str, Any], float]] = []

    # --- 1. LinearRegression baseline (fast, no grid search) ----------------
    lr_pipe = Pipeline([
        ("preprocess", _build_preprocessor()),
        ("model", LinearRegression()),
    ])
    lr_pipe.fit(X_train, y_train)
    lr_metrics = _eval_metrics(y_test.values, lr_pipe.predict(X_test))
    lr_metrics["model_name"] = "LinearRegression"
    lr_cv = cross_val_score(lr_pipe, X_train, y_train, cv=5, scoring="r2")
    lr_metrics["cv_r2_mean"] = float(lr_cv.mean())
    lr_metrics["cv_r2_std"] = float(lr_cv.std())
    candidates.append(("LinearRegression", lr_pipe, lr_metrics, lr_metrics["mae"]))

    # --- 2. RandomForestRegressor + GridSearchCV ---------------------------
    logger.info("Training RandomForestRegressor with GridSearchCV ...")
    rf_grid = {
        "model__n_estimators": [100, 300],
        "model__max_depth": [10, 20, None],
        "model__min_samples_split": [2, 5],
        "model__min_samples_leaf": [1, 2],
    }
    rf_base = Pipeline([
        ("preprocess", _build_preprocessor()),
        ("model", RandomForestRegressor(random_state=MODEL_SEED, n_jobs=-1)),
    ])
    rf_search = GridSearchCV(
        rf_base, rf_grid, cv=5, scoring="r2", n_jobs=-1, verbose=0,
    )
    rf_search.fit(X_train, y_train)
    rf_pipe = rf_search.best_estimator_
    rf_metrics = _eval_metrics(y_test.values, rf_pipe.predict(X_test))
    rf_metrics["model_name"] = "RandomForestRegressor"
    rf_metrics["best_params"] = {k: _serialize(v) for k, v in rf_search.best_params_.items()}
    rf_cv = cross_val_score(rf_pipe, X_train, y_train, cv=5, scoring="r2")
    rf_metrics["cv_r2_mean"] = float(rf_cv.mean())
    rf_metrics["cv_r2_std"] = float(rf_cv.std())
    candidates.append(("RandomForestRegressor", rf_pipe, rf_metrics, rf_metrics["mae"]))

    # --- 3. GradientBoostingRegressor + GridSearchCV ------------------------
    logger.info("Training GradientBoostingRegressor with GridSearchCV ...")
    gb_grid = {
        "model__n_estimators": [100, 200],
        "model__max_depth": [3, 5, 7],
        "model__learning_rate": [0.05, 0.1],
        "model__min_samples_split": [2, 5],
    }
    gb_base = Pipeline([
        ("preprocess", _build_preprocessor()),
        ("model", GradientBoostingRegressor(random_state=MODEL_SEED)),
    ])
    gb_search = GridSearchCV(
        gb_base, gb_grid, cv=5, scoring="r2", n_jobs=-1, verbose=0,
    )
    gb_search.fit(X_train, y_train)
    gb_pipe = gb_search.best_estimator_
    gb_metrics = _eval_metrics(y_test.values, gb_pipe.predict(X_test))
    gb_metrics["model_name"] = "GradientBoostingRegressor"
    gb_metrics["best_params"] = {k: _serialize(v) for k, v in gb_search.best_params_.items()}
    gb_cv = cross_val_score(gb_pipe, X_train, y_train, cv=5, scoring="r2")
    gb_metrics["cv_r2_mean"] = float(gb_cv.mean())
    gb_metrics["cv_r2_std"] = float(gb_cv.std())
    candidates.append(("GradientBoostingRegressor", gb_pipe, gb_metrics, gb_metrics["mae"]))

    # --- Select best by test MAE -------------------------------------------
    candidates.sort(key=lambda c: c[3])  # lowest MAE first
    best_name, best_pipe, best_metrics, _ = candidates[0]
    logger.info(
        "Best rent model: %s (MAE=%.0f, R²=%.4f)",
        best_name, best_metrics["mae"], best_metrics["r2"],
    )

    comparison = {
        "candidates": [
            {"name": m["model_name"], "mae": m["mae"], "rmse": m["rmse"], "r2": m["r2"]}
            for _, _, m, _ in candidates
        ],
        "selected": best_name,
    }

    return best_pipe, best_metrics, comparison

# ---------------------------------------------------------------------------
# Fraud model training
# ---------------------------------------------------------------------------


def _fallback_description(row: pd.Series) -> str:
    subcity = str(row.get("subcity", "")).title()
    bedrooms = int(row.get("bedrooms", 1))
    area = float(row.get("area_sqm", 60.0))
    return (
        f"{bedrooms}-bedroom apartment in {subcity} available for rent. "
        f"About {area:,.0f} square metres of living space. "
        "Well maintained apartment. Quiet neighbourhood with good access to transport."
    )


def train_fraud_model(df: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Fit the IsolationForest + TF-IDF fraud bundle.

    Returns:
        ``(bundle, fraud_metrics)``
    """
    desc_col = "description_text"
    if desc_col not in df.columns:
        df[desc_col] = df.apply(_fallback_description, axis=1)
    else:
        df[desc_col] = df[desc_col].fillna("").astype(str)

    # Tabular anomaly features
    frame = df[["rent_price_etb", "area_sqm"]].astype(float).copy()
    frame["price_per_sqm"] = frame["rent_price_etb"] / frame["area_sqm"].replace(0.0, np.nan)
    frame["price_per_sqm"] = frame["price_per_sqm"].fillna(0.0)
    frame["subcity_rank"] = (
        df["subcity"].map(SUBCITY_RANK).fillna(DEFAULT_SUBCITY_RANK).astype(int)
    )
    anomaly_frame = frame[FRAUD_FEATURE_COLUMNS]

    # IsolationForest
    forest = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=MODEL_SEED,
        n_jobs=-1,
    )
    forest.fit(anomaly_frame)
    train_scores = np.sort(forest.score_samples(anomaly_frame))

    # TF-IDF
    tfidf = TfidfVectorizer(max_features=5000, stop_words="english")
    tfidf.fit(df[desc_col].tolist())

    benign_vectors = tfidf.transform(df[desc_col].tolist())
    benign_centroid = np.asarray(benign_vectors.mean(axis=0)).reshape(1, -1)

    suspicious_vectors = tfidf.transform(list(SUSPICIOUS_DESCRIPTIONS))
    suspicious_centroid = np.asarray(suspicious_vectors.mean(axis=0)).reshape(1, -1)

    bundle = {
        "isolation_forest": forest,
        "train_decision_scores": train_scores,
        "tfidf": tfidf,
        "benign_centroid": benign_centroid,
        "suspicious_centroid": suspicious_centroid,
        "feature_columns": FRAUD_FEATURE_COLUMNS,
    }

    metrics = {
        "n_training_samples": int(len(anomaly_frame)),
        "feature_columns": FRAUD_FEATURE_COLUMNS,
        "tfidf_vocabulary_size": len(tfidf.vocabulary_),
        "isolation_forest_n_estimators": 200,
        "isolation_forest_contamination": 0.05,
        "train_score_min": float(train_scores.min()),
        "train_score_max": float(train_scores.max()),
        "benign_suspicious_cosine": float(
            cosine_similarity(benign_centroid, suspicious_centroid)[0, 0],
        ),
    }

    return bundle, metrics

# ---------------------------------------------------------------------------
# Manifest generation
# ---------------------------------------------------------------------------


def _median_baseline_metrics(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Dict[str, float]:
    """Compute MedianBaseline metrics on the test set."""
    bl = MedianBaseline()
    bl.fit(X_train, y_train)
    y_pred = bl.predict(X_test)
    m = _eval_metrics(y_test.values, y_pred)
    m["model_name"] = "MedianBaseline (subcity+bedrooms)"
    return m


def build_manifest(
    *,
    dataset_path: Path,
    df: pd.DataFrame,
    rent_metrics: Dict[str, Any],
    rent_comparison: Dict[str, Any],
    baseline_metrics: Dict[str, Any],
    fraud_metrics: Dict[str, Any],
    best_params: Dict[str, Any],
) -> Dict[str, Any]:
    """Assemble the model_manifest.json structure."""
    now_iso = datetime.now(timezone.utc).isoformat()
    sha256 = compute_file_sha256(dataset_path)

    mae_bl = baseline_metrics["mae"]
    mae_ml = rent_metrics["mae"]
    mae_reduction = ((mae_bl - mae_ml) / mae_bl * 100) if mae_bl else 0.0

    rmse_bl = baseline_metrics["rmse"]
    rmse_ml = rent_metrics["rmse"]
    rmse_reduction = ((rmse_bl - rmse_ml) / rmse_bl * 100) if rmse_bl else 0.0

    return {
        "schema_version": "1.0",
        "generated_at": now_iso,
        "dataset": {
            "path": str(dataset_path.relative_to(AI_DIR)),
            "sha256": sha256,
            "rows": int(len(df)),
            "columns": int(df.shape[1]),
            "column_names": list(df.columns),
        },
        "training_config": {
            "random_state": MODEL_SEED,
            "test_size": TEST_SIZE,
        },
        "rent_model": {
            "version": RENT_MODEL_VERSION,
            "artifact": "rent_model.joblib",
            "algorithm": rent_comparison.get("selected", "unknown"),
            "hyperparameters": best_params,
            "feature_columns": RENT_FEATURE_COLUMNS,
            "numeric_columns": RENT_NUMERIC_COLUMNS,
            "categorical_columns": RENT_CATEGORICAL_COLUMNS,
            "target_column": RENT_TARGET_COLUMN,
            "metrics": {
                "test_mae": rent_metrics["mae"],
                "test_rmse": rent_metrics["rmse"],
                "test_r2": rent_metrics["r2"],
                "cv_r2_mean": rent_metrics.get("cv_r2_mean"),
                "cv_r2_std": rent_metrics.get("cv_r2_std"),
            },
            "baseline_comparison": {
                "median_baseline": {
                    "test_mae": baseline_metrics["mae"],
                    "test_rmse": baseline_metrics["rmse"],
                    "test_r2": baseline_metrics["r2"],
                },
                "mae_reduction_pct": round(mae_reduction, 2),
                "rmse_reduction_pct": round(rmse_reduction, 2),
                "r2_delta": round(rent_metrics["r2"] - baseline_metrics["r2"], 4),
            },
            "candidate_models": rent_comparison.get("candidates", []),
        },
        "fraud_model": {
            "version": FRAUD_MODEL_VERSION,
            "artifact": "fraud_model.joblib",
            "algorithm": "IsolationForest + TF-IDF",
            "feature_columns": FRAUD_FEATURE_COLUMNS,
            "metrics": fraud_metrics,
        },
    }

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main(sample: Optional[int] = None) -> Dict[str, Any]:
    """Run the full training pipeline end-to-end.

    Args:
        sample: If given, randomly sample this many rows for a quick run.

    Returns:
        The written manifest dict (useful for testing).
    """
    t0 = time.time()

    # -- 1. Load & validate dataset ------------------------------------------
    logger.info("Loading dataset from %s ...", DATA_PATH)
    df = load_dataset(DATA_PATH)
    if sample and sample < len(df):
        df = df.sample(n=sample, random_state=MODEL_SEED).reset_index(drop=True)
        logger.info("Sampled %d rows for quick run.", sample)

    n_rows, n_cols = df.shape
    logger.info("Dataset: %d rows x %d columns", n_rows, n_cols)

    # -- 2. Feature / target split -------------------------------------------
    X = df[RENT_FEATURE_COLUMNS].copy()
    y = df[RENT_TARGET_COLUMN].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=MODEL_SEED,
    )
    logger.info("Split: %d train / %d test", len(X_train), len(X_test))

    # -- 3. Median baseline --------------------------------------------------
    logger.info("Computing median baseline ...")
    baseline = _median_baseline_metrics(X_train, y_train, X_test, y_test)
    logger.info(
        "Baseline: MAE=%.0f  RMSE=%.0f  R²=%.4f",
        baseline["mae"], baseline["rmse"], baseline["r2"],
    )

    # -- 4. Train rent models ------------------------------------------------
    logger.info("Training rent models ...")
    rent_pipe, rent_metrics, rent_comparison = train_rent_model(
        X_train, y_train, X_test, y_test,
    )

    # -- 5. Train fraud model ------------------------------------------------
    logger.info("Training fraud model ...")
    fraud_bundle, fraud_metrics_info = train_fraud_model(df.copy())

    # -- 6. Save artefacts ---------------------------------------------------
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rent_pipe, RENT_MODEL_PATH)
    logger.info("Saved rent model to %s", RENT_MODEL_PATH)
    joblib.dump(fraud_bundle, FRAUD_MODEL_PATH)
    logger.info("Saved fraud model to %s", FRAUD_MODEL_PATH)

    # -- 7. Build & write manifest -------------------------------------------
    best_params: Dict[str, Any] = rent_metrics.get("best_params", {})
    if not best_params:
        best_params = {"model": rent_comparison.get("selected", "unknown")}

    manifest = build_manifest(
        dataset_path=DATA_PATH,
        df=df,
        rent_metrics=rent_metrics,
        rent_comparison=rent_comparison,
        baseline_metrics=baseline,
        fraud_metrics=fraud_metrics_info,
        best_params=best_params,
    )

    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    logger.info("Wrote model manifest to %s", MANIFEST_PATH)

    elapsed = time.time() - t0
    logger.info(
        "Pipeline complete in %.1fs — rent %s (MAE=%.0f, R²=%.4f), fraud %s.",
        elapsed,
        RENT_MODEL_VERSION,
        rent_metrics["mae"],
        rent_metrics["r2"],
        FRAUD_MODEL_VERSION,
    )

    return manifest


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="HomeLink AI — unified training pipeline",
    )
    parser.add_argument(
        "--sample", type=int, default=None, metavar="N",
        help="Randomly sample N rows for a quick test run.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    try:
        main(sample=args.sample)
    except Exception as exc:  # noqa: BLE001
        logger.error("Training pipeline failed: %s", exc, exc_info=True)
        sys.exit(1)
