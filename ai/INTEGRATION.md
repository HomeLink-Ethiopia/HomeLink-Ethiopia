# HomeLink AI Engine — Backend Integration Guide

Self-service integration reference for Express.js / Node.js backend engineers
connecting to the FastAPI AI microservice.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Health & Readiness Probes](#health--readiness-probes)
3. [Endpoint Integration Contracts](#endpoint-integration-contracts)
   - [POST /api/v1/estimate-rent](#post-apiv1estimate-rent)
   - [POST /api/v1/detect-fraud](#post-apiv1detect-fraud)
   - [POST /api/v1/recommend](#post-apiv1recommend)
4. [Axios Service Wrapper (aiService.js)](#axios-service-wrapper)
5. [Docker Compose Integration](#docker-compose-integration)
6. [HTTP Error Handling Contract](#http-error-handling-contract)

---

## Quick Start

### Run via Docker (recommended)

```bash
docker build -t homelink-ai ./ai
docker run -p 8000:8000 homelink-ai
```

The API is then available at `http://localhost:8000`. Interactive Swagger docs
are at `http://localhost:8000/docs`.

### Run via Uvicorn (development)

```bash
cd ai/
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Base URL

| Environment | Base URL |
|-------------|----------|
| Local Docker | `http://localhost:8000` |
| Docker Compose | `http://homelink-ai:8000` (service-to-service) |
| Production | Set `AI_SERVICE_URL` env var |

---

## Health & Readiness Probes

### GET /health — Liveness Probe

Use this to confirm the AI process is running. Suitable for basic uptime
monitoring and container liveness checks.

```bash
curl http://localhost:8000/health
```

Response (200 OK):

```json
{
  "status": "ok",
  "uptime_seconds": 142.35,
  "api_version": "0.1.0",
  "timestamp": 1755398400.12
}
```

### GET /ready — Readiness Probe

Use this to verify that ML models are loaded and the service can accept
traffic. Returns **HTTP 503** if models are missing or the manifest is corrupt.

```bash
curl http://localhost:8000/ready
```

Response (200 OK — ready):

```json
{
  "status": "ready",
  "models_loaded": true,
  "manifest_version": "1.0"
}
```

Response (503 Service Unavailable — not ready):

```json
{
  "status": "not_ready",
  "models_loaded": false,
  "errors": [
    "rent_model.joblib not found on disk",
    "fraud detector not loaded in memory"
  ]
}
```

### Awaiting AI Readiness at Express Startup

Use this pattern in your Express `server.js` / `index.js` to block startup
until the AI engine is ready:

```js
const axios = require("axios");

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

async function waitForAIReady(retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axios.get(`${AI_BASE_URL}/ready`, {
        timeout: 3000,
      });
      if (data.status === "ready") {
        console.log("[AI] Service ready:", data);
        return true;
      }
    } catch (err) {
      // 503 or network error — keep retrying
    }
    console.log(`[AI] Waiting for readiness... (${i + 1}/${retries})`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new Error("AI service failed to become ready");
}

// Call before app.listen():
//   await waitForAIReady();
//   app.listen(PORT);
```

---

## Endpoint Integration Contracts

All schemas below are authoritative and match `ai/openapi.json` exactly.
Field names use `snake_case`.

---

### POST /api/v1/estimate-rent

Predict the monthly rent in ETB for a residential property.

#### Request

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

| Field | Type | Required | Constraints |
|-------|------|:--------:|-------------|
| `subcity` | string | yes | `1 <= len <= 50` |
| `bedrooms` | integer | yes | `0 <= value <= 20` |
| `bathrooms` | integer | yes | `0 <= value <= 20` |
| `area_sqm` | number | yes | `> 0`, `<= 100000`; must be >= 10 |
| `has_water_tank` | boolean | no | default `false` |
| `has_generator` | boolean | no | default `false` |
| `is_furnished` | boolean | no | default `false` |

**Custom validation** (HTTP 422):
- `bedrooms=0` AND `bathrooms=0` → "A property must have at least one bedroom or bathroom."
- `area_sqm < 10` → "area_sqm is unrealistically small for a residential property."

#### Response (200 OK)

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

| Field | Type | Notes |
|-------|------|-------|
| `estimated_rent_etb` | number | Predicted monthly rent in Ethiopian Birr |
| `confidence` | number (0–1) | ML model: 0.92, heuristic fallback: 0.58 |
| `model_used` | string | `"rent_model.joblib"` or `"heuristic-baseline"` |
| `model_version` | string | e.g. `"rent-v1.1.0"` |
| `input_summary` | object | Echo of the validated request |

#### Axios Example

```js
async function estimateRent(property) {
  const { data } = await axios.post(
    `${AI_BASE_URL}/api/v1/estimate-rent`,
    {
      subcity: property.subcity,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area_sqm: property.areaSqm,
      has_water_tank: property.hasWaterTank || false,
      has_generator: property.hasGenerator || false,
      is_furnished: property.isFurnished || false,
    }
  );
  return {
    estimatedRent: data.estimated_rent_etb,
    confidence: data.confidence,
    modelVersion: data.model_version,
  };
}
```

---

### POST /api/v1/detect-fraud

Multi-signal fraud risk analysis for a property listing.

#### Request

```json
{
  "listing_id": "prop-001",
  "price_etb": 35000.0,
  "area_sqm": 100.0,
  "bedrooms": 3,
  "bathrooms": 2,
  "description_text": "Well-maintained 3-bedroom apartment in Bole with water and electricity.",
  "subcity": "bole"
}
```

| Field | Type | Required | Constraints |
|-------|------|:--------:|-------------|
| `listing_id` | string | yes | `1 <= len <= 100` |
| `price_etb` | number | yes | `> 0` |
| `area_sqm` | number | yes | `> 0`, `<= 100000`; must be >= 10 |
| `bedrooms` | integer | yes | `0 <= value <= 20` |
| `bathrooms` | integer | yes | `0 <= value <= 20` |
| `description_text` | string | no | max 5000 chars, default `""` |
| `subcity` | string \| null | no | `1 <= len <= 50`, default `null` |

#### Response (200 OK)

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

| Field | Type | Notes |
|-------|------|-------|
| `risk_score` | integer (0–100) | 0 = safe, 100 = critical |
| `risk_level` | string | `"low"`, `"medium"`, or `"high"` |
| `red_flags` | string[] | Human-readable risk explanations |
| `price_deviation_percent` | number | Negative = underpriced, positive = overpriced |
| `confidence` | number (0–1) | ML loaded: 0.85, fallback: 0.65 |
| `model_version` | string | e.g. `"fraud-v1.1.0"` |
| `signal_breakdown` | object \| null | `price_anomaly` (0–40), `text_metadata` (0–30), `ml_anomaly` (0–30) |

#### Risk Level Routing Rules

| Risk Level | Score Range | Recommended Backend Action |
|:----------:|:-----------:|----------------------------|
| **low** | 0–29 | Auto-approve listing |
| **medium** | 30–59 | Flag for manual review |
| **high** | 60–100 | Block listing / escalate for investigation |

#### Axios Example

```js
async function detectFraud(listing) {
  const { data } = await axios.post(
    `${AI_BASE_URL}/api/v1/detect-fraud`,
    {
      listing_id: listing.id,
      price_etb: listing.priceEtb,
      area_sqm: listing.areaSqm,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      description_text: listing.description || "",
      subcity: listing.subcity || null,
    }
  );

  return {
    riskScore: data.risk_score,
    riskLevel: data.risk_level,
    redFlags: data.red_flags,
    priceDeviationPercent: data.price_deviation_percent,
    confidence: data.confidence,
    modelVersion: data.model_version,
    signalBreakdown: data.signal_breakdown,
  };
}
```

#### Integration Pattern: Fraud Check → Route

```js
async function processNewListing(listing) {
  const fraud = await detectFraud(listing);

  switch (fraud.riskLevel) {
    case "low":
      return approveListing(listing);

    case "medium":
      return flagForReview(listing, fraud);

    case "high":
      return blockListing(listing, fraud);

    default:
      return flagForReview(listing, fraud);
  }
}
```

---

### POST /api/v1/recommend

Rank candidate properties against tenant preferences with a weighted
match score (0–100).

#### Request

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

| Field | Type | Required | Constraints |
|-------|------|:--------:|-------------|
| `max_budget_etb` | number | yes | `> 0` |
| `preferred_subcities` | string[] | yes | at least 1 non-empty string |
| `min_bedrooms` | integer | no | `0–20`, default `1` |
| `min_bathrooms` | integer | no | `0–20`, default `1` |
| `preferred_property_type` | string \| null | no | e.g. `"apartment"` |
| `is_furnished_required` | boolean \| null | no | default `null` |
| `limit` | integer | no | `1–50`, default `5` |
| `candidate_properties` | CandidateProperty[] \| null | no | `null` = use built-in catalog |

**CandidateProperty schema:**

| Field | Type | Required |
|-------|------|:--------:|
| `property_id` | string | yes |
| `price_etb` | number (`> 0`) | yes |
| `bedrooms` | integer (`0–20`) | yes |
| `bathrooms` | integer (`0–20`) | yes |
| `subcity` | string | yes |
| `area_sqm` | number (`>= 0`) | no (default `0`) |
| `is_furnished` | boolean | no (default `false`) |

#### Response (200 OK)

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

| Field | Type | Notes |
|-------|------|-------|
| `total_candidates_evaluated` | integer | Number of candidates scored |
| `recommendations` | RecommendationItem[] | Ranked list (best first) |
| `recommendations[].property_id` | string | Listing identifier |
| `recommendations[].match_score` | number (0–100) | Composite match score |
| `recommendations[].match_reasons` | string[] | Human-readable match explanations |
| `recommendations[].estimated_market_rent` | number \| null | ML-estimated market rent in ETB |
| `model_version` | string | e.g. `"rec-v1.0.0"` |

#### Scoring Weights

| Signal | Weight | What It Measures |
|--------|:------:|------------------|
| Budget Fit | 35% | Listing price vs. tenant budget |
| Subcity / Location Match | 35% | Exact subcity match (35 pts), neighbouring subcity (~19 pts) |
| Room / Space Fit | 20% | Bedrooms + bathrooms meet minimum requirements |
| Furnishing & Amenities | 10% | Furnishing status matches tenant preference |

#### Axios Example

```js
async function getRecommendations(tenant) {
  const { data } = await axios.post(
    `${AI_BASE_URL}/api/v1/recommend`,
    {
      max_budget_etb: tenant.maxBudgetEtb,
      preferred_subcities: tenant.preferredSubcities,
      min_bedrooms: tenant.minBedrooms || 1,
      min_bathrooms: tenant.minBathrooms || 1,
      limit: tenant.limit || 5,
      candidate_properties: tenant.candidateProperties || null,
    }
  );

  return {
    totalEvaluated: data.total_candidates_evaluated,
    recommendations: data.recommendations.map((r) => ({
      propertyId: r.property_id,
      matchScore: r.match_score,
      matchReasons: r.match_reasons,
      estimatedRent: r.estimated_market_rent,
    })),
    modelVersion: data.model_version,
  };
}
```

---

## Axios Service Wrapper

Copy this file to `backend/src/services/aiService.js` and import as needed.
Requires `axios` (`npm install axios`).

```js
// backend/src/services/aiService.js

const axios = require("axios");

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const aiClient = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// ── Liveness ────────────────────────────────────────────────────────────────

async function checkHealth() {
  const { data } = await aiClient.get("/health");
  return data; // { status, uptime_seconds, api_version, timestamp }
}

// ── Readiness ───────────────────────────────────────────────────────────────

async function checkReady() {
  const { data } = await aiClient.get("/ready");
  return data; // { status, models_loaded, manifest_version }
}

// ── Rent Estimation ─────────────────────────────────────────────────────────

async function estimateRent({ subcity, bedrooms, bathrooms, areaSqm, hasWaterTank, hasGenerator, isFurnished }) {
  const { data } = await aiClient.post("/api/v1/estimate-rent", {
    subcity,
    bedrooms,
    bathrooms,
    area_sqm: areaSqm,
    has_water_tank: hasWaterTank || false,
    has_generator: hasGenerator || false,
    is_furnished: isFurnished || false,
  });

  return {
    estimatedRentEtb: data.estimated_rent_etb,
    confidence: data.confidence,
    modelUsed: data.model_used,
    modelVersion: data.model_version,
    inputSummary: data.input_summary,
  };
}

// ── Fraud Detection ─────────────────────────────────────────────────────────

async function detectFraud({ listingId, priceEtb, areaSqm, bedrooms, bathrooms, descriptionText, subcity }) {
  const { data } = await aiClient.post("/api/v1/detect-fraud", {
    listing_id: listingId,
    price_etb: priceEtb,
    area_sqm: areaSqm,
    bedrooms,
    bathrooms,
    description_text: descriptionText || "",
    subcity: subcity || null,
  });

  return {
    listingId: data.listing_id,
    riskScore: data.risk_score,
    riskLevel: data.risk_level,
    redFlags: data.red_flags,
    priceDeviationPercent: data.price_deviation_percent,
    confidence: data.confidence,
    modelVersion: data.model_version,
    signalBreakdown: data.signal_breakdown,
  };
}

// ── Recommendations ─────────────────────────────────────────────────────────

async function getRecommendations({
  maxBudgetEtb,
  preferredSubcities,
  minBedrooms,
  minBathrooms,
  isFurnishedRequired,
  limit,
  candidateProperties,
}) {
  const { data } = await aiClient.post("/api/v1/recommend", {
    max_budget_etb: maxBudgetEtb,
    preferred_subcities: preferredSubcities,
    min_bedrooms: minBedrooms || 1,
    min_bathrooms: minBathrooms || 1,
    is_furnished_required: isFurnishedRequired || null,
    limit: limit || 5,
    candidate_properties: candidateProperties || null,
  });

  return {
    totalCandidatesEvaluated: data.total_candidates_evaluated,
    recommendations: data.recommendations.map((r) => ({
      propertyId: r.property_id,
      matchScore: r.match_score,
      matchReasons: r.match_reasons,
      estimatedMarketRent: r.estimated_market_rent,
    })),
    modelVersion: data.model_version,
  };
}

module.exports = {
  aiClient,
  checkHealth,
  checkReady,
  estimateRent,
  detectFraud,
  getRecommendations,
};
```

---

## Docker Compose Integration

Add this service block to your root `docker-compose.yml` alongside Express
and MongoDB:

```yaml
# docker-compose.yml

version: "3.8"

services:
  # ── MongoDB ──────────────────────────────────────────────────────────────
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  # ── AI Engine ────────────────────────────────────────────────────────────
  homelink-ai:
    build:
      context: ./ai
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/ready"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped

  # ── Express Backend ──────────────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - AI_SERVICE_URL=http://homelink-ai:8000
      - MONGODB_URI=mongodb://mongo:27017/homelink
    depends_on:
      homelink-ai:
        condition: service_healthy
      mongo:
        condition: service_started
    restart: unless-stopped

volumes:
  mongo-data:
```

Key points:
- The `depends_on.condition: service_healthy` ensures Express only starts
  after the AI engine passes its `/ready` probe.
- `AI_SERVICE_URL=http://homelink-ai:8000` lets Node.js reach the AI engine
  via Docker's internal DNS — no `localhost` needed.
- The healthcheck uses the `/ready` endpoint to confirm ML models are loaded
  before routing traffic.

---

## HTTP Error Handling Contract

Every AI endpoint follows this consistent error structure.

### 200 OK

Normal prediction / scoring response. See individual endpoint schemas above.

### 422 Unprocessable Entity — Validation Error

Returned when request body fails Pydantic validation (bad types, missing
required fields, or value constraints violated).

```json
{
  "detail": [
    {
      "loc": ["body", "area_sqm"],
      "msg": "Input should be greater than 0",
      "type": "value_error",
      "input": -50.0
    }
  ]
}
```

| Error | Trigger |
|-------|---------|
| `bedrooms=0` AND `bathrooms=0` | "Must have at least one bedroom or bathroom" |
| `area_sqm < 10` | "Unrealistically small for a residential property" |
| `empty string` in required string field | Field-level min_length violation |
| Missing required field | Field missing entirely |

**Frontend guidance:** Display the `msg` value from the first `detail` entry
to the user. Do not surface raw `loc` paths.

### 503 Service Unavailable — AI Models Unavailable

Returned by `/ready` when the service cannot accept traffic.

```json
{
  "status": "not_ready",
  "models_loaded": false,
  "errors": [
    "rent_model.joblib not found on disk"
  ]
}
```

**Backend guidance:** If your Express app calls the AI service and receives
503, fall back to a default or cached response. Never expose 503 details
to end users.

### 500 Internal Server Error — Model Prediction Failure

If an ML model throws during prediction (rare), the AI service returns 500
with a message. The rent endpoint has a heuristic fallback that typically
prevents this.

```json
{
  "detail": "Rent estimation failed: <error message>"
}
```

**Backend guidance:** Treat any 500 from the AI service as a transient
failure. Log the error, return a generic error to the frontend, and retry
on next request.

### Express Middleware: Centralized AI Error Handler

```js
// backend/src/middleware/aiErrorHandler.js

function aiErrorHandler(err, req, res, next) {
  if (!err.response) {
    // Network error — AI service unreachable
    return res.status(503).json({
      error: "AI service temporarily unavailable",
      retryable: true,
    });
  }

  const { status, data } = err.response;

  if (status === 422) {
    const messages = (data.detail || []).map((d) => d.msg);
    return res.status(422).json({
      error: "Invalid request to AI service",
      details: messages,
    });
  }

  if (status === 503) {
    return res.status(503).json({
      error: "AI service not ready",
      retryable: true,
    });
  }

  // 500 or unexpected
  return res.status(500).json({
    error: "AI prediction failed",
    retryable: true,
  });
}

module.exports = aiErrorHandler;
```

Register it in your Express app **after** all routes:

```js
const aiErrorHandler = require("./middleware/aiErrorHandler");

// ... all routes ...

app.use(aiErrorHandler);
```

---

## Static OpenAPI Contract

A machine-readable `openapi.json` is available in the repo at `ai/openapi.json`.
To regenerate it:

```bash
cd ai/
python -m src.export_openapi
```

This file can be imported into Postman, Swagger Editor, or used to generate
TypeScript Axios clients with `openapi-typescript-codegen`.

---

*Generated from OpenAPI schema `ai/openapi.json` — HomeLink AI Engine v0.1.0*
