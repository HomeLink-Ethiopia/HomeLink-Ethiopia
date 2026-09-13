"""
Unit tests for rental data cleaning pipeline.

Tests:
- USD to ETB price conversion
- Subcity normalization
- Filtering of non-rental properties
- Numeric field parsing
- Output CSV validation
"""

import json
import tempfile
from pathlib import Path
from typing import Dict

import pandas as pd
import pytest

from src.preprocessing.clean_data import (
    RentalDataCleaner,
    extract_value_from_attrs,
    is_rental_property,
    normalize_subcity,
    parse_price,
    load_and_parse_json,
)


class TestPriceParsing:
    """Test price parsing and USD to ETB conversion."""

    def test_parse_price_usd_conversion(self):
        """USD prices should convert at 160.0 rate."""
        # $4,350 → 4350 * 160 = 696,000 ETB
        price_etb = parse_price("4,350", currency="$")
        assert price_etb == 4350 * 160
        assert price_etb == 696_000

    def test_parse_price_etb_direct(self):
        """ETB prices within valid range should be used directly."""
        price_etb = parse_price("50000", currency="ETB")
        assert price_etb == 50_000

    def test_parse_price_no_currency_etb(self):
        """Numeric strings without currency should be treated as ETB."""
        price_etb = parse_price("50000")
        assert price_etb == 50_000

    def test_parse_price_with_etb_suffix(self):
        """Prices with 'ETB' suffix should extract numeric part."""
        price_etb = parse_price("50,000 ETB")
        assert price_etb == 50_000

    def test_parse_price_with_dollar_sign(self):
        """Prices with $ sign should be converted."""
        price_etb = parse_price("$1000")
        assert price_etb == 1000 * 160

    def test_parse_price_below_minimum(self):
        """Prices below 1,000 ETB should return None."""
        price_etb = parse_price("500")
        assert price_etb is None

    def test_parse_price_above_maximum(self):
        """Prices above 3,000,000 ETB should return None."""
        price_etb = parse_price("4000000")
        assert price_etb is None

    def test_parse_price_invalid_string(self):
        """Non-numeric prices should return None."""
        price_etb = parse_price("no price")
        assert price_etb is None

    def test_parse_price_none(self):
        """None input should return None."""
        price_etb = parse_price(None)
        assert price_etb is None

    def test_parse_price_dict_input(self):
        """Should handle dict input with 'price' and 'currency' keys."""
        price_dict = {"price": "4,350", "currency": "$"}
        price_etb = parse_price(price_dict=price_dict)
        assert price_etb == 4350 * 160

    def test_parse_price_excessive_etb(self):
        """Prices exceeding max should return None."""
        price_etb = parse_price("28000000", currency="ETB")
        assert price_etb is None


class TestSubcityCleaning:
    """Test subcity normalization."""

    def test_normalize_valid_subcity_exact(self):
        """Recognized subcities should be returned in canonical form."""
        assert normalize_subcity("Bole") == "Bole"
        assert normalize_subcity("bole") == "Bole"
        assert normalize_subcity("BOLE") == "Bole"

    def test_normalize_valid_subcity_with_spaces(self):
        """Subcities with spaces should be normalized."""
        assert normalize_subcity("Nifas Silk-Lafto") == "Nifas-Silk-Lafto"
        assert normalize_subcity("nifas silk-lafto") == "Nifas-Silk-Lafto"

    def test_normalize_unrecognized_subcity(self):
        """Unrecognized locations should map to 'Other'."""
        assert normalize_subcity("Unknown City") == "Other"
        assert normalize_subcity("Random Nonexistent Place") == "Other"

    def test_normalize_neighborhood_mapping(self):
        """Neighborhoods should map to canonical subcities."""
        assert normalize_subcity("Kazanchis") == "Kirkos"
        assert normalize_subcity("Bole Atlas") == "Bole"
        assert normalize_subcity("CMC") == "Yeka"
        assert normalize_subcity("Sarbet") == "Nifas-Silk-Lafto"
        assert normalize_subcity("Piazza") == "Arada"
        assert normalize_subcity("Tor Hailoch") == "Lideta"

    def test_normalize_none(self):
        """None input should return 'Other'."""
        assert normalize_subcity(None) == "Other"

    def test_normalize_empty_string(self):
        """Empty string should return 'Other'."""
        assert normalize_subcity("") == "Other"

    def test_normalize_partial_match(self):
        """Partial matches should be recognized."""
        # "Bole, Addis Ababa" should extract "Bole"
        assert normalize_subcity("Bole, Addis Ababa") == "Bole"


class TestRentalFiltering:
    """Test filtering for rental properties."""

    def test_filter_rental_property(self):
        """Rental properties should pass filter."""
        record = {
            "title": "2 Bedroom Apartment for Rent",
            "description": "Nice apartment",
            "property_type": "apartment",
        }
        assert is_rental_property(record) is True

    def test_filter_sale_property(self):
        """Sale properties should be excluded."""
        record = {
            "title": "2 Bedroom Apartment for Sale",
            "description": "Nice apartment",
            "property_type": "apartment",
        }
        assert is_rental_property(record) is False

    def test_filter_commercial_property(self):
        """Commercial properties should be excluded."""
        record = {
            "title": "Commercial Office Space",
            "description": "Office for sale",
            "property_type": "office",
        }
        assert is_rental_property(record) is False

    def test_filter_land_property(self):
        """Land listings should be excluded."""
        record = {
            "title": "Land for Sale",
            "description": "1000 sqm land",
            "property_type": "land",
        }
        assert is_rental_property(record) is False

    def test_filter_warehouse_property(self):
        """Warehouse listings should be excluded."""
        record = {
            "title": "Warehouse for Rent",
            "description": "Warehouse space",
            "property_type": "warehouse",
        }
        assert is_rental_property(record) is False

    def test_filter_residential_house(self):
        """Residential houses should pass."""
        record = {
            "title": "Residential House",
            "description": "Nice house for rent",
            "property_type": "house",
        }
        assert is_rental_property(record) is True


class TestJsonExtraction:
    """Test extraction from nested JSON structures."""

    def test_extract_from_attrs_jiji_style(self):
        """Should extract value from attrs array."""
        attrs = [
            {"name": "Square Metres", "value": 128},
            {"name": "Bedrooms", "value": 2},
        ]
        assert extract_value_from_attrs(attrs, "Square Metres") == 128
        assert extract_value_from_attrs(attrs, "Bedrooms") == 2

    def test_extract_from_attrs_case_insensitive(self):
        """Extraction should be case-insensitive."""
        attrs = [
            {"name": "Square Metres", "value": 128},
        ]
        assert extract_value_from_attrs(attrs, "square metres") == 128
        assert extract_value_from_attrs(attrs, "SQUARE METRES") == 128

    def test_extract_from_attrs_missing(self):
        """Missing attribute should return None."""
        attrs = [
            {"name": "Square Metres", "value": 128},
        ]
        assert extract_value_from_attrs(attrs, "Bedrooms") is None

    def test_extract_from_attrs_empty(self):
        """Empty attrs should return None."""
        assert extract_value_from_attrs([], "Square Metres") is None


class TestJsonFileLoading:
    """Test JSON file loading."""

    def test_load_valid_json(self):
        """Should load valid JSON files."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"id": 1, "name": "Test"}, f)
            f.flush()
            temp_path = Path(f.name)

        try:
            data = load_and_parse_json(temp_path)
            assert data == {"id": 1, "name": "Test"}
        finally:
            temp_path.unlink()

    def test_load_invalid_json(self):
        """Should return None for invalid JSON."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("not valid json {")
            f.flush()
            temp_path = Path(f.name)

        try:
            data = load_and_parse_json(temp_path)
            assert data is None
        finally:
            temp_path.unlink()

    def test_load_nonexistent_file(self):
        """Should return None for nonexistent files."""
        data = load_and_parse_json(Path("/nonexistent/file.json"))
        assert data is None


class TestDataCleaner:
    """Test RentalDataCleaner class."""

    def test_standardize_beten_record(self):
        """Should standardize Beten platform records."""
        cleaner = RentalDataCleaner()
        record = {
            "id": 123,
            "title": "Nice Apartment",
            "description": "Furnished apartment in Bole",
            "number_of_bed_rooms": "2",
            "number_of_baths": "1",
            "area": "85.5",
            "price": "50000",  # Valid rental price in ETB
            "location_name": "Bole",
            "property_type_id": {"name": "Rent"},
        }

        standardized = cleaner.standardize_record_beten(record)
        assert standardized is not None
        assert standardized["platform"] == "beten"
        assert standardized["property_id"] == "123"
        assert standardized["price_etb"] == 50_000
        assert standardized["bedrooms"] == 2
        assert standardized["bathrooms"] == 1
        assert standardized["sq_m"] == 85.5
        assert standardized["is_furnished"] is True

    def test_standardize_jiji_record(self):
        """Should standardize Jiji platform records."""
        cleaner = RentalDataCleaner()
        record = {
            "id": 456,
            "advert": {
                "title": "2 Bed Apartment",
                "description": "Furnished apartment for rent",
                "price": 3500,
                "attrs": [
                    {"name": "Square Metres", "value": 100},
                    {"name": "Bedrooms", "value": 2},
                    {"name": "Bathrooms", "value": 1},
                    {"name": "Address", "value": "Kirkos"},
                    {"name": "Furnishing", "value": "Furnished"},
                    {"name": "Property Type", "value": "Apartment"},
                ],
            },
        }

        standardized = cleaner.standardize_record_jiji(record)
        assert standardized is not None
        assert standardized["platform"] == "jiji"
        assert standardized["bedrooms"] == 2
        assert standardized["sq_m"] == 100
        assert standardized["is_furnished"] is True

    def test_standardize_ethiopiapropertycentre_record(self):
        """Should standardize Ethiopia Property Centre records."""
        cleaner = RentalDataCleaner()
        record = {
            "Property Ref": "1167",
            "content_title": "3 Bedroom Apartment",
            "description": "Furnished apartment in Bole",
            "address": "Bole, Addis Ababa",
            "price": "4,350",
            "price_currency": "$",
            "Bedrooms": "3",
            "Bathrooms": "3",
            "Total Area": "220 sqm",
            "Type": "Apartment",
            "product_url": "https://example.com/1167",
        }

        standardized = cleaner.standardize_record_ethiopiapropertycentre(record)
        assert standardized is not None
        assert standardized["platform"] == "ethiopiapropertycentre"
        assert standardized["price_etb"] == 4350 * 160  # USD conversion
        assert standardized["bedrooms"] == 3
        assert standardized["sq_m"] == 220
        assert standardized["is_furnished"] is True


class TestEndToEndPipeline:
    """Test complete cleaning pipeline."""

    def test_clean_and_filter_rentals_only(self):
        """Pipeline should include only rental properties."""
        cleaner = RentalDataCleaner()

        records = [
            {
                "platform": "test",
                "property_id": "1",
                "title": "Apartment for Rent",
                "description": "Nice rental",
                "price_etb": 50_000,
                "property_type": "apartment",
                "subcity": "Bole",
                "sq_m": 85.0,
                "bedrooms": 2,
                "bathrooms": 1,
                "is_furnished": False,
                "url": None,
            },
            {
                "platform": "test",
                "property_id": "2",
                "title": "House for Sale",
                "description": "Nice house",
                "price_etb": 2_000_000,
                "property_type": "house",
                "subcity": "Yeka",
                "sq_m": 150.0,
                "bedrooms": 3,
                "bathrooms": 2,
                "is_furnished": False,
                "url": None,
            },
        ]

        df = cleaner.clean_and_filter(records)
        assert len(df) == 1  # Only rental should remain
        assert df.iloc[0]["property_id"] == "1"

    def test_clean_and_filter_normalizes_subcities(self):
        """Pipeline should normalize subcities."""
        cleaner = RentalDataCleaner()

        records = [
            {
                "platform": "test",
                "property_id": "1",
                "title": "Apartment for Rent",
                "description": "Nice rental",
                "price_etb": 50_000,
                "property_type": "apartment",
                "subcity": "bole",
                "sq_m": 85.0,
                "bedrooms": 2,
                "bathrooms": 1,
                "is_furnished": False,
                "url": None,
            },
        ]

        df = cleaner.clean_and_filter(records)
        assert df.iloc[0]["subcity"] == "Bole"

    def test_clean_and_filter_unknown_subcity(self):
        """Unknown subcities should map to 'Other'."""
        cleaner = RentalDataCleaner()

        records = [
            {
                "platform": "test",
                "property_id": "1",
                "title": "Apartment for Rent",
                "description": "Nice rental",
                "price_etb": 50_000,
                "property_type": "apartment",
                "subcity": "Unknown City",
                "sq_m": 85.0,
                "bedrooms": 2,
                "bathrooms": 1,
                "is_furnished": False,
                "url": None,
            },
        ]

        df = cleaner.clean_and_filter(records)
        assert df.iloc[0]["subcity"] == "Other"

    def test_output_csv_structure(self):
        """Output CSV should have correct columns."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "test_output.csv"

            cleaner = RentalDataCleaner()

            # Create mock platform directory
            raw_dir = Path(tmpdir) / "raw_data"
            test_platform = raw_dir / "test_platform"
            test_platform.mkdir(parents=True, exist_ok=True)

            # Write test JSON
            test_json = test_platform / "test.json"
            test_data = [
                {
                    "id": 1,
                    "title": "Apartment for Rent",
                    "description": "Nice rental apartment",
                    "price": "50000",
                    "area": "85",
                    "number_of_bed_rooms": "2",
                    "number_of_baths": "1",
                    "location_name": "Bole",
                    "property_type_id": {"name": "Rent"},
                }
            ]
            with open(test_json, "w") as f:
                json.dump(test_data, f)

            # Simulate platform loading
            records = cleaner.load_platform_data(test_platform, "test_platform")
            df = cleaner.clean_and_filter(records)

            # Save and verify
            df.to_csv(output_path, index=False)
            assert output_path.exists()

            # Verify columns
            df_loaded = pd.read_csv(output_path)
            expected_columns = [
                "platform",
                "property_id",
                "title",
                "description",
                "price_etb",
                "subcity",
                "sq_m",
                "bedrooms",
                "bathrooms",
                "is_furnished",
                "url",
            ]
            for col in expected_columns:
                assert col in df_loaded.columns


class TestNumericParsing:
    """Test numeric field parsing."""

    def test_parse_numeric_float(self):
        """Should parse float strings."""
        cleaner = RentalDataCleaner()
        assert cleaner._parse_numeric("85.5") == 85.5
        assert cleaner._parse_numeric(85.5) == 85.5
        assert cleaner._parse_numeric(85) == 85.0

    def test_parse_numeric_invalid(self):
        """Invalid numerics should return None."""
        cleaner = RentalDataCleaner()
        assert cleaner._parse_numeric("abc") is None
        assert cleaner._parse_numeric(None) is None

    def test_parse_int_string(self):
        """Should parse integer strings."""
        cleaner = RentalDataCleaner()
        assert cleaner._parse_int("2") == 2
        assert cleaner._parse_int(2) == 2
        assert cleaner._parse_int("2.9") == 2  # Truncates

    def test_parse_int_invalid(self):
        """Invalid integers should return None."""
        cleaner = RentalDataCleaner()
        assert cleaner._parse_int("abc") is None
        assert cleaner._parse_int(None) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
