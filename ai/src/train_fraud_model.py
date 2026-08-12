"""Train and persist the HomeLink fraud-detection model bundle.

Reads ``ai/data/ethiopia_housing_data.csv`` (produced by
``ai/src/generate_dataset.py``) and fits two unsupervised components:

- **IsolationForest** on tabular anomaly features
  (``rent_price_etb``, ``area_sqm``, ``price_per_sqm``, ``subcity_rank``).
- **TfidfVectorizer** on property descriptions, plus benign / scam
  prototype centroids used to derive a continuous text suspiciousness
  score at serving time.

The fitted bundle is saved to ``ai/models/fraud_model.joblib`` and
loaded by ``ai/src/fraud_detector.py``.

Run from ``ai/``:

    python -m src.train_fraud_model
"""

from __future__ import annotations

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:  # supports both `python -m src.train_fraud_model` and direct execution
    from fraud_detector import (
        DEFAULT_SUBCITY_RANK,
        FRAUD_FEATURE_COLUMNS,
        FRAUD_MODEL_PATH,
        SUBCITY_RANK,
        SUSPICIOUS_DESCRIPTIONS,
    )
    from rent_estimator import DATA_PATH
except ImportError:  # pragma: no cover - fallback for direct execution
    from src.fraud_detector import (
        DEFAULT_SUBCITY_RANK,
        FRAUD_FEATURE_COLUMNS,
        FRAUD_MODEL_PATH,
        SUBCITY_RANK,
        SUSPICIOUS_DESCRIPTIONS,
    )
    from src.rent_estimator import DATA_PATH

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

MODEL_SEED = 42
ISOLATION_CONTAMINATION = 0.05
TFIDF_MAX_FEATURES = 5000

DESCRIPTION_COLUMN = "description_text"


def _fallback_description(row: pd.Series) -> str:
    """Build a synthetic description when the CSV has no text column."""
    subcity = str(row.get("subcity", "")).title()
    bedrooms = int(row.get("bedrooms", 1))
    area = float(row.get("area_sqm", 60.0))
    parts = [f"{bedrooms}-bedroom apartment in {subcity} available for rent."]
    parts.append(f"About {area:,.0f} square metres of living space.")
    parts.append("Well maintained apartment.")
    parts.append("Quiet neighbourhood with good access to transport.")
    return " ".join(parts)


def load_data(data_path: Path = DATA_PATH) -> pd.DataFrame:
    """Load the CSV, normalise subcity names and ensure a text column exists."""
    data = pd.read_csv(data_path)
    data["subcity"] = data["subcity"].astype(str).str.strip().str.lower()

    if DESCRIPTION_COLUMN not in data.columns:
        logger.warning("CSV has no '%s' column; synthesising descriptions.", DESCRIPTION_COLUMN)
        data[DESCRIPTION_COLUMN] = data.apply(_fallback_description, axis=1)
    else:
        data[DESCRIPTION_COLUMN] = data[DESCRIPTION_COLUMN].fillna("").astype(str)

    required = {"subcity", "rent_price_etb", "area_sqm"}
    missing = [col for col in required if col not in data.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")
    return data


def build_anomaly_frame(data: pd.DataFrame) -> pd.DataFrame:
    """Build the tabular feature frame consumed by the IsolationForest."""
    frame = data[["rent_price_etb", "area_sqm"]].astype(float).copy()
    frame["price_per_sqm"] = frame["rent_price_etb"] / frame["area_sqm"].replace(0.0, np.nan)
    frame["price_per_sqm"] = frame["price_per_sqm"].fillna(0.0)
    frame["subcity_rank"] = data["subcity"].map(SUBCITY_RANK).fillna(DEFAULT_SUBCITY_RANK).astype(int)
    return frame[FRAUD_FEATURE_COLUMNS]


def main() -> None:
    """Fit the fraud components and persist the model bundle."""
    data = load_data()
    logger.info("Loaded %d rows from %s", len(data), DATA_PATH)

    # 1) IsolationForest on tabular anomaly features.
    anomaly_frame = build_anomaly_frame(data)
    forest = IsolationForest(
        n_estimators=200,
        contamination=ISOLATION_CONTAMINATION,
        random_state=MODEL_SEED,
        n_jobs=-1,
    )
    forest.fit(anomaly_frame)
    train_scores = np.sort(forest.score_samples(anomaly_frame))

    # 2) TF-IDF embeddings + benign / scam prototype centroids.
    tfidf = TfidfVectorizer(max_features=TFIDF_MAX_FEATURES, stop_words="english")
    tfidf.fit(data[DESCRIPTION_COLUMN].tolist())

    benign_vectors = tfidf.transform(data[DESCRIPTION_COLUMN].tolist())
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

    MODELS_DIR = FRAUD_MODEL_PATH.parent
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, FRAUD_MODEL_PATH)
    logger.info("Saved fraud model bundle to %s", FRAUD_MODEL_PATH)

    # Quick diagnostics.
    logger.info("Anomaly features: %s", FRAUD_FEATURE_COLUMNS)
    logger.info("TF-IDF vocabulary size: %d", len(tfidf.vocabulary_))
    logger.info(
        "Benign/suspicious prototype cosine similarity: %.4f",
        float(cosine_similarity(benign_centroid, suspicious_centroid)[0, 0]),
    )
    logger.info(
        "IsolationForest score_samples range: [%.4f, %.4f]",
        float(train_scores.min()),
        float(train_scores.max()),
    )


if __name__ == "__main__":
    main()
