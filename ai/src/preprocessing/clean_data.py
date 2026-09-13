"""
Clean and standardize raw rental JSON datasets from 11 Ethiopian property platforms.

This module:
1. Recursively loads JSON from raw/raw/{platform}/ directories
2. Extracts and normalizes rental property data
3. Filters for rental properties (excludes sales, commercial)
4. Standardizes prices (converts USD to ETB at 160.0 rate)
5. Validates and exports to CSV

Supported platforms:
- jiji, qefira, afrotie, beten, engocha, ethiopianproperties,
  ethiopiapropertycentre, livingethio, loozap, realethio, zegebeya
"""

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
RAW_DATA_DIR = Path(__file__).resolve().parents[3] / "raw" / "raw"
PROCESSED_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
OUTPUT_CSV_PATH = PROCESSED_DATA_DIR / "rentals_cleaned.csv"

# Valid Addis Ababa subcities
VALID_SUBCITIES = {
    "bole",
    "yeka",
    "kirkos",
    "nifas silk-lafto",
    "arada",
    "lideta",
    "addis ketema",
    "gullele",
    "akaki kality",
    "kolfe keraniyo",
    "lemi kura",
}

# Neighborhood mapping dictionary mapping local Ethiopian neighborhood keywords to official subcities
NEIGHBORHOOD_MAP: Dict[str, List[str]] = {
    "bole": [
        "bole", "rwanda", "atlas", "edna mall", "bulbula", "gerji", "22",
        "hayahulet", "imperial", "medhanialem", "chichinia", "micheal",
        "ቦሌ", "ሩዋንዳ", "አትላስ", "ቡልቡላ", "ገርጂ", "ሀያሁለት", "መድሃኒአለም",
    ],
    "yeka": [
        "megenagna", "cmc", "ayat", "summit", "kotebe", "ferensay", "gurard",
        "salite mihret", "english oil", "መገናኛ", "ሲኤምሲ", "አያት", "ሰሚት", "ኮተቤ", "ፈረንሳይ",
    ],
    "kirkos": [
        "kazanchis", "meskel square", "beklobet", "gotera", "olympia", "kirkos",
        "cherkos", "urael", "meskel flower", "flamingo", "ካዛንቺስ", "መስቀል አደባባይ",
        "ጎተራ", "ኦሊምፒያ", "ቂርቆስ", "ኡራኤል", "ፍላሚንጎ",
    ],
    "nifas silk-lafto": [
        "sarbet", "bisrate gabriel", "jomo", "lebu", "lafto", "mekanisa",
        "old airport", "hana mariam", "ሳርቤት", "ብስራተ ገብርኤል", "ጆሞ", "ለቡ", "ላፍቶ", "መካኒሳ",
    ],
    "arada": [
        "piazza", "piassa", "4 kilo", "6 kilo", "arat kilo", "siddist kilo",
        "afincho ber", "jan meda", "ፒያሳ", "አራት ኪሎ", "ስድስት ኪሎ",
    ],
    "lideta": [
        "tor hailoch", "mexico", "lideta", "sengatera", "balcha", "abenet",
        "ልደታ", "ሜክሲኮ", "ጦር ኃይሎች",
    ],
    "addis ketema": [
        "mercato", "teklehaymanot", "auto bus tera", "sebategna",
        "መርካቶ", "ተክለሃይማኖት",
    ],
    "gullele": [
        "shiro meda", "addisu kaba", "kechene", "semien hotel", "pastor",
        "ሽሮ ሜዳ", "ጉለሌ",
    ],
    "kolfe keranio": [
        "ayer tena", "bethel", "zenebework", "keraniyo", "asko", "wingate",
        "አየር ጤና", "ኮልፌ",
    ],
    "akaky kaliti": [
        "kaliti", "akaki", "kality", "tulu dimtu",
        "ቃሊቲ", "አቃቂ",
    ],
    "lemi kura": [
        "cmc tsehay", "lemi kura", "summit safari", "fyel bet",
        "ለሚ ኩራ", "ፍየል ቤት", "ሰሚት ሳፋሪ",
    ],
}

CANONICAL_SUBCITIES: Dict[str, str] = {
    "bole": "Bole",
    "yeka": "Yeka",
    "kirkos": "Kirkos",
    "nifas silk-lafto": "Nifas-Silk-Lafto",
    "arada": "Arada",
    "lideta": "Lideta",
    "addis ketema": "Addis-Ketema",
    "gullele": "Gullele",
    "kolfe keranio": "Kolfe-Keranio",
    "kolfe keraniyo": "Kolfe-Keranio",
    "akaky kaliti": "Akaky-Kaliti",
    "akaki kality": "Akaky-Kaliti",
    "lemi kura": "Lemi-Kura",
}

# USD to ETB conversion rate
USD_TO_ETB_RATE = 160.0

# Price bounds (in ETB)
MIN_PRICE_ETB = 1_000
MAX_PRICE_ETB = 3_000_000

# Property type keywords
RENTAL_KEYWORDS = {"rent", "apartment", "house", "residential", "flat"}
EXCLUDE_KEYWORDS = {"sale", "land", "commercial", "office", "warehouse", "shop"}

# Output columns (standardized)
OUTPUT_COLUMNS = [
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


def load_and_parse_json(file_path: Path) -> Optional[Any]:
    """
    Load and parse JSON file.

    Args:
        file_path: Path to JSON file.

    Returns:
        Parsed JSON data (dict or list), or None if parsing fails.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load {file_path}: {e}")
        return None


def extract_value_from_attrs(attrs: List[Dict], attr_name: str) -> Optional[Any]:
    """
    Extract value from jiji-style attrs array.

    Format: [{"name": "Square Metres", "value": 128}, ...]

    Args:
        attrs: List of attribute dicts.
        attr_name: Name of attribute to extract (case-insensitive).

    Returns:
        Value if found, None otherwise.
    """
    if not isinstance(attrs, list):
        return None

    attr_name_lower = attr_name.lower()
    for attr in attrs:
        if isinstance(attr, dict) and attr.get("name", "").lower() == attr_name_lower:
            return attr.get("value")
    return None


# Flatten and sort all neighborhood keywords by length descending so specific/compound phrases match first
SORTED_NEIGHBORHOOD_KEYWORDS: List[Tuple[str, str]] = sorted(
    [
        (kw, subcity_key)
        for subcity_key, keywords in NEIGHBORHOOD_MAP.items()
        for kw in keywords
    ],
    key=lambda item: len(item[0]),
    reverse=True,
)


def normalize_subcity(subcity_str: Optional[str], text_fallback: Optional[str] = None) -> str:
    """
    Normalize subcity name to canonical Addis Ababa subcity or 'Other'.

    1. Checks direct match against known subcities.
    2. Scans subcity string and optional fallback text against NEIGHBORHOOD_MAP
       using word boundaries / regex matching.
    3. Defaults to 'Other' if no match is found.

    Args:
        subcity_str: Raw subcity string.
        text_fallback: Optional additional text (e.g. title, description) to scan if subcity_str doesn't match.

    Returns:
        Canonical subcity name or 'Other'.
    """
    s_clean = ""
    if subcity_str and isinstance(subcity_str, str):
        s_clean = subcity_str.strip().lower().replace("_", " ").replace("-", " ")
        s_clean = " ".join(s_clean.split())
        s_clean_suffix_stripped = re.sub(r",.*$", "", s_clean).strip()
        # Direct exact match check
        for valid in VALID_SUBCITIES:
            if s_clean_suffix_stripped == valid.replace("-", " "):
                return CANONICAL_SUBCITIES.get(valid, valid.title().replace(" ", "-"))

    # Check candidates: subcity string first, then fallback text
    candidates = []
    if s_clean and s_clean != "other":
        candidates.append(s_clean)
    if text_fallback and isinstance(text_fallback, str) and text_fallback.strip():
        candidates.append(text_fallback.strip().lower())

    for text in candidates:
        for kw, subcity_key in SORTED_NEIGHBORHOOD_KEYWORDS:
            pattern = r"(?:^|[^\w])" + re.escape(kw.lower()) + r"(?:[^\w]|$)"
            if re.search(pattern, text):
                return CANONICAL_SUBCITIES.get(subcity_key, subcity_key.title().replace(" ", "-"))

    return "Other"


def parse_price(
    price_str: Optional[str] = None,
    currency: Optional[str] = None,
    price_dict: Optional[Dict] = None,
) -> Optional[float]:
    """
    Parse price from various formats and convert to ETB.

    Handles:
    - "4,350" with currency "$" → 4350 * 160 ETB
    - "28000000" (numeric string) → 28000000 ETB (if valid)
    - "$1000" → 1000 * 160 ETB
    - "28,000,000 ETB" → 28000000 ETB (if valid)

    Args:
        price_str: Price as string.
        currency: Currency code (e.g., '$', 'USD', 'ETB').
        price_dict: Dict with 'price' and optional 'currency' keys.

    Returns:
        Price in ETB as float, or None if parsing fails or outside valid range.
    """
    # Handle dict input
    if price_dict is not None:
        price_str = price_dict.get("price", price_str)
        currency = price_dict.get("currency", currency)

    if not price_str:
        return None

    # Convert to string and clean
    price_str = str(price_str).strip()

    # Extract currency from price_str if not provided
    if not currency:
        if "$" in price_str or "usd" in price_str.lower():
            currency = "USD"
        elif "etb" in price_str.lower() or "br" in price_str.lower():
            currency = "ETB"

    # Remove currency symbols and letters
    price_clean = re.sub(r"[^\d.]", "", price_str)

    if not price_clean:
        return None

    try:
        price = float(price_clean)

        # Convert USD to ETB if needed
        if currency and currency.upper() in {"$", "USD"}:
            price = price * USD_TO_ETB_RATE

        # Validate price range (monthly rental in ETB)
        if price <= MIN_PRICE_ETB or price > MAX_PRICE_ETB:
            return None

        return price
    except (ValueError, TypeError):
        return None


def is_rental_property(data: Dict) -> bool:
    """
    Check if property is a rental (not sale, commercial, etc.).

    Args:
        data: Standardized property data dict.

    Returns:
        True if rental, False otherwise.
    """
    # Check property type
    prop_type = data.get("property_type", "").lower()
    title = data.get("title", "").lower()
    description = data.get("description", "").lower()

    # Combine all text fields
    all_text = f"{prop_type} {title} {description}".lower()

    # Exclude keywords take priority
    for keyword in EXCLUDE_KEYWORDS:
        if keyword in all_text:
            return False

    # Must have rental keyword
    for keyword in RENTAL_KEYWORDS:
        if keyword in all_text:
            return True

    # Default: exclude
    return False


def standardize_record_beten(record: Dict) -> Optional[Dict]:
    """
    Standardize record from Beten platform.

    Schema:
    - number_of_bed_rooms, number_of_baths, area
    - price (numeric string)
    - location_name, subcity
    - property_type_id: {"name": "Rent", "description": "for rent"}
    - description
    """
    try:
        # Extract fields
        property_type = record.get("property_type_id", {})
        if isinstance(property_type, dict):
            property_type_name = property_type.get("name", "").lower()
        else:
            property_type_name = ""

        title = record.get("title") or record.get("property_category_id", {}).get("name", "")
        description = record.get("description", "")
        location_name = record.get("location_name") or record.get("village_name", "")
        subcity = record.get("subcity") or location_name

        return {
            "platform": "beten",
            "property_id": str(record.get("id", "")),
            "title": str(title),
            "description": str(description),
            "price_etb": parse_price(record.get("price")),
            "property_type": property_type_name,
            "subcity": subcity,
            "sq_m": self._parse_numeric(record.get("area")),
            "bedrooms": self._parse_int(record.get("number_of_bed_rooms")),
            "bathrooms": self._parse_numeric(record.get("number_of_baths")),
            "is_furnished": "furnished" in description.lower(),
            "url": None,
        }
    except Exception as e:
        logger.debug(f"Failed to standardize Beten record: {e}")
        return None


def standardize_record_jiji(record: Dict) -> Optional[Dict]:
    """
    Standardize record from Jiji platform (nested attrs structure).

    Schema:
    - advert.attrs: [{"name": "Square Metres", "value": 128}, ...]
    - advert.title, advert.description
    - advert.price
    """
    try:
        advert = record.get("advert", {})
        attrs = advert.get("attrs", [])

        title = advert.get("title", "")
        description = advert.get("description", "")
        price = advert.get("price")

        # Extract from attrs
        sq_m = extract_value_from_attrs(attrs, "Square Metres")
        bedrooms = extract_value_from_attrs(attrs, "Bedrooms")
        bathrooms = extract_value_from_attrs(attrs, "Bathrooms")
        furnishing = extract_value_from_attrs(attrs, "Furnishing")
        address = extract_value_from_attrs(attrs, "Address")
        property_type = extract_value_from_attrs(attrs, "Property Type")

        is_furnished = (
            furnishing and "furnished" in str(furnishing).lower()
        ) or "furnished" in description.lower()

        return {
            "platform": "jiji",
            "property_id": str(record.get("id", "")),
            "title": str(title),
            "description": str(description),
            "price_etb": parse_price(price),
            "property_type": str(property_type).lower() if property_type else "",
            "subcity": address,
            "sq_m": self._parse_numeric(sq_m),
            "bedrooms": self._parse_int(bedrooms),
            "bathrooms": self._parse_numeric(bathrooms),
            "is_furnished": is_furnished,
            "url": advert.get("url"),
        }
    except Exception as e:
        logger.debug(f"Failed to standardize Jiji record: {e}")
        return None


def standardize_record_ethiopiapropertycentre(record: Dict) -> Optional[Dict]:
    """
    Standardize record from Ethiopia Property Centre.

    Schema:
    - content_title, page_title, address
    - price (string), price_currency
    - Bedrooms, Bathrooms, Total Area
    - Type, description
    """
    try:
        title = record.get("content_title") or record.get("page_title", "")
        description = record.get("description", "")
        address = record.get("address", "")
        price = record.get("price")
        currency = record.get("price_currency")
        bedrooms = record.get("Bedrooms")
        bathrooms = record.get("Bathrooms")
        total_area = record.get("Total Area", "")
        property_type = record.get("Type", "")

        # Parse area from string like "220 sqm"
        sq_m = None
        if total_area:
            area_match = re.search(r"(\d+(?:\.\d+)?)", str(total_area))
            if area_match:
                sq_m = float(area_match.group(1))

        return {
            "platform": "ethiopiapropertycentre",
            "property_id": str(record.get("Property Ref", "")),
            "title": str(title),
            "description": str(description),
            "price_etb": parse_price(price, currency),
            "property_type": str(property_type).lower(),
            "subcity": address,
            "sq_m": sq_m,
            "bedrooms": self._parse_int(bedrooms),
            "bathrooms": self._parse_numeric(bathrooms),
            "is_furnished": "furnished" in description.lower(),
            "url": record.get("product_url"),
        }
    except Exception as e:
        logger.debug(f"Failed to standardize Ethiopia Property Centre record: {e}")
        return None


def standardize_record_generic(record: Dict, platform: str) -> Optional[Dict]:
    """
    Generic standardization for other platforms.

    Attempts to extract common field patterns.
    """
    try:
        # Try various title field names
        title = (
            record.get("title")
            or record.get("name")
            or record.get("listing_name")
            or ""
        )

        # Try various description fields
        description = (
            record.get("description")
            or record.get("details")
            or record.get("content")
            or ""
        )

        # Try various price fields
        price = (
            record.get("price")
            or record.get("monthly_price")
            or record.get("rent_price")
        )

        # Currency
        currency = (
            record.get("currency")
            or record.get("price_currency")
        )

        # Location
        subcity = (
            record.get("subcity")
            or record.get("city")
            or record.get("location")
            or record.get("area")
        )

        # Numeric fields with fallbacks
        sq_m = (
            record.get("area")
            or record.get("square_metres")
            or record.get("sqm")
            or record.get("size")
        )
        bedrooms = (
            record.get("bedrooms")
            or record.get("num_bedrooms")
            or record.get("beds")
        )
        bathrooms = (
            record.get("bathrooms")
            or record.get("num_bathrooms")
            or record.get("baths")
        )

        # Furnished flag
        is_furnished = (
            record.get("is_furnished", False)
            or record.get("furnished", False)
            or "furnished" in str(description).lower()
        )

        return {
            "platform": platform,
            "property_id": str(record.get("id", "") or record.get("property_id", "")),
            "title": str(title),
            "description": str(description),
            "price_etb": parse_price(price, currency),
            "property_type": str(record.get("type", "") or record.get("property_type", "")).lower(),
            "subcity": subcity,
            "sq_m": self._parse_numeric(sq_m),
            "bedrooms": self._parse_int(bedrooms),
            "bathrooms": self._parse_numeric(bathrooms),
            "is_furnished": bool(is_furnished),
            "url": record.get("url") or record.get("link"),
        }
    except Exception as e:
        logger.debug(f"Failed to standardize generic record for {platform}: {e}")
        return None


class RentalDataCleaner:
    """Main data cleaning pipeline."""

    @staticmethod
    def _parse_numeric(value: Any) -> Optional[float]:
        """Parse numeric value (handles strings, floats, ints)."""
        if value is None:
            return None
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        """Parse integer value."""
        if value is None:
            return None
        try:
            return int(float(str(value).strip()))
        except (ValueError, TypeError):
            return None

    def standardize_record(self, record: Dict, platform: str) -> Optional[Dict]:
        """
        Standardize record based on platform-specific schema.

        Args:
            record: Raw record dict.
            platform: Platform name.

        Returns:
            Standardized record dict or None if parsing fails.
        """
        if platform == "beten":
            return self.standardize_record_beten(record)
        elif platform == "jiji":
            return self.standardize_record_jiji(record)
        elif platform == "ethiopiapropertycentre":
            return self.standardize_record_ethiopiapropertycentre(record)
        else:
            return self.standardize_record_generic(record, platform)

    def standardize_record_beten(self, record: Dict) -> Optional[Dict]:
        """Standardize Beten record."""
        try:
            property_type = record.get("property_type_id", {})
            if isinstance(property_type, dict):
                property_type_name = property_type.get("name", "").lower()
            else:
                property_type_name = ""

            title = record.get("title") or record.get("property_category_id", {}).get("name", "")
            description = record.get("description", "")
            location_name = record.get("location_name") or record.get("village_name", "")
            subcity = record.get("subcity") or location_name

            return {
                "platform": "beten",
                "property_id": str(record.get("id", "")),
                "title": str(title),
                "description": str(description),
                "price_etb": parse_price(record.get("price")),
                "property_type": property_type_name,
                "subcity": subcity,
                "sq_m": self._parse_numeric(record.get("area")),
                "bedrooms": self._parse_int(record.get("number_of_bed_rooms")),
                "bathrooms": self._parse_numeric(record.get("number_of_baths")),
                "is_furnished": "furnished" in description.lower(),
                "url": None,
            }
        except Exception as e:
            logger.debug(f"Failed to standardize Beten record: {e}")
            return None

    def standardize_record_jiji(self, record: Dict) -> Optional[Dict]:
        """Standardize Jiji record."""
        try:
            advert = record.get("advert", {})
            attrs = advert.get("attrs", [])

            title = advert.get("title", "")
            description = advert.get("description", "")
            price = advert.get("price")

            # Extract from attrs
            sq_m = extract_value_from_attrs(attrs, "Square Metres")
            bedrooms = extract_value_from_attrs(attrs, "Bedrooms")
            bathrooms = extract_value_from_attrs(attrs, "Bathrooms")
            furnishing = extract_value_from_attrs(attrs, "Furnishing")
            address = extract_value_from_attrs(attrs, "Address")
            property_type = extract_value_from_attrs(attrs, "Property Type")

            is_furnished = (
                furnishing and "furnished" in str(furnishing).lower()
            ) or "furnished" in description.lower()

            return {
                "platform": "jiji",
                "property_id": str(record.get("id", "")),
                "title": str(title),
                "description": str(description),
                "price_etb": parse_price(price),
                "property_type": str(property_type).lower() if property_type else "",
                "subcity": address,
                "sq_m": self._parse_numeric(sq_m),
                "bedrooms": self._parse_int(bedrooms),
                "bathrooms": self._parse_numeric(bathrooms),
                "is_furnished": is_furnished,
                "url": advert.get("url"),
            }
        except Exception as e:
            logger.debug(f"Failed to standardize Jiji record: {e}")
            return None

    def standardize_record_ethiopiapropertycentre(self, record: Dict) -> Optional[Dict]:
        """Standardize Ethiopia Property Centre record."""
        try:
            title = record.get("content_title") or record.get("page_title", "")
            description = record.get("description", "")
            address = record.get("address", "")
            price = record.get("price")
            currency = record.get("price_currency")
            bedrooms = record.get("Bedrooms")
            bathrooms = record.get("Bathrooms")
            total_area = record.get("Total Area", "")
            property_type = record.get("Type", "")

            # Parse area from string like "220 sqm"
            sq_m = None
            if total_area:
                area_match = re.search(r"(\d+(?:\.\d+)?)", str(total_area))
                if area_match:
                    sq_m = float(area_match.group(1))

            return {
                "platform": "ethiopiapropertycentre",
                "property_id": str(record.get("Property Ref", "")),
                "title": str(title),
                "description": str(description),
                "price_etb": parse_price(price, currency),
                "property_type": str(property_type).lower(),
                "subcity": address,
                "sq_m": sq_m,
                "bedrooms": self._parse_int(bedrooms),
                "bathrooms": self._parse_numeric(bathrooms),
                "is_furnished": "furnished" in description.lower(),
                "url": record.get("product_url"),
            }
        except Exception as e:
            logger.debug(f"Failed to standardize Ethiopia Property Centre record: {e}")
            return None

    def standardize_record_generic(self, record: Dict, platform: str) -> Optional[Dict]:
        """Generic standardization for other platforms."""
        try:
            title = (
                record.get("title")
                or record.get("name")
                or record.get("listing_name")
                or ""
            )

            description = (
                record.get("description")
                or record.get("details")
                or record.get("content")
                or ""
            )

            price = (
                record.get("price")
                or record.get("monthly_price")
                or record.get("rent_price")
            )

            currency = (
                record.get("currency")
                or record.get("price_currency")
            )

            subcity = (
                record.get("subcity")
                or record.get("city")
                or record.get("location")
                or record.get("area")
            )

            sq_m = (
                record.get("area")
                or record.get("square_metres")
                or record.get("sqm")
                or record.get("size")
            )
            bedrooms = (
                record.get("bedrooms")
                or record.get("num_bedrooms")
                or record.get("beds")
            )
            bathrooms = (
                record.get("bathrooms")
                or record.get("num_bathrooms")
                or record.get("baths")
            )

            is_furnished = (
                record.get("is_furnished", False)
                or record.get("furnished", False)
                or "furnished" in str(description).lower()
            )

            return {
                "platform": platform,
                "property_id": str(record.get("id", "") or record.get("property_id", "")),
                "title": str(title),
                "description": str(description),
                "price_etb": parse_price(price, currency),
                "property_type": str(record.get("type", "") or record.get("property_type", "")).lower(),
                "subcity": subcity,
                "sq_m": self._parse_numeric(sq_m),
                "bedrooms": self._parse_int(bedrooms),
                "bathrooms": self._parse_numeric(bathrooms),
                "is_furnished": bool(is_furnished),
                "url": record.get("url") or record.get("link"),
            }
        except Exception as e:
            logger.debug(f"Failed to standardize generic record for {platform}: {e}")
            return None

    def load_platform_data(self, platform_dir: Path, platform_name: str) -> List[Dict]:
        """
        Load and standardize all JSON files from a platform directory.

        Args:
            platform_dir: Path to platform directory.
            platform_name: Platform name.

        Returns:
            List of standardized records.
        """
        records = []
        json_files = list(platform_dir.glob("*.json"))

        if not json_files:
            logger.warning(f"No JSON files found in {platform_dir}")
            return records

        logger.info(f"Processing {len(json_files)} file(s) from {platform_name}")

        for json_file in json_files:
            data = load_and_parse_json(json_file)
            if data is None:
                continue

            # Handle both dict and list
            items = data if isinstance(data, list) else [data]

            for item in items:
                if not isinstance(item, dict):
                    continue

                # Standardize record
                standardized = self.standardize_record(item, platform_name)
                if standardized:
                    records.append(standardized)

        logger.info(f"Extracted {len(records)} total records from {platform_name}")
        return records

    def clean_and_filter(self, records: List[Dict]) -> pd.DataFrame:
        """
        Filter for rental properties and normalize subcities.

        Args:
            records: List of standardized records.

        Returns:
            DataFrame with filtered and cleaned records.
        """
        df = pd.DataFrame(records)

        logger.info(f"Starting with {len(df)} records")

        # Filter for rentals
        before_filter = len(df)
        df = df[df.apply(lambda row: is_rental_property(row), axis=1)]
        logger.info(f"After rental filter: {len(df)} records ({len(df) - before_filter} removed)")

        # Remove rows missing critical fields
        critical_fields = ["price_etb", "bedrooms", "bathrooms", "sq_m"]
        before_critical = len(df)
        df = df.dropna(subset=critical_fields, how="all")
        logger.info(f"After critical fields check: {len(df)} records ({before_critical - len(df)} removed)")

        # Normalize subcity using neighborhood mapping and title/description fallback
        df["subcity"] = df.apply(
            lambda row: normalize_subcity(
                row.get("subcity"),
                text_fallback=f"{row.get('title', '')} {row.get('description', '')}"
            ),
            axis=1
        )

        # Select final output columns
        output_cols = [col for col in OUTPUT_COLUMNS if col in df.columns]
        df = df[output_cols]

        logger.info(f"Final output: {len(df)} records with columns {output_cols}")
        return df

    def run(self, output_path: Optional[Path] = None) -> pd.DataFrame:
        """
        Run complete cleaning pipeline.

        Args:
            output_path: Path to save CSV (if None, uses default).

        Returns:
            Cleaned DataFrame.
        """
        if not output_path:
            output_path = OUTPUT_CSV_PATH

        logger.info(f"Starting data cleaning pipeline")
        logger.info(f"Raw data directory: {RAW_DATA_DIR}")
        logger.info(f"Output path: {output_path}")

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Discover platforms if raw data directory exists
        if RAW_DATA_DIR.exists() and any(d.is_dir() for d in RAW_DATA_DIR.iterdir()):
            platform_dirs = [d for d in RAW_DATA_DIR.iterdir() if d.is_dir()]
            logger.info(f"Found {len(platform_dirs)} platform(s)")

            all_records = []

            for platform_dir in sorted(platform_dirs):
                platform_name = platform_dir.name
                records = self.load_platform_data(platform_dir, platform_name)
                all_records.extend(records)

            logger.info(f"Total records extracted: {len(all_records)}")

            # Clean and filter
            df_clean = self.clean_and_filter(all_records)
        elif output_path.exists():
            logger.info(f"Raw directory not found or empty. Applying neighborhood normalization to existing {output_path}")
            df_existing = pd.read_csv(output_path)
            df_existing["subcity"] = df_existing.apply(
                lambda row: normalize_subcity(
                    row.get("subcity"),
                    text_fallback=f"{row.get('title', '')} {row.get('description', '')}"
                ),
                axis=1
            )
            df_clean = df_existing
        else:
            raise FileNotFoundError(
                f"Neither raw data directory '{RAW_DATA_DIR}' nor output file '{output_path}' exists."
            )

        # Export
        df_clean.to_csv(output_path, index=False)
        logger.info(f"Exported {len(df_clean)} records to {output_path}")

        return df_clean


def clean_raw_datasets(output_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Main entry point for data cleaning.

    Args:
        output_path: Path to save cleaned CSV (optional).

    Returns:
        Cleaned DataFrame.
    """
    cleaner = RentalDataCleaner()
    return cleaner.run(output_path)


if __name__ == "__main__":
    # Run cleaning pipeline
    df = clean_raw_datasets()
    print(f"\n[OK] Cleaning complete!")
    print(f"Total records: {len(df)}")
    print(f"\nSubcity distribution:")
    print(df['subcity'].value_counts())
    print(f"\nSubcity percentages:")
    print(df['subcity'].value_counts(normalize=True) * 100)
