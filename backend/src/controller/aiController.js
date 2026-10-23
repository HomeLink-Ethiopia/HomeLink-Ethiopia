/**
 * aiController.js — Express controllers for AI-powered endpoints.
 *
 * Each handler validates the incoming request, forwards it to the
 * AI microservice via aiService.js, and returns a clean JSON response.
 */

const aiService = require("../services/aiService");

// ─────────────────────────────────────────────────────────────────────────────
// Rent Estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/estimate-rent
 *
 * Body:
 *   { subcity, bedrooms, bathrooms, area_sqm,
 *     has_water_tank?, has_generator?, is_furnished? }
 */
async function estimateRent(req, res) {
  try {
    const { subcity, bedrooms, bathrooms, area_sqm, has_water_tank, has_generator, is_furnished } = req.body;

    // Basic validation
    if (!subcity || bedrooms == null || bathrooms == null || area_sqm == null) {
      return res.status(400).json({
        error: "Missing required fields: subcity, bedrooms, bathrooms, area_sqm",
      });
    }
    if (area_sqm <= 0) {
      return res.status(400).json({ error: "area_sqm must be greater than 0" });
    }

    const result = await aiService.estimateRent({
      subcity,
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      area_sqm: Number(area_sqm),
      has_water_tank: Boolean(has_water_tank),
      has_generator: Boolean(has_generator),
      is_furnished: Boolean(is_furnished),
    });

    return res.json(result);
  } catch (err) {
    console.error("[aiController] estimateRent error:", err.message);
    return res.status(502).json({
      error: "AI service unavailable",
      detail: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fraud Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/detect-fraud
 *
 * Body:
 *   { listing_id, price_etb, bedrooms, bathrooms, area_sqm, subcity,
 *     description?, contact_info? }
 */
async function detectFraud(req, res) {
  try {
    const { listing_id, price_etb, bedrooms, bathrooms, area_sqm, subcity, description, contact_info } = req.body;

    if (!listing_id || price_etb == null || bedrooms == null || bathrooms == null || area_sqm == null || !subcity) {
      return res.status(400).json({
        error: "Missing required fields: listing_id, price_etb, bedrooms, bathrooms, area_sqm, subcity",
      });
    }

    const result = await aiService.detectFraud({
      listing_id,
      price_etb: Number(price_etb),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      area_sqm: Number(area_sqm),
      subcity,
      description: description || "",
      contact_info: contact_info || "",
    });

    return res.json(result);
  } catch (err) {
    console.error("[aiController] detectFraud error:", err.message);
    return res.status(502).json({
      error: "AI service unavailable",
      detail: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Recommendations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/recommend
 *
 * Body:
 *   { max_budget_etb, preferred_subcities[], min_bedrooms?,
 *     min_bathrooms?, require_furnished?, limit?, candidate_properties[]? }
 */
async function getRecommendations(req, res) {
  try {
    const {
      max_budget_etb,
      preferred_subcities,
      min_bedrooms,
      min_bathrooms,
      require_furnished,
      limit,
      candidate_properties,
    } = req.body;

    if (!max_budget_etb || !preferred_subcities || !Array.isArray(preferred_subcities) || preferred_subcities.length === 0) {
      return res.status(400).json({
        error: "Missing required fields: max_budget_etb, preferred_subcities (non-empty array)",
      });
    }

    const result = await aiService.getRecommendations({
      max_budget_etb: Number(max_budget_etb),
      preferred_subcities,
      min_bedrooms: min_bedrooms != null ? Number(min_bedrooms) : 1,
      min_bathrooms: min_bathrooms != null ? Number(min_bathrooms) : 1,
      require_furnished: Boolean(require_furnished),
      limit: limit != null ? Number(limit) : 5,
      candidate_properties: candidate_properties || undefined,
    });

    return res.json(result);
  } catch (err) {
    console.error("[aiController] getRecommendations error:", err.message);
    return res.status(502).json({
      error: "AI service unavailable",
      detail: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check proxy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ai/health
 * Returns whether the AI microservice is reachable.
 */
async function healthCheck(req, res) {
  const healthy = await aiService.isHealthy();
  return res.status(healthy ? 200 : 503).json({
    ai_service: healthy ? "online" : "unreachable",
    ai_service_url: process.env.AI_SERVICE_URL || "http://localhost:8000",
  });
}

module.exports = { estimateRent, detectFraud, getRecommendations, healthCheck };
