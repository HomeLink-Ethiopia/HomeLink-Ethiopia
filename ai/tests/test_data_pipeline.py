from pathlib import Path

import pandas as pd

from src.inspect_and_clean_data import DEFAULT_OUTPUT_PATH, inspect_and_clean


EXPECTED_COLUMNS = {"price", "subcity", "bedrooms", "bathrooms", "area_sqm"}


def test_cleaned_rentals_output_exists_and_is_valid():
    inspect_and_clean()

    output_path = Path(DEFAULT_OUTPUT_PATH)
    assert output_path.exists()

    cleaned = pd.read_csv(output_path)
    assert not cleaned.empty
    assert EXPECTED_COLUMNS.issubset(cleaned.columns)
    assert (cleaned["price"] > 0).all()
