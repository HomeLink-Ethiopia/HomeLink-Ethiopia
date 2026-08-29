# HomeLink AI Engine

AI microservice for **HomeLink-Ethiopia**: monthly rent estimation in ETB,
tenant property recommendations, and listing fraud-risk detection.

## Quick Start

```bash
cd ai/
pip install -r requirements.txt
uvicorn main:app --reload        # starts on http://localhost:8000
# Interactive docs: http://localhost:8000/docs
```

### Docker

```bash
docker build -t homelink-ai ./ai
docker run -p 8000:8000 homelink-ai
```

The image uses `python:3.12-slim`, installs dependencies without cache,
and runs `uvicorn main:app --host 0.0.0.0 --port 8000`.

---

## Dataset Provenance & Cleaning Summary

| Attribute | Detail |
|-----------|--------|
| Source | Synthetic generator (`ai/src/generate_dataset.py`) |
| File | `ai/data/ethiopia_housing_data.csv` |
| Rows | 2,000 |
| Target | `rent_price_etb` (monthly rent in Ethiopian Birr) |
| Seed | 42 (fully reproducible) |

### Cleaning steps applied at training time

1. `subcity` lowercased and stripped (case-insensitive matching).
2. Boolean flags (`has_water_tank`, `has_generator`, `is_furnished`)
   coerced from mixed representations (`1`/`0`, `true`/`false`,
   `True`/`False`) to integer `1`/`0`.
3. No missing values in the synthetic dataset; no imputation required.
4. No coordinate columns (latitude/longitude are **not** used).

### Feature columns

| Feature | Type | Description |
|---------|------|-------------|
| `subcity` | Categorical | One of 10 Addis Ababa subcities (one-hot encoded) |
| `bedrooms` | Numeric (int) | Number of bedrooms (1-5 in training data) |
| `bathrooms` | Numeric (int) | Number of bathrooms (1-3) |
| `area_sqm` | Numeric (float) | Floor area in square metres (~30-220) |
| `has_water_tank` | Binary | 1 = private water tank present |
| `has_generator` | Binary | 1 = backup generator present |
| `is_furnished` | Binary | 1 = unit rented furnished |

### Subcity base rates (ETB/sqm)

| Subcity | Rate | Subcity | Rate |
|---------|------|---------|------|
| Bole | 340 | Gulele | 225 |
| Kirkos | 320 | Kolfe | 215 |
| Arada | 300 | Lidetta | 210 |
| Yeka | 265 | Addis Ketema | 205 |
| Nifas Silk | 240 | Akaky Kaliti | 190 |

---

## Baseline vs. Model Performance Comparison

All metrics on a **held-out test split** (20% of 2,000 rows = 400 samples),
split with `random_state=42`.

| Metric | Median Baseline | LinearRegression | RandomForest (Tuned) |
|--------|:-:|:-:|:-:|
| **MAE (ETB)** | 3,978 | 1,586 | **1,149** |
| **RMSE (ETB)** | 5,015 | 2,094 | **1,570** |
| **R²** | 0.8861 | 0.9802 | **0.9888** |

### Improvement of ML model over median baseline

| Metric | Improvement |
|--------|:-----------:|
| MAE reduction | **71.1%** |
| RMSE reduction | **68.7%** |
| R² delta | **+0.1027** |

### Best hyperparameters (GridSearchCV, 5-fold CV)

```
n_estimators:     300
max_depth:        20
min_samples_split: 2
min_samples_leaf:  1
```

Cross-validation R² (mean +/- std): **0.9871 +/- 0.0027**

---

## Rent Estimation Model — Architecture

```
Input JSON
    |
    v
Pydantic validation (bedrooms, bathrooms, area_sqm, subcity, ...)
    |
    v
ColumnTransformer
    |-- passthrough: bedrooms, bathrooms, area_sqm,
    |                has_water_tank, has_generator, is_furnished
    |-- OneHotEncoder(handle_unknown="ignore"): subcity
    |
    v
RandomForestRegressor (n_estimators=300, max_depth=20)
    |
    v
RentEstimateResponse { estimated_rent_etb, confidence, model_used, model_version }
```

- **ML confidence**: 0.92 (when `rent_model.joblib` is loaded)
- **Heuristic fallback confidence**: 0.58 (deterministic rule-based estimate)
- Model artifact: `ai/models/rent_model.joblib` (`rent-v1.1.0`)

---

## OpenAPI Schema: `POST /api/v1/estimate-rent`

### Request Body

```json
{
  "subcity": "bole",
  "bedrooms": 2,
  "bathrooms": 1,
  "area_sqm": 85.5,
  "has_water_tank": true,
  "has_generator": false,
  "is_furnished": true
}
```

| Field | Type | Constraints | Required |
|-------|------|-------------|:--------:|
| `subcity` | string | `1 <= len <= 50` | yes |
| `bedrooms` | integer | `0 <= value <= 20` | yes |
| `bathrooms` | integer | `0 <= value <= 20` | yes |
| `area_sqm` | float | `0 < value <= 100000`, must be >= 10 | yes |
| `has_water_tank` | boolean | default `false` | no |
| `has_generator` | boolean | default `false` | no |
| `is_furnished` | boolean | default `false` | no |

**Custom validation rules** (return HTTP 422):
- `bedrooms=0` AND `bathrooms=0` is rejected ("must have at least one").
- `area_sqm < 10` is rejected as unrealistically small.
- Empty `subcity` string is rejected.

### Response Body (200 OK)

```json
{
  "estimated_rent_etb": 32450.0,
  "confidence": 0.92,
  "model_used": "rent_model.joblib",
  "model_version": "rent-v1.1.0",
  "input_summary": {
    "subcity": "bole",
    "bedrooms": 2,
    "bathrooms": 1,
    "area_sqm": 85.5,
    "has_water_tank": true,
    "has_generator": false,
    "is_furnished": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `estimated_rent_etb` | float | Predicted monthly rent in Ethiopian Birr |
| `confidence` | float | 0.0-1.0 (ML: 0.92, heuristic: 0.58) |
| `model_used` | string | `"rent_model.joblib"` or `"heuristic-baseline"` |
| `model_version` | string | API/model version from manifest (`"rent-v1.1.0"`) |
| `input_summary` | object | Echo of the validated input |

### Error Responses

| Status | Trigger |
|--------|---------|
| 422 | Missing required field, negative values, `area_sqm < 10`, `bedrooms=0 && bathrooms=0`, empty `subcity` |
| 500 | Internal prediction failure (falls back to heuristic) |

---

## Fraud Analysis: `POST /fraud/analyze`

### Endpoint contract

This explainable fraud-risk endpoint is optimized for real estate listing screening without requiring a labeled fraud dataset.

#### Request body

```json
{
  "title": "2BR apartment in Bole",
  "description": "Bright 2-bedroom apartment with balcony. Available immediately. Please contact us for viewing.",
  "price": 35000,
  "subcity": "bole",
  "bedrooms": 2,
  "bathrooms": 1,
  "size_sqm": 80,
  "furnished": 1
}
```

| Field | Type | Constraints | Required |
|-------|------|-------------|:--------:|
| `title` | string | `min_length=1` | yes |
| `description` | string | `min_length=1` | yes |
| `price` | float | `> 0` | yes |
| `subcity` | string | `min_length=1` | yes |
| `bedrooms` | integer | `>= 0` | yes |
| `bathrooms` | integer | `>= 0` | yes |
| `size_sqm` | float | `> 0` | yes |
| `furnished` | integer | `0 or 1` | yes |

#### Response body

```json
{
  "risk_score": 15,
  "risk_level": "low",
  "red_flags": [],
  "confidence": 0.85,
  "model_version": "fraud-risk-v1"
}
```

#### curl example

```bash
curl -X POST http://localhost:8000/fraud/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2BR apartment in Bole",
    "description": "Bright 2-bedroom apartment with balcony. Available immediately.",
    "price": 35000,
    "subcity": "bole",
    "bedrooms": 2,
    "bathrooms": 1,
    "size_sqm": 80,
    "furnished": 1
  }'
```

### Risk logic

The engine combines a price anomaly check against the market-rent estimate and suspicious text scanning for scam-like payment language. It adds red flags for:

- suspiciously low prices relative to estimated market rent
- suspiciously high prices relative to estimated market rent
- payment or transfer language such as "advance payment", "wire transfer", "western union", "urgent cash", "pay before viewing", or "bank transfer before inspection"

The final score is capped at 0-100 and mapped as:

- `0-30`: low
- `31-70`: medium
- `71-100`: high

## Fraud Analysis: `POST /api/v1/detect-fraud`

### Methodology

The fraud analysis engine computes a **composite risk score (0-100)** from
three independent, weighted signals:

```
                    +-------------------+
                    |  Input Listing    |
                    |  (price, area,    |
                    |   bedrooms, desc) |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v-------+ +---v--------+ +---v-----------+
     | Price Anomaly  | | Text &     | | ML Anomaly    |
     | Signal (0-40)  | | Metadata   | | Signal (0-30) |
     |                | | (0-30)     | |               |
     | Compares price | | Scans desc | | IsolationForest|
     | vs. rent model | | for scams  | | + TF-IDF      |
     | market estimate| | & metadata | | from fraud    |
     |                | | patterns   | | model.joblib  |
     +--------+-------+ +----+-------+ +-------+-------+
              |              |              |
              +--------------+--------------+
                             |
                    +--------v----------+
                    |  risk_score       |
                    |  (0-100, integer) |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  risk_level       |
                    | low | medium | high|
                    +-------------------+
```

### Signal Details

#### 1. Price Anomaly Signal (0-40 points)

Compares the listing's asking price against the rent model's market
estimate for the same property attributes (subcity, bedrooms, bathrooms,
area). The deviation percentage triggers flags at these thresholds:

| Condition | Points | Flag |
|-----------|:------:|------|
| Price < 55% of estimate (deviation < -45%) | 40 | Severe underpricing |
| Price 55-75% of estimate (-45% to -25%) | 24 | Moderate underpricing |
| Price > 250% of estimate (deviation > 150%) | 34 | Extreme overpricing |
| Price 200-250% of estimate (100% to 150%) | 16 | Significant overpricing |
| Price within -25% to +100% of estimate | 0 | No flag |

#### 2. Text & Metadata Red Flags (0-30 points)

| Condition | Points |
|-----------|:------:|
| Description < 20 characters (short/missing) | 10 |
| Urgency language ("urgent", "act fast", "today only", ...) | 8 |
| Advance-payment / wire-transfer language | 12 |
| Excessive exclamation marks (3+) | 3 |
| Unrealistic area-to-bedroom ratio (< 10 sqm/bedroom) | 7 |

#### 3. ML Anomaly Signal (0-30 points)

Uses the trained `fraud_model.joblib` bundle:

- **IsolationForest** tabular anomaly score (weight: 60%) — flags
  statistically unusual price/size/subcity combinations.
- **TF-IDF** text suspiciousness score (weight: 40%) — cosine
  similarity to hand-crafted scam-prototype centroids.

### Risk Thresholds

| Score Range | Risk Level | Recommended Action |
|:-----------:|:----------:|---------------------|
| 0 - 29 | **low** | Auto-approve listing |
| 30 - 59 | **medium** | Manual review recommended |
| 60 - 100 | **high** | Block or escalate for investigation |

### OpenAPI Schema: `POST /api/v1/detect-fraud`

#### Request Body

```json
{
  "listing_id": "prop-001",
  "price_etb": 35000.0,
  "area_sqm": 100.0,
  "bedrooms": 3,
  "bathrooms": 2,
  "description_text": "Well-maintained 3-bedroom apartment...",
  "subcity": "bole"
}
```

| Field | Type | Constraints | Required |
|-------|------|-------------|:--------:|
| `listing_id` | string | `1 <= len <= 100` | yes |
| `price_etb` | float | `> 0` | yes |
| `area_sqm` | float | `> 0`, `<= 100000`, must be >= 10 | yes |
| `bedrooms` | integer | `0 <= value <= 20` | yes |
| `bathrooms` | integer | `0 <= value <= 20` | yes |
| `description_text` | string | max 5000 chars, default `""` | no |
| `subcity` | string | `1 <= len <= 50`, default `null` | no |

#### Response Body (200 OK)

```json
{
  "listing_id": "prop-001",
  "risk_score": 12,
  "risk_level": "low",
  "red_flags": [],
  "price_deviation_percent": 5.3,
  "confidence": 0.85,
  "model_version": "fraud-v1.1.0",
  "signal_breakdown": {
    "price_anomaly": 0.0,
    "text_metadata": 0.0,
    "ml_anomaly": 12.0,
    "total": 12.0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `risk_score` | int (0-100) | Composite risk score |
| `risk_level` | string | `"low"`, `"medium"`, or `"high"` |
| `red_flags` | list[string] | Human-readable risk explanations |
| `price_deviation_percent` | float | % difference from market estimate (negative = underpriced) |
| `confidence` | float | 0.0-1.0 (ML loaded: 0.85, fallback: 0.65) |
| `model_version` | string | `"fraud-v1.1.0"` |
| `signal_breakdown` | object | Component scores: `price_anomaly` (0-40), `text_metadata` (0-30), `ml_anomaly` (0-30) |

#### Error Responses

| Status | Trigger |
|--------|---------|
| 422 | Missing required field, negative price/area, `area_sqm < 10`, empty `listing_id` |
| 500 | Internal analysis failure |

---

## Property Recommendations: `POST /api/v1/recommend`

### Scoring Methodology

Recommendations are computed by ranking candidate properties against the
tenant's stated criteria using **four weighted signals** that sum to 100:

```
                    +-------------------+
                    |  Tenant Criteria  |
                    |  (budget, subcity,|
                    |   rooms, furnish) |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v-------+ +---v--------+ +---v-----------+ +----------+
     | Budget Fit     | | Subcity /  | | Room / Space  | | Furnishing|
     | (35 pts)       | | Location   | | Fit (20 pts)  | | (10 pts) |
     |                | | (35 pts)   | |               | |           |
     | Price vs.      | | Exact: 35  | | bedrooms >=   | | Furnished |
     | budget; partial| | Neighbour: | | min_bedrooms  | | meets     |
     | credit for     | | ~19 pts    | | + bathrooms   | | requirement|
     | +30% over      | | None: 0    | | >= min_bath   | |           |
     +--------+-------+ +----+-------+ +-------+-------+ +-----+-----+
              |              |              |                    |
              +--------------+--------------+--------------------+
                             |
                    +--------v----------+
                    |  match_score      |
                    |  (0-100, float)   |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  match_reasons    |
                    |  (list of strings)|
                    +-------------------+
```

### Signal Weights

| Signal | Weight | What it measures |
|--------|:------:|------------------|
| Budget Fit | 35% | Whether the listing price fits within the tenant's max budget |
| Subcity / Location Match | 35% | Exact subcity match (35 pts), neighbouring subcity (~19 pts) |
| Room / Space Fit | 20% | Bedrooms >= min_bedrooms + bathrooms >= min_bathrooms |
| Furnishing & Amenities | 10% | Whether furnishing status meets the tenant's requirement |

### Subcity Adjacency

Neighbouring subcities receive partial location credit (~55% of full subcity
score). The adjacency graph:

| Subcity | Neighbours |
|---------|------------|
| Bole | Kirkos, Yeka |
| Kirkos | Bole, Arada, Yeka |
| Arada | Kirkos, Addis Ketema |
| Yeka | Bole, Kirkos, Nifas Silk-Lafto |
| Nifas Silk-Lafto | Yeka, Akaky Kaliti |
| Gulele | Kolfe, Addis Ketema |
| Kolfe | Gulele, Lideta |
| Lideta | Kolfe, Akaky Kaliti |
| Addis Ketema | Arada, Gulele |
| Akaky Kaliti | Nifas Silk-Lafto, Lideta |

### Constraint Relaxation

If exact / high-confidence matches (score >= 60) are fewer than the requested
`limit`, the scorer automatically includes top-scoring partial matches with
explanatory notes such as "Slightly exceeds target budget (+8%)".

### Candidate Ingestion

The backend can supply an optional `candidate_properties` list of listings
to score. When omitted, the endpoint falls back to the built-in demo catalog
(or a `catalog.json` file if present on disk).

### OpenAPI Schema: `POST /api/v1/recommend`

#### Request Body

```json
{
  "max_budget_etb": 20000.0,
  "preferred_subcities": ["bole", "yeka"],
  "min_bedrooms": 2,
  "min_bathrooms": 1,
  "is_furnished_required": false,
  "limit": 5,
  "candidate_properties": [
    {
      "property_id": "C-001",
      "price_etb": 15000.0,
      "bedrooms": 2,
      "bathrooms": 1,
      "subcity": "bole",
      "area_sqm": 85.0,
      "is_furnished": false
    }
  ]
}
```

| Field | Type | Constraints | Required |
|-------|------|-------------|:--------:|
| `max_budget_etb` | float | `> 0` | yes |
| `preferred_subcities` | list[string] | at least 1 non-empty string | yes |
| `min_bedrooms` | integer | `0 <= value <= 20`, default `1` | no |
| `min_bathrooms` | integer | `0 <= value <= 20`, default `1` | no |
| `preferred_property_type` | string | optional filter | no |
| `is_furnished_required` | boolean | default `null` (not required) | no |
| `limit` | integer | `1 <= value <= 50`, default `5` | no |
| `candidate_properties` | list | backend-supplied batch; default `null` (use catalog) | no |

**Custom validation rules** (return HTTP 422):
- Empty `preferred_subcities` list is rejected.
- All-whitespace subcity strings are rejected.
- Negative `min_bedrooms` or `min_bathrooms` is rejected.
- `limit` outside 1-50 is rejected.

#### Response Body (200 OK)

```json
{
  "total_candidates_evaluated": 10,
  "recommendations": [
    {
      "property_id": "P-0002",
      "match_score": 100.0,
      "match_reasons": [
        "Within budget (83% of ETB 30,000)",
        "In preferred subcity Bole",
        "Meets bedroom requirement (3 >= 2)",
        "Meets bathroom requirement (3 >= 2)",
        "Furnishing not required"
      ],
      "estimated_market_rent": 25000.0
    }
  ],
  "model_version": "rec-v1.0.0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_candidates_evaluated` | int | Number of candidate listings scored |
| `recommendations` | list | Ranked list (best match first) |
| `recommendations[].property_id` | string | Listing identifier |
| `recommendations[].match_score` | float (0-100) | Composite match score |
| `recommendations[].match_reasons` | list[string] | Human-readable match explanations |
| `recommendations[].estimated_market_rent` | float or null | ML-estimated market rent in ETB |

#### Error Responses

| Status | Trigger |
|--------|---------|
| 422 | Missing `max_budget_etb`/`preferred_subcities`, negative budget, empty subcities, invalid limit |
| 500 | Internal scoring failure |

---

## Other Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | **Liveness probe** — returns `status: "ok"`, `uptime_seconds`, `api_version`, and `timestamp`. |
| `/ready` | GET | **Readiness probe** — checks model artifacts exist on disk, are loaded in memory, and manifest is readable. Returns `200` when ready, `503` with error list when not. |
| `/` | GET | Legacy health check (`{"status": "online"}`) |

---

## OpenAPI Contract

Generate a static `openapi.json` for backend/frontend integration:

```bash
cd ai/
python -m src.export_openapi           # writes ai/openapi.json
python -m src.export_openapi -o out.json   # custom output path
```

The exported schema includes all six endpoints (`/health`, `/ready`, `/`,
`/api/v1/estimate-rent`, `/api/v1/recommend`, `/api/v1/detect-fraud`)
with full request/response Pydantic models.

Interactive docs are always available at runtime at:
- `http://localhost:8000/docs` (Swagger UI)
- `http://localhost:8000/redoc` (ReDoc)

---

## Project Layout

```
ai/
  Dockerfile                        # Container build definition
  .dockerignore                     # Excludes __pycache__, tests, venv
  openapi.json                      # Static OpenAPI 3.x contract (generated)
  main.py                           # FastAPI application (health/ready probes)
  requirements.txt                  # Python dependencies
  data/
    ethiopia_housing_data.csv       # 2,000-row synthetic dataset
  models/
    rent_model.joblib               # Trained rent estimation pipeline
    fraud_model.joblib              # Trained fraud detection bundle
    model_manifest.json             # Versioned training metadata & provenance
    rent_model_metrics.json         # Evaluation metrics (baseline vs ML)
  src/
    rent_estimator.py               # Rent prediction (ML + heuristic fallback)
    train.py                        # Unified training pipeline (rent + fraud + manifest)
    export_openapi.py               # Static OpenAPI JSON exporter
    train_rent_model.py             # Legacy rent training script (GridSearchCV)
    evaluate_rent_model.py          # Evaluation script (ML vs median baseline)
    generate_dataset.py             # Synthetic data generator
    fraud_detector.py               # Multi-signal fraud analysis engine
    train_fraud_model.py            # Legacy fraud model training
    recommend.py                    # Property recommendation engine (4-signal scoring)
    train_recommender.py            # Recommender training
  tests/
    test_api.py                     # API test suite (56 tests)
    test_train.py                   # Training pipeline tests (14 tests)
    test_health_and_docker.py       # Health/readiness probes + Docker + OpenAPI tests (27 tests)
```

---

## Running Tests

```bash
cd ai/
pytest tests/ -v                    # run all 97 tests
pytest tests/test_api.py -v         # API tests only (56 tests)
pytest tests/test_train.py -v       # Training pipeline tests (14 tests)
pytest tests/test_health_and_docker.py -v   # Probes + Docker + OpenAPI tests (27 tests)
```

## Retraining

### Unified pipeline (recommended)

The single-command pipeline trains both the rent and fraud models,
evaluates against baselines, and writes a versioned manifest:

```bash
cd ai/
python -m src.train                   # full dataset (2,000 rows)
python -m src.train --sample 200      # quick run on 200-row sample
```

This produces:
- `ai/models/rent_model.joblib` — best-performing rent pipeline
- `ai/models/fraud_model.joblib` — IsolationForest + TF-IDF bundle
- `ai/models/model_manifest.json` — versioned training metadata

### Legacy scripts (still functional)

```bash
cd ai/
python -m src.generate_dataset          # regenerate CSV
python -m src.train_rent_model          # retrain rent model only
python -m src.evaluate_rent_model       # evaluate and update metrics
python -m src.train_fraud_model         # retrain fraud model only
```

---

## Model Manifest (`model_manifest.json`)

Every training run writes a versioned manifest containing full dataset
provenance, hyperparameters, and evaluation metrics.  The FastAPI service
reads model versions from this file at startup.

### Schema

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-08-17T03:19:07.872768+00:00",
  "dataset": {
    "path": "data/ethiopia_housing_data.csv",
    "sha256": "c4a66b2556edfb80...",
    "rows": 2000,
    "columns": 9,
    "column_names": ["subcity", "bedrooms", ...]
  },
  "training_config": {
    "random_state": 42,
    "test_size": 0.2
  },
  "rent_model": {
    "version": "rent-v1.1.0",
    "artifact": "rent_model.joblib",
    "algorithm": "GradientBoostingRegressor",
    "hyperparameters": { ... },
    "feature_columns": [ ... ],
    "metrics": {
      "test_mae": 607,
      "test_rmse": ...,
      "test_r2": 0.9970,
      "cv_r2_mean": ...,
      "cv_r2_std": ...
    },
    "baseline_comparison": {
      "median_baseline": { "test_mae": 3978, ... },
      "mae_reduction_pct": 84.7,
      "rmse_reduction_pct": ...,
      "r2_delta": ...
    },
    "candidate_models": [ ... ]
  },
  "fraud_model": {
    "version": "fraud-v1.1.0",
    "artifact": "fraud_model.joblib",
    "algorithm": "IsolationForest + TF-IDF",
    "feature_columns": [ ... ],
    "metrics": { ... }
  }
}
```

### Versioning policy

| Field | Convention | Example |
|-------|-----------|---------|
| `rent_model.version` | `rent-vMAJOR.MINOR.PATCH` | `rent-v1.1.0` |
| `fraud_model.version` | `fraud-vMAJOR.MINOR.PATCH` | `fraud-v1.1.0` |
| `schema_version` | `MAJOR.MINOR` | `1.0` |

- **MAJOR** — breaking change in model format or feature schema.
- **MINOR** — new training data, retrained model, or new candidate.
- **PATCH** — metadata-only or documentation fix.

The `dataset.sha256` field provides a content-addressable checksum of the
training CSV so any data change is immediately traceable.
