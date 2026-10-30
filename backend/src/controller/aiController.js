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
    const subcity = req.body.subcity || req.body.subCity || (req.body.location && req.body.location.subCity) || "Bole";
    const bedrooms = req.body.bedrooms != null ? Number(req.body.bedrooms) : 2;
    const bathrooms = req.body.bathrooms != null ? Number(req.body.bathrooms) : 1;
    const area_sqm = req.body.area_sqm || req.body.sizeM2 || req.body.area || 85;
    const has_water_tank = req.body.has_water_tank != null ? Boolean(req.body.has_water_tank) : (Array.isArray(req.body.amenities) && req.body.amenities.includes("water_tank"));
    const has_generator = req.body.has_generator != null ? Boolean(req.body.has_generator) : (Array.isArray(req.body.amenities) && req.body.amenities.includes("generator"));
    const is_furnished = req.body.is_furnished != null ? Boolean(req.body.is_furnished) : Boolean(req.body.furnished);

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
    const listing_id = req.body.listing_id || req.body.propertyId || req.body._id || "prop-unknown";
    const price_etb = req.body.price_etb != null ? Number(req.body.price_etb) : Number(req.body.rentAmount || req.body.price || 30000);
    const bedrooms = req.body.bedrooms != null ? Number(req.body.bedrooms) : 2;
    const bathrooms = req.body.bathrooms != null ? Number(req.body.bathrooms) : 1;
    const area_sqm = req.body.area_sqm || req.body.sizeM2 || req.body.area || 85;
    const subcity = req.body.subcity || req.body.subCity || (req.body.location && req.body.location.subCity) || "Bole";
    const description = req.body.description || "";
    const contact_info = req.body.contact_info || req.body.phone || "";

    const result = await aiService.detectFraud({
      listing_id,
      price_etb: Number(price_etb),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      area_sqm: Number(area_sqm),
      subcity,
      description,
      contact_info,
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
 * POST /api/ai/match
 *
 * Body:
 *   { max_budget_etb, preferred_subcities[], min_bedrooms?,
 *     min_bathrooms?, require_furnished?, limit?, candidate_properties[]? }
 */
async function getRecommendations(req, res) {
  try {
    const max_budget_etb = req.body.max_budget_etb || req.body.budget || req.body.maxBudget || 60000;
    let preferred_subcities = req.body.preferred_subcities || req.body.subcities || (req.body.subCity ? [req.body.subCity] : (req.body.location ? [req.body.location] : ["Bole"]));
    if (!Array.isArray(preferred_subcities)) preferred_subcities = [preferred_subcities];

    const min_bedrooms = req.body.min_bedrooms != null ? Number(req.body.min_bedrooms) : (req.body.bedrooms ? Number(req.body.bedrooms) : 1);
    const min_bathrooms = req.body.min_bathrooms != null ? Number(req.body.min_bathrooms) : (req.body.bathrooms ? Number(req.body.bathrooms) : 1);
    const require_furnished = req.body.require_furnished != null ? Boolean(req.body.require_furnished) : Boolean(req.body.furnished);
    const limit = req.body.limit != null ? Number(req.body.limit) : 5;
    const candidate_properties = req.body.candidate_properties || undefined;

    const result = await aiService.getRecommendations({
      max_budget_etb: Number(max_budget_etb),
      preferred_subcities,
      min_bedrooms,
      min_bathrooms,
      require_furnished,
      limit,
      candidate_properties,
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
