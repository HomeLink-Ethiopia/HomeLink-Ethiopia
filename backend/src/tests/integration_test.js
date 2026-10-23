/**
 * integration_test.js — AI microservice integration test.
 *
 * Tests that the backend /api/ai/* routes correctly proxy
 * through to the AI engine and return valid responses.
 *
 * Run with:
 *   node backend/src/tests/integration_test.js
 *
 * Requires the AI service to be running on AI_SERVICE_URL
 * (default: http://localhost:8000).
 */

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

async function post(path, body) {
  const res = await fetch(`${AI_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function get(path) {
  const res = await fetch(`${AI_BASE_URL}${path}`);
  return { status: res.status, data: await res.json() };
}

// ─────────────────────────────────────────────────────────────────────────────

async function testHealthCheck() {
  console.log("\n[1] AI Service Health Check");
  const { status, data } = await get("/");
  assert(status === 200, `GET / returns 200 (got ${status})`);
  assert(data.status === "online", `status === "online" (got "${data.status}")`);
}

async function testRentEstimation() {
  console.log("\n[2] Rent Estimation — Bole, 2BR/2BA, 100 sqm");
  const { status, data } = await post("/api/v1/estimate-rent", {
    subcity: "bole",
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 100.0,
    has_water_tank: true,
    has_generator: false,
    is_furnished: false,
  });
  assert(status === 200, `POST /api/v1/estimate-rent returns 200 (got ${status})`);
  assert(typeof data.estimated_rent_etb === "number", "estimated_rent_etb is a number");
  assert(data.estimated_rent_etb > 0, `estimated_rent_etb > 0 (got ${data.estimated_rent_etb})`);
  assert(data.confidence >= 0 && data.confidence <= 1, `confidence in [0,1] (got ${data.confidence})`);
  assert(typeof data.model_used === "string", `model_used is string (got "${data.model_used}")`);
  console.log(`     => ETB ${data.estimated_rent_etb.toLocaleString()} | confidence: ${data.confidence} | model: ${data.model_used}`);
}

async function testFraudDetectionSuspicious() {
  console.log("\n[3] Fraud Detection — Suspicious Listing");
  const { status, data } = await post("/api/v1/detect-fraud", {
    listing_id: "INTEG-SUSP-001",
    price_etb: 2500.0,
    bedrooms: 3,
    bathrooms: 2,
    area_sqm: 120.0,
    subcity: "Bole",
    description: "URGENT send wire transfer Western Union before viewing guaranteed deal!!!",
    contact_info: "scammer@example.com",
  });
  assert(status === 200, `POST /api/v1/detect-fraud returns 200 (got ${status})`);
  assert(typeof data.risk_score === "number", "risk_score is a number");
  assert(data.risk_score > 50, `risk_score > 50 for suspicious listing (got ${data.risk_score})`);
  assert(["high", "very_high"].includes(data.risk_level), `risk_level is high/very_high (got "${data.risk_level}")`);
  console.log(`     => risk_score: ${data.risk_score} | risk_level: ${data.risk_level} | flags: ${data.red_flags?.length}`);
}

async function testFraudDetectionLegit() {
  console.log("\n[4] Fraud Detection — Legitimate Listing");
  const { status, data } = await post("/api/v1/detect-fraud", {
    listing_id: "INTEG-LEGIT-001",
    price_etb: 45000.0,
    bedrooms: 2,
    bathrooms: 1,
    area_sqm: 90.0,
    subcity: "Bole",
    description: "2-bedroom apartment in Bole, well maintained, quiet area. Call for viewing appointment.",
    contact_info: "0911234567",
  });
  assert(status === 200, `POST /api/v1/detect-fraud returns 200 (got ${status})`);
  assert(data.risk_score < 50, `risk_score < 50 for legit listing (got ${data.risk_score})`);
  assert(data.risk_level === "low", `risk_level is "low" (got "${data.risk_level}")`);
  console.log(`     => risk_score: ${data.risk_score} | risk_level: ${data.risk_level}`);
}

async function testRecommendations() {
  console.log("\n[5] Property Recommendations — Budget 45k ETB, Bole/Kirkos, 2BR");
  const { status, data } = await post("/api/v1/recommend", {
    max_budget_etb: 45000,
    preferred_subcities: ["Bole", "Kirkos"],
    min_bedrooms: 2,
    min_bathrooms: 1,
    limit: 3,
    candidate_properties: [
      { property_id: "R001", price_etb: 42000, bedrooms: 2, bathrooms: 1, subcity: "bole",   area_sqm: 90,  is_furnished: false },
      { property_id: "R002", price_etb: 38000, bedrooms: 3, bathrooms: 2, subcity: "kirkos", area_sqm: 110, is_furnished: true  },
      { property_id: "R003", price_etb: 60000, bedrooms: 2, bathrooms: 1, subcity: "bole",   area_sqm: 95,  is_furnished: true  },
    ],
  });
  assert(status === 200, `POST /api/v1/recommend returns 200 (got ${status})`);
  assert(Array.isArray(data.recommendations), "recommendations is an array");
  assert(data.recommendations.length > 0, `at least 1 recommendation returned (got ${data.recommendations.length})`);
  assert(data.recommendations[0].match_score > 0, "top recommendation has match_score > 0");
  console.log(`     => ${data.recommendations.length} recommendations`);
  data.recommendations.forEach((r) =>
    console.log(`        [${r.match_score}/100] ${r.property_id}`)
  );
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  HomeLink AI Integration Test");
  console.log(`  AI Service: ${AI_BASE_URL}`);
  console.log("=".repeat(60));

  try {
    await testHealthCheck();
    await testRentEstimation();
    await testFraudDetectionSuspicious();
    await testFraudDetectionLegit();
    await testRecommendations();
  } catch (err) {
    console.error("\n[ERROR] Test runner failed:", err.message);
    console.error("  Is the AI service running? Start it with:");
    console.error("    cd ai && uvicorn main:app --reload");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main();
