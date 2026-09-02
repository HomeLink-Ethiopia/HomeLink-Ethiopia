import pandas as pd
import pytest

from src.data.parse_raw_listings import parse_raw_listings, SCHEMA_COLUMNS


def test_parser_reads_raw_json_and_outputs_schema_columns(tmp_path):
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()

    listing_file = raw_dir / "listing_1.json"
    listing_file.write_text(
        """
        {
          "title": "2 Bedroom Apartment",
          "location": "Bole",
          "subcity": "Bole",
          "bedrooms": 2,
          "bathrooms": 1,
          "size_sqm": 85,
          "furnished": true,
          "price_etb": 35000,
          "description": "Nice apartment in Bole"
        }
        """,
        encoding="utf-8",
    )

    output_path = tmp_path / "processed" / "real_listings_raw.csv"
    df = parse_raw_listings(raw_dir, output_path)

    assert list(df.columns) == SCHEMA_COLUMNS
    assert len(df) == 1
    assert df.iloc[0]["title"] == "2 Bedroom Apartment"
    assert df.iloc[0]["location"] == "Bole"


def test_parser_handles_missing_schema_keys_without_errors(tmp_path):
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()

    listing_file = raw_dir / "listing_2.json"
    listing_file.write_text(
        """
        {
          "title": "Studio",
          "location": "Kazanchis",
          "subcity": "Kazanchis"
        }
        """,
        encoding="utf-8",
    )

    output_path = tmp_path / "processed" / "real_listings_raw.csv"
    df = parse_raw_listings(raw_dir, output_path)

    assert list(df.columns) == SCHEMA_COLUMNS
    assert len(df) == 1
    assert pd.isna(df.iloc[0]["bedrooms"])
    assert pd.isna(df.iloc[0]["price_etb"])
    assert pd.isna(df.iloc[0]["description"])
