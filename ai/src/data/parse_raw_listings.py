"""Parse raw Ethiopian rental listing JSON files into a unified CSV contract.

The parser reads any JSON files under ai/data/raw (excluding the schema file),
normalizes each record to the contract defined in ai/data/raw/data_schema.json,
and writes a unified CSV to ai/data/processed/real_listings_raw.csv.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

import pandas as pd


AI_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = AI_ROOT / "data" / "raw"
OUTPUT_PATH = AI_ROOT / "data" / "processed" / "real_listings_raw.csv"
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


def iter_listing_files(raw_dir: Path | str) -> List[Path]:
    """Return raw JSON listing files, excluding the schema definition file."""
    raw_path = Path(raw_dir)
    if not raw_path.exists():
        return []

    files = [
        path
        for path in raw_path.rglob("*.json")
        if path.is_file() and path.name != "data_schema.json"
    ]
    return sorted(files)


def normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a record to the raw schema contract and fill missing values."""
    normalized: Dict[str, Any] = {}
    for column in SCHEMA_COLUMNS:
        value = record.get(column)
        if value is None or (isinstance(value, str) and not value.strip()):
            normalized[column] = pd.NA
        else:
            normalized[column] = value
    return normalized


def parse_raw_listings(raw_dir: Path | str = RAW_DIR, output_path: Path | str = OUTPUT_PATH) -> pd.DataFrame:
    """Read all raw JSON listing files and write them to the unified CSV output."""
    raw_path = Path(raw_dir)
    output_file = Path(output_path)
    records: List[Dict[str, Any]] = []

    for file_path in iter_listing_files(raw_path):
        try:
            with file_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            continue

        if isinstance(payload, dict):
            payload = [payload]
        elif not isinstance(payload, list):
            continue

        for item in payload:
            if isinstance(item, dict):
                records.append(normalize_record(item))

    df = pd.DataFrame(records, columns=SCHEMA_COLUMNS)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_file, index=False)
    return df


def main() -> None:
    """CLI entry point for raw listing parsing."""
    parse_raw_listings()
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
