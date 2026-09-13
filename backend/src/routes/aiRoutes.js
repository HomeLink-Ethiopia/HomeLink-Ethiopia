/**
 * aiRoutes.js — Express router for AI-powered endpoints.
 *
 * Mounted at /api/ai in server.js.
 *
 * Routes:
 *   POST /api/ai/estimate-rent   → Rent estimation (XGBoost)
 *   POST /api/ai/detect-fraud    → Fraud / anomaly detection
 *   POST /api/ai/recommend       → Property recommendations
 *   GET  /api/ai/health          → AI service health check
 */

const { Router } = require("express");
const {
  estimateRent,
  detectFraud,
  getRecommendations,
  healthCheck,
} = require("../controller/aiController");

const router = Router();

// ── Rent Estimation ───────────────────────────────────────────────────────────
router.post("/estimate-rent", estimateRent);

// ── Fraud Detection ───────────────────────────────────────────────────────────
router.post("/detect-fraud", detectFraud);

// ── Property Recommendations ──────────────────────────────────────────────────
router.post("/recommend", getRecommendations);

// ── AI Service Health Check ───────────────────────────────────────────────────
router.get("/health", healthCheck);

module.exports = router;
