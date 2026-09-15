#!/usr/bin/env python
"""Quick analysis of cleaned rental data."""

import pandas as pd

df = pd.read_csv(r'c:\projects\HomeLink-Ethiopia\ai\data\processed\rentals_cleaned.csv')

print('✅ Cleaned Rental Data Summary')
print('=' * 60)
print(f'Total records: {len(df):,}')
print(f'Columns: {df.shape[1]}')
print(f'\nColumn names: {list(df.columns)}')

print('\n=== Data Types ===')
print(df.dtypes)

print('\n=== Price Statistics (ETB) ===')
print(df['price_etb'].describe())

print('\n=== Area (sqm) Statistics ===')
print(df['sq_m'].describe())

print('\n=== Bedrooms Distribution ===')
print(df['bedrooms'].value_counts().sort_index().head(10))

print('\n=== Top 10 Subcities ===')
print(df['subcity'].value_counts().head(10))

print('\n=== Platform Distribution ===')
print(df['platform'].value_counts())

print('\n=== Furnished vs Unfurnished ===')
print(df['is_furnished'].value_counts())

print('\n=== Missing Values ===')
missing = df.isnull().sum()
print(missing[missing > 0])
