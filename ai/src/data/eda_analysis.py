"""Compute EDA metrics for the cleaned Addis Ababa rental dataset."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable

import numpy as np
import pandas as pd


AI_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = AI_ROOT / "data"
PROCESSED_DIR = DATA_DIR / "processed"
DOCS_DIR = AI_ROOT / "docs"
ROOT_DOCS_DIR = AI_ROOT.parent / "docs"
SUMMARY_PATH = DOCS_DIR / "eda_summary.json"
ROOT_SUMMARY_PATH = ROOT_DOCS_DIR / "eda_summary.json"

NUMERIC_COLUMNS = ["price_etb", "size_sqm", "bedrooms", "bathrooms"]


def load_dataset() -> pd.DataFrame:
    """Load the cleaned listings dataset, falling back to the earlier cleaned export if needed."""
    primary = PROCESSED_DIR / "cleaned_rent_data.csv"
    fallback = PROCESSED_DIR / "real_listings_cleaned.csv"

    for path in (primary, fallback):
        if path.exists():
            return pd.read_csv(path)

    raise FileNotFoundError("No cleaned dataset found in ai/data/processed/")


def describe_numeric(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """Return descriptive stats for numeric columns."""
    output: Dict[str, Dict[str, float]] = {}
    for column in NUMERIC_COLUMNS:
        if column not in df.columns:
            continue
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            output[column] = {
                "count": 0,
                "mean": None,
                "std": None,
                "median": None,
                "min": None,
                "max": None,
                "skewness": None,
            }
            continue

        output[column] = {
            "count": int(series.count()),
            "mean": float(series.mean()),
            "std": float(series.std(ddof=1)) if series.count() > 1 else 0.0,
            "median": float(series.median()),
            "min": float(series.min()),
            "max": float(series.max()),
            "skewness": float(series.skew()),
        }
    return output


def compute_target_skewness(df: pd.DataFrame) -> Dict[str, float | None]:
    """Compute raw and log-target skewness."""
    if "price_etb" not in df.columns:
        return {"raw": None, "log1p": None}

    price = pd.to_numeric(df["price_etb"], errors="coerce").dropna()
    if price.empty:
        return {"raw": None, "log1p": None}

    return {
        "raw": float(price.skew()),
        "log1p": float(np.log1p(price).skew()),
    }


def compute_correlations(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """Compute Pearson correlations between numeric features and price_etb."""
    numeric = df[list(NUMERIC_COLUMNS)].copy()
    for column in numeric.columns:
        numeric[column] = pd.to_numeric(numeric[column], errors="coerce")
    numeric = numeric.dropna()

    if numeric.empty:
        return {}

    corr = numeric.corr(method="pearson")
    return {
        str(column): {str(other): float(value) for other, value in corr[column].items()}
        for column in corr.columns
    }


def compute_categorical_counts(df: pd.DataFrame) -> Dict[str, Dict[str, int]]:
    """Count frequencies for categorical fields."""
    output: Dict[str, Dict[str, int]] = {}
    for column in ("subcity", "furnished"):
        if column not in df.columns:
            continue
        counts = df[column].fillna("Unknown").astype(str).value_counts().to_dict()
        output[column] = {str(key): int(value) for key, value in counts.items()}
    return output


def build_summary() -> Dict[str, Any]:
    """Build the EDA summary package for JSON output."""
    df = load_dataset()
    return {
        "summary_stats": describe_numeric(df),
        "target_skewness": compute_target_skewness(df),
        "correlations": compute_correlations(df),
        "subcity_counts": compute_categorical_counts(df).get("subcity", {}),
        "furnished_counts": compute_categorical_counts(df).get("furnished", {}),
    }


def main() -> Dict[str, Any]:
    """Compute the EDA summary and write it to the AI docs folder plus repo-root docs folder."""
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    ROOT_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    summary = build_summary()
    for target in (SUMMARY_PATH, ROOT_SUMMARY_PATH):
        try:
            with target.open("w", encoding="utf-8") as handle:
                json.dump(summary, handle, indent=2)
        except OSError:
            pass
    return summary


if __name__ == "__main__":
    main()
