"""Inspect and clean raw rent listing data for HomeLink Ethiopia.

This script is designed for the AI domain and works with the real dataset that
already exists in ai/data/ethiopia_housing_data.csv or with future raw CSV files.
It inspects the data quality, normalizes rent fields, removes invalid rows, and
writes a cleaned CSV to ai/data/processed/cleaned_rent_data.csv.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

import pandas as pd


AI_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = AI_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
RAW_DATASET_CANDIDATES = [
    DATA_DIR / "addis_ababa_rent.csv",
    DATA_DIR / "raw_rent_data.csv",
    DATA_DIR / "rent_data.csv",
    DATA_DIR / "ethiopia_housing_data.csv",
    RAW_DIR / "rent_data.csv",
    RAW_DIR / "addis_ababa_rent.csv",
]
OUTPUT_PATH = PROCESSED_DIR / "cleaned_rent_data.csv"


def normalize_location(value: Any) -> str:
    """Normalize a location string to a cleaned and consistent label."""
    if pd.isna(value):
        return "Unknown"
    text = str(value).strip()
    if not text:
        return "Unknown"

    replacements = {
        "kazanchis": "Kazanchis",
        "bole": "Bole",
        "ayat": "Ayat",
        "summit": "Summit",
        "nifas silk": "Nifas Silk",
        "nifas silk lafto": "Nifas Silk-Lafto",
        "nifas-silk-lafto": "Nifas Silk-Lafto",
        "lideta": "Lideta",
        "kolfe": "Kolfe",
        "gulele": "Gulele",
        "kirkos": "Kirkos",
        "arada": "Arada",
        "yeka": "Yeka",
        "addis ketema": "Addis Ketema",
        "akaki": "Akaki",
        "akaki kality": "Akaki Kality",
    }

    lowered = text.lower()
    for key, normalized in replacements.items():
        if key in lowered:
            return normalized

    return text.title()


def standardize_boolean(value: Any) -> bool:
    """Convert common yes/no/true/false values to a boolean."""
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y", "t"}


def coerce_numeric(value: Any, default: float | None = None) -> float | None:
    """Coerce a value to numeric, returning a default if needed."""
    if pd.isna(value):
        return default
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def inspect_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """Return a concise summary of dataset quality and schema."""
    summary = {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "column_types": {column: str(dtype) for column, dtype in df.dtypes.items()},
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "null_by_column": {column: int(df[column].isna().sum()) for column in df.columns},
    }
    return summary


def clean_rent_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Clean rent listing data and remove invalid records.

    Supports the repository's existing training CSV schema and the future raw CSV
    schema defined in ai/data/raw/data_schema.json.
    """
    cleaned = df.copy()

    if "subcity" not in cleaned.columns and "location" in cleaned.columns:
        cleaned["subcity"] = cleaned["location"]

    if "location" not in cleaned.columns and "subcity" in cleaned.columns:
        cleaned["location"] = cleaned["subcity"]

    if "title" not in cleaned.columns:
        cleaned["title"] = cleaned.get("description_text", cleaned.get("description", "Untitled listing")).fillna("Untitled listing")
    if "description" not in cleaned.columns:
        cleaned["description"] = cleaned.get("description_text", "")
    if "size_sqm" not in cleaned.columns and "area_sqm" in cleaned.columns:
        cleaned["size_sqm"] = cleaned["area_sqm"]
    if "price_etb" not in cleaned.columns and "rent_price_etb" in cleaned.columns:
        cleaned["price_etb"] = cleaned["rent_price_etb"]

    expected_columns = [
        "title",
        "location",
        "subcity",
        "bedrooms",
        "bathrooms",
        "size_sqm",
        "furnished",
        "price_etb",
        "description",
    ]

    for column in expected_columns:
        if column not in cleaned.columns:
            cleaned[column] = None

    cleaned["location"] = cleaned["location"].map(normalize_location)
    cleaned["subcity"] = cleaned["subcity"].map(normalize_location)

    cleaned["bedrooms"] = cleaned["bedrooms"].apply(lambda x: coerce_numeric(x, default=0.0))
    cleaned["bathrooms"] = cleaned["bathrooms"].apply(lambda x: coerce_numeric(x, default=0.0))
    cleaned["size_sqm"] = cleaned["size_sqm"].apply(lambda x: coerce_numeric(x, default=0.0))
    cleaned["price_etb"] = cleaned["price_etb"].apply(lambda x: coerce_numeric(x, default=0.0))

    cleaned["bedrooms"] = cleaned["bedrooms"].fillna(0.0)
    cleaned["bathrooms"] = cleaned["bathrooms"].fillna(0.0)
    cleaned["size_sqm"] = cleaned["size_sqm"].fillna(0.0)
    cleaned["price_etb"] = cleaned["price_etb"].fillna(0.0)

    cleaned["bedrooms"] = cleaned["bedrooms"].astype(float)
    cleaned["bathrooms"] = cleaned["bathrooms"].astype(float)
    cleaned["size_sqm"] = cleaned["size_sqm"].astype(float)
    cleaned["price_etb"] = cleaned["price_etb"].astype(float)

    if "furnished" in cleaned.columns:
        cleaned["furnished"] = cleaned["furnished"].apply(standardize_boolean)
    else:
        cleaned["furnished"] = False

    cleaned["title"] = cleaned["title"].fillna("Untitled listing").astype(str).str.strip()
    cleaned["description"] = cleaned["description"].fillna("").astype(str).str.strip()

    cleaned = cleaned[(cleaned["price_etb"] > 0) & (cleaned["size_sqm"] > 0)]
    cleaned = cleaned[(cleaned["bedrooms"] >= 0) & (cleaned["bathrooms"] >= 0)]
    cleaned = cleaned.drop_duplicates().reset_index(drop=True)

    cleaned = cleaned[[
        "title",
        "location",
        "subcity",
        "bedrooms",
        "bathrooms",
        "size_sqm",
        "furnished",
        "price_etb",
        "description",
    ]]

    return cleaned


def load_dataset(path: Path | str) -> pd.DataFrame:
    """Load a CSV dataset via pandas, supporting common raw file patterns."""
    dataset_path = Path(path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")
    return pd.read_csv(dataset_path)


def find_raw_dataset() -> Path | None:
    """Return the first available AI raw dataset candidate, if any."""
    for candidate in RAW_DATASET_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def main() -> None:
    """Entry point for dataset inspection and cleaning."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    dataset_path = find_raw_dataset()
    if dataset_path is None:
        raise FileNotFoundError(
            "No raw rent dataset found under ai/data or ai/data/raw. "
            "Expected a CSV file such as addis_ababa_rent.csv or raw_rent_data.csv."
        )

    df = load_dataset(dataset_path)
    report = inspect_dataset(df)
    cleaned = clean_rent_dataset(df)

    cleaned.to_csv(OUTPUT_PATH, index=False)

    print(json.dumps({
        "source": str(dataset_path),
        "output": str(OUTPUT_PATH),
        "inspection": report,
        "cleaned_rows": int(len(cleaned)),
    }, indent=2))


if __name__ == "__main__":
    main()
