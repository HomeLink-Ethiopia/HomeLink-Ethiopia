"""Generate a realistic synthetic dataset of Addis Ababa rental listings.

Produces ``ai/data/ethiopia_housing_data.csv`` with 1,000+ rows of
synthetic rental properties. Prices follow plausible Addis Ababa market
logic: central subcities (Bole, Kirkos) carry a higher ETB/sqm rate
while outskirts (Akaky Kaliti, Kolfe) are cheaper, with per-property
premiums for bedrooms, bathrooms, water tanks, generators and
furnishing. Each listing also carries a synthetic ``description_text``
so the NLP (TF-IDF) fraud model has real text to learn from.

Run from ``ai/``:

    python -m src.generate_dataset

The output CSV is consumed by ``ai/src/train_rent_model.py`` and
``ai/src/train_fraud_model.py``.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT_CSV_PATH = DATA_DIR / "ethiopia_housing_data.csv"

N_ROWS = 2000
SEED = 42

#: Subcities as they appear in the CSV (display casing).
SUBCITIES: list[str] = [
    "Bole",
    "Yeka",
    "Kirkos",
    "Arada",
    "Nifas Silk",
    "Gulele",
    "Kolfe",
    "Lidetta",
    "Akaky Kaliti",
    "Addis Ketema",
]

#: Relative likelihood of a listing coming from each subcity.
SUBCITY_WEIGHTS: dict[str, float] = {
    "Bole": 0.18,
    "Yeka": 0.14,
    "Kirkos": 0.13,
    "Arada": 0.11,
    "Nifas Silk": 0.10,
    "Gulele": 0.09,
    "Kolfe": 0.08,
    "Lidetta": 0.06,
    "Akaky Kaliti": 0.06,
    "Addis Ketema": 0.05,
}

#: Baseline monthly rent (ETB) per square metre per subcity.
SUBCITY_RATE_PER_SQM: dict[str, float] = {
    "Bole": 340.0,
    "Kirkos": 320.0,
    "Arada": 300.0,
    "Yeka": 265.0,
    "Nifas Silk": 240.0,
    "Gulele": 225.0,
    "Kolfe": 215.0,
    "Lidetta": 210.0,
    "Addis Ketema": 205.0,
    "Akaky Kaliti": 190.0,
}

#: Probability that a unit has a private water tank (outskirts higher).
WATER_TANK_PROB: dict[str, float] = {
    "Bole": 0.25,
    "Kirkos": 0.30,
    "Arada": 0.30,
    "Lidetta": 0.35,
    "Yeka": 0.55,
    "Gulele": 0.60,
    "Nifas Silk": 0.65,
    "Addis Ketema": 0.60,
    "Kolfe": 0.70,
    "Akaky Kaliti": 0.75,
}

#: Probability that a unit has a backup generator (outskirts higher).
GENERATOR_PROB: dict[str, float] = {
    "Bole": 0.12,
    "Kirkos": 0.15,
    "Arada": 0.18,
    "Lidetta": 0.18,
    "Yeka": 0.25,
    "Gulele": 0.30,
    "Nifas Silk": 0.30,
    "Addis Ketema": 0.30,
    "Kolfe": 0.35,
    "Akaky Kaliti": 0.40,
}

#: Probability that a unit is rented furnished (central/high-end higher).
FURNISHED_PROB: dict[str, float] = {
    "Bole": 0.40,
    "Kirkos": 0.35,
    "Arada": 0.30,
    "Lidetta": 0.30,
    "Yeka": 0.25,
    "Gulele": 0.20,
    "Nifas Silk": 0.20,
    "Kolfe": 0.15,
    "Addis Ketema": 0.15,
    "Akaky Kaliti": 0.10,
}

#: Monthly premium (ETB) per bedroom / bathroom.
BEDROOM_PREMIUM = 2200.0
BATHROOM_PREMIUM = 1200.0

#: Monthly premium (ETB) for a water tank or generator.
WATER_TANK_PREMIUM = 1800.0
GENERATOR_PREMIUM = 2600.0

#: Multiplicative uplift applied to furnished units.
FURNISHED_MULTIPLIER = 1.15

#: Phrase banks used to compose realistic, varied descriptions.
DESCRIPTION_OPENERS: tuple = (
    "{bedrooms}-bedroom apartment in {subcity} available for rent.",
    "Rent a {bedrooms}-bedroom home located in {subcity}.",
    "Apartment with {bedrooms} bedrooms in {subcity}, now available.",
    "{bedrooms}-bedroom unit in {subcity} for long-term rental.",
)
DESCRIPTION_SIZES: tuple = (
    "About {area:,.0f} square metres of living space.",
    "Floor space of {area:,.0f} square metres.",
    "{area:,.0f} square metres, well laid out.",
)
DESCRIPTION_CLOSERS: tuple = (
    "Quiet neighbourhood with good access to transport.",
    "Ideal for families or professionals.",
    "Well maintained and secure.",
    "Close to schools and markets.",
)


def _build_description(
    rng: np.random.Generator,
    subcity: str,
    bedrooms: int,
    area_sqm: float,
    has_water_tank: bool,
    has_generator: bool,
    is_furnished: bool,
) -> str:
    """Compose a realistic synthetic property description.

    Phrases are picked deterministically from the variant banks using
    the shared random generator so the output is fully reproducible.
    """
    opener = DESCRIPTION_OPENERS[int(rng.integers(len(DESCRIPTION_OPENERS)))].format(
        subcity=subcity, bedrooms=bedrooms
    )
    size = DESCRIPTION_SIZES[int(rng.integers(len(DESCRIPTION_SIZES)))].format(
        area=float(area_sqm)
    )

    amenities = []
    if has_water_tank:
        amenities.append("Features a private water tank.")
    if has_generator:
        amenities.append("Comes with a backup generator.")
    if is_furnished:
        amenities.append("Furnished and ready to move in.")
    if not amenities:
        amenities.append("Well maintained apartment.")

    closer = DESCRIPTION_CLOSERS[int(rng.integers(len(DESCRIPTION_CLOSERS)))]
    return " ".join([opener, size, *amenities, closer])


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


def _sample_subcities(rng: np.random.Generator, n: int) -> list[str]:
    """Sample subcity names using market-share weights."""
    names = list(SUBCITY_WEIGHTS)
    weights = [SUBCITY_WEIGHTS[name] for name in names]
    return rng.choice(names, size=n, p=weights).tolist()


def _sample_area_sqm(rng: np.random.Generator, bedrooms: np.ndarray) -> np.ndarray:
    """Sample floor area correlated with the number of bedrooms."""
    area = 42.0 + bedrooms * 22.0 + rng.normal(0.0, 12.0, size=len(bedrooms))
    return np.clip(np.round(area, 1), 30.0, 220.0)


def _sample_bathrooms(rng: np.random.Generator, bedrooms: np.ndarray) -> np.ndarray:
    """Sample bathroom counts that scale with bedrooms."""
    bathrooms = np.clip(np.rint(bedrooms * 0.6 + rng.normal(0.0, 0.4, size=len(bedrooms))), 1, 3)
    return bathrooms.astype(int)


def _rent_price_etb(
    subcity: str,
    area_sqm: float,
    bedrooms: int,
    bathrooms: int,
    has_water_tank: bool,
    has_generator: bool,
    is_furnished: bool,
) -> float:
    """Compute a realistic monthly rent in ETB for one listing."""
    price = SUBCITY_RATE_PER_SQM[subcity] * area_sqm
    price += bedrooms * BEDROOM_PREMIUM
    price += bathrooms * BATHROOM_PREMIUM
    if has_water_tank:
        price += WATER_TANK_PREMIUM
    if has_generator:
        price += GENERATOR_PREMIUM
    if is_furnished:
        price *= FURNISHED_MULTIPLIER
    price = max(price, 500.0)
    # Round to the nearest 500 ETB, as Addis landlords typically quote.
    return float(np.round(price / 500.0) * 500.0)


def generate_dataframe(rng: np.random.Generator, n_rows: int = N_ROWS) -> pd.DataFrame:
    """Generate a DataFrame of ``n_rows`` synthetic rental listings.

    Args:
        rng: Numpy random generator (seeded for reproducibility).
        n_rows: Number of listings to generate (default ``N_ROWS``).

    Returns:
        A DataFrame with the canonical listing columns.
    """
    subcities = _sample_subcities(rng, n_rows)
    bedrooms = rng.integers(1, 6, size=n_rows)  # 1-5 bedrooms
    bathrooms = _sample_bathrooms(rng, bedrooms)
    area_sqm = _sample_area_sqm(rng, bedrooms)

    has_water_tank = [
        bool(rng.random() < WATER_TANK_PROB[sub]) for sub in subcities
    ]
    has_generator = [
        bool(rng.random() < GENERATOR_PROB[sub]) for sub in subcities
    ]
    is_furnished = [
        bool(rng.random() < FURNISHED_PROB[sub]) for sub in subcities
    ]

    rows = []
    for i in range(n_rows):
        rows.append(
            {
                "subcity": subcities[i],
                "bedrooms": int(bedrooms[i]),
                "bathrooms": int(bathrooms[i]),
                "area_sqm": float(area_sqm[i]),
                "has_water_tank": has_water_tank[i],
                "has_generator": has_generator[i],
                "is_furnished": is_furnished[i],
                "description_text": _build_description(
                    rng=rng,
                    subcity=subcities[i],
                    bedrooms=int(bedrooms[i]),
                    area_sqm=float(area_sqm[i]),
                    has_water_tank=has_water_tank[i],
                    has_generator=has_generator[i],
                    is_furnished=is_furnished[i],
                ),
                "rent_price_etb": _rent_price_etb(
                    subcity=subcities[i],
                    area_sqm=float(area_sqm[i]),
                    bedrooms=int(bedrooms[i]),
                    bathrooms=int(bathrooms[i]),
                    has_water_tank=has_water_tank[i],
                    has_generator=has_generator[i],
                    is_furnished=is_furnished[i],
                ),
            }
        )

    df = pd.DataFrame(rows)
    # Store flags as 0/1 so the CSV round-trips cleanly through sklearn.
    df["has_water_tank"] = df["has_water_tank"].astype(int)
    df["has_generator"] = df["has_generator"].astype(int)
    df["is_furnished"] = df["is_furnished"].astype(int)
    return df


def main() -> None:
    """Generate the synthetic dataset and write it to ``ai/data/``."""
    rng = np.random.default_rng(SEED)
    df = generate_dataframe(rng)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_CSV_PATH, index=False)

    print(f"Wrote {len(df):,} rows to {OUTPUT_CSV_PATH}")
    print(f"Rent ETB -> min {df['rent_price_etb'].min():,.0f} | "
          f"median {df['rent_price_etb'].median():,.0f} | "
          f"max {df['rent_price_etb'].max():,.0f}")
    print("\nAverage rent by subcity:")
    print(df.groupby("subcity")["rent_price_etb"].mean().round(0).to_string())


if __name__ == "__main__":
    main()
