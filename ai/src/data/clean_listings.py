"""Clean raw Addis Ababa rental listings before exploratory analysis and training."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Iterable, List

import pandas as pd

try:
    from src.data.parse_raw_listings import parse_raw_listings
except Exception:  # pragma: no cover
    parse_raw_listings = None


AI_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = AI_ROOT / "data" / "processed"
RAW_INPUT_PATH = PROCESSED_DIR / "real_listings_raw.csv"
OUTPUT_PATH = PROCESSED_DIR / "real_listings_cleaned.csv"
SCHEMA_COLUMNS = [
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

OFFICIAL_SUBCITIES = [
    "Bole",
    "Yeka",
    "Kirkos",
    "Arada",
    "Nifas Silk-Lafto",
    "Lideta",
    "Addis Ketema",
    "Gullele",
    "Akaky Kaliti",
    "Kolfe Keranio",
]

SUBCITY_ALIASES = {
    "bole atlas": "Bole",
    "bole": "Bole",
    "yeka": "Yeka",
    "kirkos": "Kirkos",
    "arada": "Arada",
    "nifas silk lafto": "Nifas Silk-Lafto",
    "nifas silk": "Nifas Silk-Lafto",
    "nifas-silk-lafto": "Nifas Silk-Lafto",
    "lideta": "Lideta",
    "addis ketema": "Addis Ketema",
    "gullele": "Gullele",
    "akaki kality": "Akaky Kaliti",
    "akaky kaliti": "Akaky Kaliti",
    "kolfe keraniyo": "Kolfe Keranio",
    "kolfe keranio": "Kolfe Keranio",
}


def normalize_furnished(value: Any) -> bool:
    """Normalize common yes/no/true/false string values to bool."""
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    cleaned = str(value).strip().lower()
    return cleaned in {"1", "true", "yes", "y", "t", "furnished", "available"}


def standardize_subcity(value: Any) -> str:
    """Map dirty location strings to Addis Ababa official subcities."""
    if pd.isna(value):
        return "Unknown"

    text = str(value).strip()
    if not text:
        return "Unknown"

    cleaned = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    if not cleaned:
        return "Unknown"

    if cleaned in SUBCITY_ALIASES:
        return SUBCITY_ALIASES[cleaned]

    for key, mapped in SUBCITY_ALIASES.items():
        if key in cleaned:
            return mapped

    for official in OFFICIAL_SUBCITIES:
        candidate = re.sub(r"[^a-z0-9]+", " ", official.lower()).strip()
        if cleaned == candidate or cleaned.startswith(candidate) or candidate.startswith(cleaned):
            return official

    return "Unknown"


def ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure the dataframe contains the required schema columns in order."""
    for column in SCHEMA_COLUMNS:
        if column not in df.columns:
            df[column] = pd.NA
    return df[SCHEMA_COLUMNS].copy()


def load_raw_listings(input_path: Path | str = RAW_INPUT_PATH) -> pd.DataFrame:
    """Load raw listings CSV, or generate it via the parser if missing."""
    file_path = Path(input_path)
    if file_path.exists():
        return pd.read_csv(file_path)

    if parse_raw_listings is not None:
        parse_raw_listings()
        if file_path.exists():
            return pd.read_csv(file_path)

    return pd.DataFrame(columns=SCHEMA_COLUMNS)


def clean_listings(df: pd.DataFrame | None = None, input_path: Path | str = RAW_INPUT_PATH, output_path: Path | str = OUTPUT_PATH) -> pd.DataFrame:
    """Clean the raw listing dataset and write the processed CSV."""
    if df is None:
        df = load_raw_listings(input_path)

    cleaned = ensure_columns(df)
    cleaned = cleaned.copy()

    if cleaned.empty:
        cleaned = pd.DataFrame(columns=SCHEMA_COLUMNS)
        cleaned.to_csv(output_path, index=False)
        return cleaned

    cleaned["title"] = cleaned["title"].fillna("Untitled listing").astype(str).str.strip()
    cleaned["description"] = cleaned["description"].fillna("No description available").astype(str).str.strip()
    cleaned["location"] = cleaned["location"].fillna(cleaned["subcity"]).astype(str).str.strip()
    cleaned["subcity"] = cleaned["subcity"].map(standardize_subcity).fillna("Unknown")
    cleaned["location"] = cleaned["location"].replace({"nan": "Unknown", "None": "Unknown"})
    cleaned["location"] = cleaned["location"].where(cleaned["location"].str.strip() != "", "Unknown")

    cleaned["price_etb"] = pd.to_numeric(cleaned["price_etb"], errors="coerce")
    cleaned = cleaned[cleaned["price_etb"].notna()]
    cleaned = cleaned[(cleaned["price_etb"] > 0) & (cleaned["price_etb"] >= 2000) & (cleaned["price_etb"] <= 1_000_000)]

    cleaned["bedrooms"] = pd.to_numeric(cleaned["bedrooms"], errors="coerce")
    bedroom_median = cleaned["bedrooms"].median()
    if pd.isna(bedroom_median):
        bedroom_median = 1.0
    cleaned["bedrooms"] = cleaned["bedrooms"].fillna(bedroom_median).clip(lower=0)
    cleaned["bedrooms"] = cleaned["bedrooms"].astype(float)

    cleaned["bathrooms"] = pd.to_numeric(cleaned["bathrooms"], errors="coerce")
    bathroom_median = cleaned["bathrooms"].median()
    if pd.isna(bathroom_median):
        bathroom_median = 1.0
    cleaned["bathrooms"] = cleaned["bathrooms"].fillna(bathroom_median).clip(lower=0)
    cleaned["bathrooms"] = cleaned["bathrooms"].astype(float)

    cleaned["size_sqm"] = pd.to_numeric(cleaned["size_sqm"], errors="coerce")
    cleaned = cleaned[(cleaned["size_sqm"].isna()) | (cleaned["size_sqm"] > 0)]

    cleaned["furnished"] = cleaned["furnished"].map(normalize_furnished).fillna(False).astype(bool)

    cleaned = cleaned[SCHEMA_COLUMNS]
    cleaned = cleaned.drop_duplicates().reset_index(drop=True)

    output_file = Path(output_path)
    try:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        cleaned.to_csv(output_file, index=False)
    except OSError:
        # Some Windows environments or stale handles can make direct write attempts fail.
        # The cleaned DataFrame is still returned and the caller can continue processing.
        pass
    return cleaned


def main() -> None:
    """Entry point for the real-listings cleaning pipeline."""
    clean_listings()
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
