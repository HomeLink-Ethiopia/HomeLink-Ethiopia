# Data Cleaning Pipeline - Quick Reference Guide

## 🚀 Quick Start

### Run the Complete Cleaning Pipeline
```bash
cd ai/
python -m src.preprocessing.clean_data
```

**Output**: `ai/data/processed/rentals_cleaned.csv` (4,228 records)

---

## 📊 Using the Cleaned Data

### Load in Python
```python
import pandas as pd

# Load cleaned rental data
df = pd.read_csv('ai/data/processed/rentals_cleaned.csv')

print(f"Total records: {len(df)}")
print(df.head())
print(df.info())
```

### Use in ML Training
```python
from src.preprocessing.clean_data import clean_raw_datasets

# Run pipeline and get DataFrame
df = clean_raw_datasets()

# Use for model training
X = df[['bedrooms', 'bathrooms', 'sq_m', 'price_etb', 'subcity', 'is_furnished']]
y = df['price_etb']  # or your target
```

---

## 🧪 Run Unit Tests

```bash
cd ai/

# Run all tests
pytest tests/test_clean_data.py -v

# Run specific test class
pytest tests/test_clean_data.py::TestPriceParsing -v

# Run with coverage
pytest tests/test_clean_data.py --cov=src.preprocessing
```

**Result**: 41 tests, 100% pass rate

---

## 📈 Analyze the Data

```bash
cd ai/
python analyze_data.py
```

Shows:
- Data summary statistics
- Price distribution
- Bedroom/bathroom counts
- Subcity distribution
- Platform breakdown
- Furnished vs unfurnished split
- Missing values report

---

## 📁 File Structure

```
ai/
├── src/preprocessing/
│   ├── __init__.py (exports)
│   └── clean_data.py (1,100+ lines)
│
├── tests/
│   └── test_clean_data.py (41 tests)
│
├── data/
│   ├── ethiopia_housing_data.csv (synthetic, old)
│   └── processed/
│       └── rentals_cleaned.csv (4,228 real records)
│
├── analyze_data.py (quick analysis)
└── requirements.txt
```

---

## 🔧 Key Functions

### Main Entry Point
```python
from src.preprocessing.clean_data import clean_raw_datasets

# Run complete pipeline
df = clean_raw_datasets(output_path=Path('custom/path.csv'))
```

### Individual Utilities
```python
from src.preprocessing.clean_data import (
    parse_price,              # Parse & convert prices
    normalize_subcity,        # Normalize locations
    is_rental_property,       # Filter for rentals
    load_and_parse_json,      # Load JSON
    RentalDataCleaner,        # Full cleaner class
)

# Example: Convert USD price
price_etb = parse_price("4,350", currency="$")
# Result: 696,000 ETB

# Example: Normalize location
subcity = normalize_subcity("Bole, Addis Ababa")
# Result: "Bole"

# Example: Check if rental
is_rental = is_rental_property({
    "title": "2 Bed Apartment for Rent",
    "property_type": "apartment"
})
# Result: True
```

---

## 📊 Output Data Schema

**Cleaned CSV columns** (11 total):

| Column | Type | Description |
|--------|------|-------------|
| `platform` | string | Source: beten, jiji, qefira, etc. |
| `property_id` | string | Unique ID from source |
| `title` | string | Property name |
| `description` | string | Full description |
| `price_etb` | float | Monthly rent (ETB) |
| `subcity` | string | Addis Ababa subcity or "Other" |
| `sq_m` | float | Floor area (square meters) |
| `bedrooms` | float | Number of bedrooms |
| `bathrooms` | float | Number of bathrooms |
| `is_furnished` | boolean | true/false |
| `url` | string | Source URL |

---

## ⚙️ Configuration & Constraints

### Price Validation
- **Minimum**: 1,000 ETB
- **Maximum**: 3,000,000 ETB
- **Currency**: USD→ETB at 160.0 rate

### Rental Filtering
- **Includes**: "rent", "apartment", "house", "residential", "flat"
- **Excludes**: "sale", "land", "commercial", "office", "warehouse"

### Valid Subcities (Addis Ababa)
1. Bole
2. Yeka
3. Kirkos
4. Nifas Silk-Lafto
5. Arada
6. Lideta
7. Addis Ketema
8. Gullele
9. Akaki Kality
10. Kolfe Keraniyo

Any unrecognized location → "Other"

---

## 📋 Data Quality Insights

### Records by Source
- **jiji**: 2,306 (54.5%)
- **ethiopiapropertycentre**: 608 (14.4%)
- **realethio**: 506 (12.0%)
- **ethiopianproperties**: 392 (9.3%)
- **livingethio**: 308 (7.3%)
- Others: 108 (2.5%)

### Missing Data
- `price_etb`: 55% missing (removed)
- `sq_m`: 89% missing (area data sparse)
- `bedrooms`: 27% missing
- `bathrooms`: 28% missing

### Price Distribution
- **Min**: 1,760 ETB
- **Mean**: 320,263 ETB
- **Median**: 203,000 ETB
- **Max**: 2,720,000 ETB

### Furnishing
- **Furnished**: 69% (2,917 records)
- **Unfurnished**: 31% (1,311 records)

---

## 🐛 Troubleshooting

### Issue: "Module not found"
```bash
# Ensure you're in the ai/ directory
cd ai/
python -m src.preprocessing.clean_data
```

### Issue: "Output file not created"
```bash
# Check output directory exists
mkdir -p ai/data/processed
python -m src.preprocessing.clean_data
```

### Issue: "Low record count (<100)"
- Check raw data in `raw/raw/` directories
- Verify JSON files are valid
- Check rental filtering rules (may be too strict)

### Issue: "Tests failing"
```bash
# Install test dependencies
pip install pytest pytest-cov

# Run with verbose output
pytest tests/test_clean_data.py -vv --tb=short
```

---

## 📚 Documentation

- **Complete Report**: [DATA_CLEANING_REPORT.md](../DATA_CLEANING_REPORT.md)
- **Original Data Status**: [DATA_PIPELINE_STATUS.md](../DATA_PIPELINE_STATUS.md)
- **Code**: [ai/src/preprocessing/clean_data.py](../../ai/src/preprocessing/clean_data.py)
- **Tests**: [ai/tests/test_clean_data.py](../../ai/tests/test_clean_data.py)

---

## 🔄 Integration with ML Pipeline

### Before (Synthetic Data)
```
generate_dataset.py (200 rows, synthetic)
  ↓
train_rent_model.py
train_fraud_model.py
```

### After (Real Data)
```
clean_raw_datasets() (4,228 rows, real)
  ↓
train_rent_model.py (retrain with real data)
train_fraud_model.py (retrain with real descriptions)
  ↓
Better model accuracy on real market
```

### Retraining Example
```python
# Load real cleaned data
df_real = pd.read_csv('ai/data/processed/rentals_cleaned.csv')

# Prepare features
X = df_real[['bedrooms', 'bathrooms', 'sq_m', 'subcity', 'is_furnished']]
y = df_real['price_etb'].dropna()

# Filter X to match y
X = X[y.index]

# Train (this would replace the synthetic training)
# model = train_rent_model(X, y)
```

---

## ✅ Checklist for Production Use

- [x] Pipeline extracts from all 11 platforms
- [x] 4,228+ valid rental records
- [x] 41 unit tests passing
- [x] Price normalization (USD→ETB)
- [x] Subcity standardization
- [x] Rental filtering (exclude sales/commercial)
- [x] CSV output with standardized schema
- [x] Data quality report generated
- [ ] Address geocoding (location parsing improvement)
- [ ] Automated daily retraining
- [ ] Data quality monitoring dashboard

---

## 📞 Support

For issues or questions:
1. Check [DATA_CLEANING_REPORT.md](../DATA_CLEANING_REPORT.md) for full details
2. Review test cases in [test_clean_data.py](../../ai/tests/test_clean_data.py)
3. Run `python analyze_data.py` for data statistics
4. Check raw files in `raw/raw/` for source data

---

**Status**: 🟢 Ready for Production  
**Version**: 1.0  
**Last Updated**: 2026-08-18
