"""Train and index the HomeLink recommendation vectorizer pipeline.

Fits a ``ColumnTransformer`` — ``StandardScaler`` for numerical listing
features (price, area, bedrooms, bathrooms) and ``OneHotEncoder`` for
subcity — over the active catalog, then embeds every catalog listing
into a vector-space matrix. The fitted transformer plus catalog vectors
are saved to ``ai/models/recommender_pipeline.joblib`` and loaded by
``ai/src/recommend.py`` for live cosine-similarity matching.

Run from ``ai/``:

    python -m src.train_recommender

Re-run this script whenever the listing catalog changes.
"""

from __future__ import annotations

import logging
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:  # supports both `python -m src.train_recommender` and direct execution
    from recommend import (
        CATALOG_PATH,
        REC_CATEGORICAL_COLUMNS,
        REC_NUMERIC_COLUMNS,
        REC_VECTORIZER_COLUMNS,
        RECOMMENDER_PIPELINE_PATH,
        _as_float,
        load_catalog,
    )
except ImportError:  # pragma: no cover - fallback for direct execution
    from src.recommend import (
        CATALOG_PATH,
        REC_CATEGORICAL_COLUMNS,
        REC_NUMERIC_COLUMNS,
        REC_VECTORIZER_COLUMNS,
        RECOMMENDER_PIPELINE_PATH,
        _as_float,
        load_catalog,
    )

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def catalog_dataframe(catalog: List[Dict[str, object]]) -> pd.DataFrame:
    """Build a clean vectorizer-ready DataFrame from catalog listings."""
    rows = []
    for listing in catalog:
        rows.append(
            {
                "price_etb": _as_float(listing.get("price_etb")),
                "area_sqm": _as_float(listing.get("area_sqm")),
                "bedrooms": float(int(listing.get("bedrooms") or 0)),
                "bathrooms": float(int(listing.get("bathrooms") or 1)),
                "subcity": str(listing.get("subcity", "")).strip().lower(),
            }
        )
    return pd.DataFrame(rows, columns=REC_VECTORIZER_COLUMNS)


def build_vectorizer() -> ColumnTransformer:
    """Build the standardiser + one-hot encoder for listing embeddings."""
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), REC_NUMERIC_COLUMNS),
            ("cat", OneHotEncoder(handle_unknown="ignore"), REC_CATEGORICAL_COLUMNS),
        ]
    )


def main() -> None:
    """Fit the vectorizer, embed the catalog, and persist the pipeline."""
    catalog = load_catalog(CATALOG_PATH)
    if not catalog:
        raise ValueError("Empty catalog - nothing to index.")

    frame = catalog_dataframe(catalog)
    vectorizer = build_vectorizer()
    vectorizer.fit(frame)

    transformed = vectorizer.transform(frame)
    catalog_vectors = np.asarray(transformed.toarray() if hasattr(transformed, "toarray") else transformed)

    bundle = {
        "vectorizer": vectorizer,
        "catalog_vectors": catalog_vectors,
        "feature_columns": REC_VECTORIZER_COLUMNS,
        "n_listings": len(catalog),
        "embedding_dim": catalog_vectors.shape[1],
    }

    RECOMMENDER_PIPELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, RECOMMENDER_PIPELINE_PATH)
    logger.info("Saved recommender pipeline to %s", RECOMMENDER_PIPELINE_PATH)
    logger.info("Indexed %d listings into a %d-dim embedding space", len(catalog), catalog_vectors.shape[1])

    # Quick diagnostics: nearest neighbour pair among the indexed vectors.
    from sklearn.metrics.pairwise import cosine_similarity

    sims = cosine_similarity(catalog_vectors)
    np.fill_diagonal(sims, -1.0)
    flat_index = int(np.argmax(sims))
    i, j = divmod(flat_index, sims.shape[1])
    logger.info(
        "Closest pair: %s <-> %s (cosine %.4f)",
        catalog[i].get("property_id"),
        catalog[j].get("property_id"),
        float(sims[i, j]),
    )


if __name__ == "__main__":
    main()
