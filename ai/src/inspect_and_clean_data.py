"""Inspect and clean the available housing CSV for rental model training.

Run from ``ai/``::

    python -m src.inspect_and_clean_data

The cleaner accepts the current synthetic-format housing CSV as well as
common real-listing column aliases, without creating or filling synthetic
records.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd

AI_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_PATH = AI_DIR / "data" / "ethiopia_housing_data.csv"
DEFAULT_OUTPUT_PATH = AI_DIR / "data" / "processed" / "cleaned_rentals.csv"

REQUIRED_OUTPUT_COLUMNS = ["price", "subcity", "bedrooms", "bathrooms", "area_sqm"]
PRICE_ALIASES = ("price", "price_etb", "rent_price_etb", "monthly_rent", "rent")
AREA_ALIASES = ("area_sqm", "size_sqm", "sq_m", "area", "size")
RENT_TERMS = re.compile(r"\b(?:rent|rental|for rent|lease|leasing|monthly)\b", re.IGNORECASE)
SALE_TERMS = re.compile(r"\b(?:sale|sell|selling|purchase|buy|buying)\b", re.IGNORECASE)
TRANSACTION_COLUMNS = ("transaction_type", "listing_type", "purpose", "status", "property_status")


def _find_column(columns: pd.Index, aliases: tuple[str, ...]) -> str | None:
    """Find a column by case-insensitive alias matching."""
    by_lower = {str(column).strip().lower(): str(column) for column in columns}
    return next((by_lower[alias] for alias in aliases if alias in by_lower), None)


def _rental_mask(data: pd.DataFrame) -> pd.Series:
    """Keep rentals and exclude sales when transaction metadata is available."""
    transaction_column = _find_column(data.columns, TRANSACTION_COLUMNS)
    if transaction_column:
        values = data[transaction_column].fillna("").astype(str)
        return values.str.contains(RENT_TERMS, na=False) & ~values.str.contains(SALE_TERMS, na=False)

    text_columns = [
        column for column in ("title", "description", "description_text", "property_type")
        if column in data.columns
    ]
    if not text_columns:
        return pd.Series(True, index=data.index)

    text = data[text_columns].fillna("").astype(str).agg(" ".join, axis=1)
    sale_rows = text.str.contains(SALE_TERMS, na=False)
    rental_rows = text.str.contains(RENT_TERMS, na=False)
    # A dataset with no explicit transaction field may contain rental records
    # whose text omits "rent"; retain those unless they explicitly say sale.
    return ~sale_rows if not rental_rows.any() else rental_rows & ~sale_rows


def clean_rentals(data: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Filter, normalize, and return rental rows plus pipeline counts."""
    original_rows = len(data)
    rental_data = data[_rental_mask(data)].copy()
    rental_rows = len(rental_data)

    price_column = _find_column(rental_data.columns, PRICE_ALIASES)
    area_column = _find_column(rental_data.columns, AREA_ALIASES)
    if price_column is None or area_column is None:
        raise ValueError("Dataset must contain a price and area_sqm-compatible column")
    if "subcity" not in rental_data.columns:
        raise ValueError("Dataset must contain a subcity column")
    if "bedrooms" not in rental_data.columns or "bathrooms" not in rental_data.columns:
        raise ValueError("Dataset must contain bedrooms and bathrooms columns")

    cleaned = pd.DataFrame(
        {
            "price": pd.to_numeric(rental_data[price_column], errors="coerce"),
            "subcity": rental_data["subcity"].fillna("").astype(str).str.strip().str.lower(),
            "bedrooms": pd.to_numeric(rental_data["bedrooms"], errors="coerce"),
            "bathrooms": pd.to_numeric(rental_data["bathrooms"], errors="coerce"),
            "area_sqm": pd.to_numeric(rental_data[area_column], errors="coerce"),
        },
        index=rental_data.index,
    )
    cleaned = cleaned.replace({"": pd.NA, "nan": pd.NA, "none": pd.NA})
    cleaned = cleaned.dropna(subset=REQUIRED_OUTPUT_COLUMNS)
    cleaned = cleaned[
        (cleaned["price"] > 0)
        & (cleaned["price"] <= 1_000_000)
        & (cleaned["area_sqm"] > 5)
    ]
    cleaned = cleaned.drop_duplicates().reset_index(drop=True)

    counts = {
        "original_rows": original_rows,
        "rental_rows": rental_rows,
        "cleaned_rows": len(cleaned),
    }
    return cleaned[REQUIRED_OUTPUT_COLUMNS], counts


def inspect_and_clean(
    input_path: Path = DEFAULT_INPUT_PATH,
    output_path: Path = DEFAULT_OUTPUT_PATH,
) -> pd.DataFrame:
    """Run the inspection/cleaning pipeline and write the cleaned CSV."""
    data = pd.read_csv(input_path)
    cleaned, counts = clean_rentals(data)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(output_path, index=False)

    print("=== Rental Data Cleaning Report ===")
    print(f"Original total rows: {counts['original_rows']}")
    print(f"Rental rows after filtering: {counts['rental_rows']}")
    print(f"Cleaned rows after missing/outlier removal: {counts['cleaned_rows']}")
    print("Price statistics (ETB):")
    print(f"  min: {cleaned['price'].min():.2f}")
    print(f"  mean: {cleaned['price'].mean():.2f}")
    print(f"  max: {cleaned['price'].max():.2f}")
    print("Area statistics (sqm):")
    print(f"  min: {cleaned['area_sqm'].min():.2f}")
    print(f"  mean: {cleaned['area_sqm'].mean():.2f}")
    print(f"  max: {cleaned['area_sqm'].max():.2f}")
    print(f"Wrote cleaned dataset: {output_path}")
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()
    inspect_and_clean(args.input, args.output)


if __name__ == "__main__":
    main()
