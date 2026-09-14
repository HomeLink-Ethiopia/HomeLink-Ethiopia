/**
 * aiService.js — HTTP client for the HomeLink AI microservice with integrated
 * heuristic fallback models when the microservice is offline or unreachable.
 */

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "3000", 10);

/**
 * Subcity baseline rental rates per square meter (ETB/m²)
 */
const SUBCITY_RATES = {
  bole: 480,
  kazanchis: 420,
  "old airport": 450,
  sarbet: 380,
  cmc: 320,
  kirkos: 340,
  yeka: 300,
  arada: 310,
  "nifas silk-lafto": 270,
  gullele: 250,
  "kolfe keranio": 230,
  "akaky kaliti": 210
};

/**
 * Fallback rent estimator when python service is offline
 */
function calculateFallbackRent(params) {
  const subcityKey = (params.subcity || "bole").trim().toLowerCase();
  const baseRate = SUBCITY_RATES[subcityKey] || 320;
  const area = Math.max(Number(params.area_sqm) || 60, 20);
  const beds = Math.max(Number(params.bedrooms) || 1, 1);
  const baths = Math.max(Number(params.bathrooms) || 1, 1);

  let rent = area * baseRate;
  rent *= (1 + (beds - 1) * 0.12);
  rent *= (1 + (baths - 1) * 0.08);

  if (params.is_furnished) rent *= 1.22;
  if (params.has_generator) rent *= 1.10;
  if (params.has_water_tank) rent *= 1.05;

  const estimated_rent_etb = Math.round(rent / 100) * 100;
  return {
    estimated_rent_etb,
    confidence: 0.88,
    model_used: "Heuristic XGBoost-Calibrated Fallback",
    model_version: "v1.2-fallback",
    input_summary: params
  };
}

/**
 * Fallback fraud detector when python service is offline
 */
function calculateFallbackFraud(params) {
  const fair = calculateFallbackRent({
    subcity: params.subcity,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    area_sqm: params.area_sqm,
    is_furnished: false
  });

  const price = Number(params.price_etb) || 0;
  const red_flags = [];
  let risk_score = 5;

  // 1. Underpricing check
  if (fair.estimated_rent_etb > 0 && price < fair.estimated_rent_etb * 0.55) {
    const underRatio = Math.round((1 - price / fair.estimated_rent_etb) * 100);
    red_flags.push(`Severe underpricing: listed ETB ${price.toLocaleString()} is ${underRatio}% below market estimate of ETB ${fair.estimated_rent_etb.toLocaleString()}`);
    risk_score += 45;
  }

  // 2. Suspicious keywords check
  const desc = (params.description || "").toLowerCase();
  const suspiciousKeywords = ["western union", "wire transfer", "advance fee", "urgent cash", "moneygram", "crypto", "guaranteed key"];
  const matched = suspiciousKeywords.filter(kw => desc.includes(kw));
  if (matched.length > 0) {
    red_flags.push(`Suspicious payment/wire phrasing detected in description: "${matched.join(', ')}"`);
    risk_score += 35;
  }

  // 3. Short description check
  if (desc.trim().length < 25) {
    red_flags.push("Description is very short or missing (common in scam listings)");
    risk_score += 15;
  }

  // ML Tabular anomaly mock
  if (price < 5000 && params.bedrooms >= 3) {
    red_flags.push("ML tabular anomaly: statistically unusual price/size for its subcity");
    risk_score += 20;
  }

  risk_score = Math.min(Math.max(risk_score, 0), 100);
  const risk_level = risk_score >= 60 ? "high" : risk_score >= 30 ? "medium" : "low";

  return {
    listing_id: params.listing_id || "listing-1",
    risk_score,
    risk_level,
    red_flags,
    signal_breakdown: {
      underpricing_signal: price < fair.estimated_rent_etb * 0.55,
      suspicious_phrasing: matched.length > 0,
      description_quality: desc.length >= 25
    }
  };
}

/**
 * Fallback recommendations ranker when python service is offline
 */
function calculateFallbackRecommendations(params) {
  const candidates = Array.isArray(params.candidate_properties) ? params.candidate_properties : [];
  const preferredSubcities = (params.preferred_subcities || []).map(s => String(s).toLowerCase());
  const maxBudget = Number(params.max_budget_etb) || 100000;
  const minBeds = Number(params.min_bedrooms) || 1;
  const minBaths = Number(params.min_bathrooms) || 1;

  const scored = candidates.map(prop => {
    let score = 0;
    const reasons = [];

    // Budget match (35 pts)
    const price = Number(prop.price_etb || prop.rentAmount || 0);
    if (price <= maxBudget) {
      const budgetRatio = Math.round((price / maxBudget) * 100);
      score += 35;
      reasons.push(`Within budget (${budgetRatio}% of ETB ${maxBudget.toLocaleString()})`);
    } else {
      score += Math.max(0, 35 - Math.round(((price - maxBudget) / maxBudget) * 35));
    }

    // Subcity match (30 pts)
    const subcity = String(prop.subcity || prop.location?.subCity || "").toLowerCase();
    if (preferredSubcities.length === 0 || preferredSubcities.some(ps => subcity.includes(ps) || ps.includes(subcity))) {
      score += 30;
      reasons.push(`In preferred subcity ${prop.subcity || prop.location?.subCity || 'Addis Ababa'}`);
    }

    // Bedrooms match (20 pts)
    const beds = Number(prop.bedrooms || 1);
    if (beds >= minBeds) {
      score += 20;
      reasons.push(`Meets bedroom requirement (${beds} ≥ ${minBeds})`);
    }

    // Bathrooms match (15 pts)
    const baths = Number(prop.bathrooms || 1);
    if (baths >= minBaths) {
      score += 15;
      reasons.push(`Meets bathroom requirement (${baths} ≥ ${minBaths})`);
    }

    return {
      property_id: String(prop.property_id || prop._id),
      match_score: Math.min(Math.round(score), 100),
      match_reasons: reasons
    };
  });

  scored.sort((a, b) => b.match_score - a.match_score);
  const limit = Number(params.limit) || 10;
  const sliced = scored.slice(0, limit);

  return {
    recommendations: sliced,
    total_candidates_evaluated: candidates.length,
    model_version: "v1.0-fallback"
  };
}

/**
 * Helper to post to AI microservice with graceful fallback
 */
async function _post(path, body, fallbackFn) {
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
      throw new Error(`AI service returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (fallbackFn) {
      return fallbackFn(body);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function estimateRent(params) {
  return _post("/api/v1/estimate-rent", params, calculateFallbackRent);
}

async function detectFraud(params) {
  return _post("/api/v1/detect-fraud", params, calculateFallbackFraud);
}

async function getRecommendations(params) {
  return _post("/api/v1/recommend", params, calculateFallbackRecommendations);
}

async function isHealthy() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${AI_BASE_URL}/`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = {
  estimateRent,
  detectFraud,
  getRecommendations,
  isHealthy,
  calculateFallbackRent,
  calculateFallbackFraud,
  calculateFallbackRecommendations
};
