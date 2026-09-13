"""Run EDA and prepare cleaned rental data for baseline regression.

Run from ``ai/``::

    python -m src.eda_and_feature_prep

The script writes an all-numeric encoded dataset and metadata describing the
one-hot columns so inference code can reproduce the same feature layout.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

AI_DIR = Path(__file__).resolve().parents[1]
INPUT_PATH = AI_DIR / "data" / "processed" / "cleaned_rentals.csv"
OUTPUT_PATH = AI_DIR / "data" / "processed" / "encoded_rentals.csv"
METADATA_PATH = AI_DIR / "data" / "processed" / "encoded_rentals_metadata.json"

REQUIRED_COLUMNS = ["price", "subcity", "bedrooms", "bathrooms", "area_sqm"]
NUMERIC_COLUMNS = ["price", "bedrooms", "bathrooms", "area_sqm"]

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def load_cleaned_data(input_path: Path = INPUT_PATH) -> pd.DataFrame:
    """Load and validate the cleaned rental dataset."""
    data = pd.read_csv(input_path)

    # Normalize price / rent_price_etb column naming
    if "price" not in data.columns and "rent_price_etb" in data.columns:
        data["price"] = data["rent_price_etb"]
    if "rent_price_etb" not in data.columns and "price" in data.columns:
        data["rent_price_etb"] = data["price"]

    missing = [column for column in REQUIRED_COLUMNS if column not in data.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    columns_to_keep = REQUIRED_COLUMNS + (["rent_price_etb"] if "rent_price_etb" in data.columns else [])
    data = data[columns_to_keep].copy()
    data["subcity"] = data["subcity"].astype(str).str.strip().str.lower()
    for column in NUMERIC_COLUMNS:
        data[column] = pd.to_numeric(data[column], errors="coerce")
    if "rent_price_etb" in data.columns:
        data["rent_price_etb"] = pd.to_numeric(data["rent_price_etb"], errors="coerce")

    if data.isna().any().any():
        raise ValueError("Cleaned dataset contains missing or non-numeric values")
    return data


def prepare_features(data: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, object]]:
    """Print EDA summaries and return an all-numeric one-hot encoded frame."""
    correlations = data[NUMERIC_COLUMNS].corr()["price"].drop("price")
    mean_price_by_subcity = data.groupby("subcity")["price"].mean().sort_values(ascending=False)

    print("=== Rental EDA Summary ===")
    print("Correlation with price:")
    for column, value in correlations.items():
        print(f"  {column}: {value:.4f}")
    print("Mean price by subcity:")
    for subcity, value in mean_price_by_subcity.items():
        print(f"  {subcity}: ETB {value:.2f}")

    encoded = pd.get_dummies(
        data,
        columns=["subcity"],
        prefix="subcity",
        prefix_sep="_",
        dtype=int,
    )
    if "rent_price_etb" not in encoded.columns and "price" in encoded.columns:
        encoded["rent_price_etb"] = encoded["price"]

    encoded = encoded.apply(pd.to_numeric, errors="raise")
    if encoded.isna().any().any():
        raise ValueError("Encoded dataset contains missing values")

    metadata = {
        "source": str(INPUT_PATH),
        "rows": len(encoded),
        "target_column": "price",
        "categorical_column": "subcity",
        "subcity_categories": sorted(data["subcity"].unique().tolist()),
        "feature_columns": list(encoded.columns),
    }
    return encoded, metadata


def main() -> pd.DataFrame:
    """Load, inspect, encode, and persist the prepared rental dataset."""
    data = load_cleaned_data()
    encoded, metadata = prepare_features(data)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    encoded.to_csv(OUTPUT_PATH, index=False)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    logger.info("Wrote %d rows and %d numeric columns to %s", len(encoded), len(encoded.columns), OUTPUT_PATH)
    logger.info("Wrote encoding metadata to %s", METADATA_PATH)
    return encoded


if __name__ == "__main__":
    main()
