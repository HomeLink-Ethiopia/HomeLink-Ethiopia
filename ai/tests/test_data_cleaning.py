from pathlib import Path

import pandas as pd

from src.data.clean_listings import clean_listings, standardize_subcity


def test_standardize_subcity_maps_dirty_variants():
    assert standardize_subcity("Bole Atlas") == "Bole"
    assert standardize_subcity("bole") == "Bole"
    assert standardize_subcity("Akaki Kality") == "Akaky Kaliti"
    assert standardize_subcity("Unknown District") == "Unknown"


def test_price_outliers_are_stripped():
    df = pd.DataFrame(
        {
            "title": ["A", "B", "C"],
            "location": ["Bole", "Kazanchis", "Addis Ketema"],
            "subcity": ["Bole", "Kazanchis", "Addis Ketema"],
            "bedrooms": [2, 1, 3],
            "bathrooms": [1, 1, 2],
            "size_sqm": [80, 60, 120],
            "furnished": [True, False, True],
            "price_etb": [-500, 50_000_000, 15_000],
            "description": ["Nice", "Ok", "Spacious"],
        }
    )

    cleaned = clean_listings(df)

    assert cleaned["price_etb"].gt(0).all()
    assert cleaned["price_etb"].between(2000, 1_000_000).all()
    assert len(cleaned) == 1
    assert cleaned.iloc[0]["subcity"] == "Addis Ketema"


def test_clean_listings_creates_processed_csv(tmp_path):
    raw = tmp_path / "real_listings_raw.csv"
    raw.parent.mkdir(parents=True, exist_ok=True)
    raw.write_text(
        "title,location,subcity,bedrooms,bathrooms,size_sqm,furnished,price_etb,description\n"
        "Apartment 1,Bole,Bole,2,1,80,True,25000,Nice\n"
        "Apartment 2,Unknown,Unknown,NaN,NaN,NaN,False,-500,Missing details\n"
        "Apartment 3,Bole Atlas,Bole Atlas,3,2,100,Yes,60000,Good\n",
        encoding="utf-8",
    )

    output = tmp_path / "real_listings_cleaned.csv"
    cleaned = clean_listings(pd.read_csv(raw), input_path=raw, output_path=output)

    assert output.exists()
    assert list(cleaned.columns) == [
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
    assert not cleaned.empty
    assert (cleaned["price_etb"] > 0).all()
