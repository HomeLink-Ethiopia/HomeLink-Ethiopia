const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const CreditScore = require('../models/CreditScore');
const { isMockMode } = require('../config/db');

// Deterministic demo score so the tenant dashboard card works offline.
const MOCK_CREDIT_SCORE = (userId) => ({
  userId,
  score: 682,
  tier: 'good',
  computedAt: new Date().toISOString(),
  breakdown: {
    onTimePayments: { points: 312, max: 400, detail: '12 of 13 payments made on time (demo)' },
    leaseCompletion: { points: 205, max: 300, detail: 'Completed 1 lease, 1 in progress (demo)' },
    landlordReviews: { points: 165, max: 300, detail: 'Average landlord rating 4.6/5 (demo)' },
  },
});
const { computeCreditScore } = require('../services/creditScoreService');

// ─── Tenant: my credit score (recomputes live) — GET /api/v1/credit-score/my
router.get('/my', authMiddleware, roleMiddleware('tenant'), async (req, res) => {
  try {
    if (isMockMode()) return res.status(200).json({ data: MOCK_CREDIT_SCORE(req.user.id) });
    const doc = await computeCreditScore(req.user.id);
    res.status(200).json({ data: doc });
  } catch (error) {
    console.error('credit-score/my error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Landlord: applicant score — GET /api/v1/credit-score/tenant/:tenantId
router.get('/tenant/:tenantId', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (isMockMode()) return res.status(200).json({ data: MOCK_CREDIT_SCORE(tenantId) });
    // Serve cached score; recompute only if older than 24h (landlords may fan out)
    let doc = await CreditScore.findOne({ userId: tenantId });
    const stale = !doc || (Date.now() - new Date(doc.computedAt).getTime()) > 24 * 3600 * 1000;
    if (stale) doc = await computeCreditScore(tenantId);
    res.status(200).json({ data: doc });
  } catch (error) {
    console.error('credit-score/tenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Landlord: scores for many applicants in one call — POST /api/v1/credit-score/batch
router.post('/batch', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    const { tenantIds } = req.body || {};
    if (!Array.isArray(tenantIds) || tenantIds.length === 0 || tenantIds.length > 50) {
      return res.status(400).json({ message: 'tenantIds array (1-50) required' });
    }
    if (isMockMode()) {
      const results = {};
      for (const tid of tenantIds) results[tid] = { score: MOCK_CREDIT_SCORE(tid).score, tier: 'good', computedAt: new Date().toISOString() };
      return res.status(200).json({ data: results });
    }
    const results = {};
    for (const tid of tenantIds) {
      try {
        let doc = await CreditScore.findOne({ userId: tid });
        const stale = !doc || (Date.now() - new Date(doc.computedAt).getTime()) > 24 * 3600 * 1000;
        if (stale) doc = await computeCreditScore(tid);
        results[tid] = { score: doc.score, tier: doc.tier, computedAt: doc.computedAt };
      } catch (e) {
        results[tid] = null;
      }
    }
    res.status(200).json({ data: results });
  } catch (error) {
    console.error('credit-score/batch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
