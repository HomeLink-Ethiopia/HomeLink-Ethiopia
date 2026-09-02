"""Validate future raw CSV files against the expected rental schema."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

import pandas as pd


AI_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = AI_ROOT / "data" / "raw" / "data_schema.json"


def load_schema(path: Path | str = SCHEMA_PATH) -> Dict[str, Any]:
    """Load the expected schema definition from JSON."""
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_schema(df: pd.DataFrame, schema: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Validate that the dataframe matches the expected schema.

    Returns a dict with validation result and details.
    """
    if schema is None:
        schema = load_schema()

    required_fields = schema.get("required_fields", [])
    missing = [field for field in required_fields if field not in df.columns]
    allowed_types = schema.get("field_types", {})
    type_issues: List[str] = []

    for field in required_fields:
        if field not in df.columns:
            continue
        expected_type = allowed_types.get(field)
        if expected_type and df[field].dtype.name not in expected_type:
            type_issues.append(f"{field} has dtype {df[field].dtype.name}, expected one of {expected_type}")

    return {
        "valid": not missing and not type_issues,
        "missing_fields": missing,
        "type_issues": type_issues,
    }


def main() -> None:
    """Command-line entry point for schema validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate a CSV against the expected rental schema.")
    parser.add_argument("csv_path", type=Path, help="CSV file to validate.")
    parser.add_argument("--schema", type=Path, default=SCHEMA_PATH, help="Schema JSON path.")
    args = parser.parse_args()

    df = pd.read_csv(args.csv_path)
    schema = load_schema(args.schema)
    result = validate_schema(df, schema)
    print(json.dumps(result, indent=2))

    if not result["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
