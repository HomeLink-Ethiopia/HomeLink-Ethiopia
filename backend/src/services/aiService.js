/**
 * aiService.js — HTTP client for the HomeLink AI microservice.
 *
 * Wraps all three AI engine endpoints:
 *   POST /api/v1/estimate-rent
 *   POST /api/v1/detect-fraud
 *   POST /api/v1/recommend
 *
 * The base URL is read from the AI_SERVICE_URL environment variable
 * (default: http://localhost:8000) so it works both locally and in Docker.
 */

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "10000", 10);

/**
 * Internal helper — POST JSON to an AI service endpoint.
 * Uses native fetch (Node 18+); falls back gracefully on network errors.
 *
 * @param {string} path   - Endpoint path, e.g. "/api/v1/estimate-rent"
 * @param {object} body   - Request payload
 * @returns {Promise<object>} Parsed JSON response
 */
async function _post(path, body) {
  const url = `${AI_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AI service error [${response.status}] on ${path}: ${errorText}`
      );
    }

    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `AI service timeout after ${AI_TIMEOUT_MS}ms on ${path}`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate monthly rent for a property.
 *
 * @param {object} params
 * @param {string} params.subcity         - Addis Ababa subcity, e.g. "Bole"
 * @param {number} params.bedrooms        - Number of bedrooms
 * @param {number} params.bathrooms       - Number of bathrooms
 * @param {number} params.area_sqm        - Floor area in square metres
 * @param {boolean} [params.has_water_tank]
 * @param {boolean} [params.has_generator]
 * @param {boolean} [params.is_furnished]
 * @returns {Promise<{estimated_rent_etb: number, confidence: number, model_used: string, model_version: string, input_summary: object}>}
 */
async function estimateRent(params) {
  return _post("/api/v1/estimate-rent", params);
}

/**
 * Score a listing for fraud / anomaly risk.
 *
 * @param {object} params
 * @param {string} params.listing_id      - Unique listing identifier
 * @param {number} params.price_etb       - Listed monthly rent in ETB
 * @param {number} params.bedrooms
 * @param {number} params.bathrooms
 * @param {number} params.area_sqm
 * @param {string} params.subcity
 * @param {string} [params.description]   - Listing description text
 * @param {string} [params.contact_info]
 * @returns {Promise<{listing_id: string, risk_score: number, risk_level: string, red_flags: string[], signal_breakdown: object}>}
 */
async function detectFraud(params) {
  return _post("/api/v1/detect-fraud", params);
}

/**
 * Get ranked property recommendations for a tenant.
 *
 * @param {object} params
 * @param {number}   params.max_budget_etb
 * @param {string[]} params.preferred_subcities
 * @param {number}   [params.min_bedrooms]
 * @param {number}   [params.min_bathrooms]
 * @param {boolean}  [params.require_furnished]
 * @param {number}   [params.limit]
 * @param {object[]} [params.candidate_properties]
 * @returns {Promise<{recommendations: object[], total_candidates_evaluated: number, model_version: string}>}
 */
async function getRecommendations(params) {
  return _post("/api/v1/recommend", params);
}

/**
 * Health-check the AI service (GET /).
 * @returns {Promise<boolean>} true if the service is reachable and healthy
 */
async function isHealthy() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${AI_BASE_URL}/`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { estimateRent, detectFraud, getRecommendations, isHealthy };
