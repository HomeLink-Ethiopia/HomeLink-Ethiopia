const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload');

const {
    applyForProperty,
    getTenantApplications,
    getLandlordApplications,
    reviewApplication,
    withdrawApplication
} = require('../controller/applicationController');

// Tenant Routes
// Accept any uploaded document fields (government ID, proof of income, bank statement, etc.)
router.post('/', authMiddleware, roleMiddleware('tenant'), documentUpload.any(), applyForProperty);
router.get('/my-applications', authMiddleware, roleMiddleware('tenant'), getTenantApplications);
// Frontend alias (GET /applications/my) — same handler, wrapped in the
// { data: [...] } envelope the pages parse.
router.get('/my', authMiddleware, roleMiddleware('tenant'), (req, res) => {
  const send = res.json.bind(res);
  res.json = (body) => send(Array.isArray(body) ? { data: body } : body);
  getTenantApplications(req, res);
});
// Frontend alias (GET /applications/landlord) — all applications across the
// landlord's properties (team route is per-property only).
router.get('/landlord', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    const { isMockMode, mockStore } = require('../config/db');
    if (isMockMode()) return res.status(200).json({ data: [...(mockStore.applications || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
    const Application = require('../models/Application');
    const apps = await Application.find({ landlordId: req.user.id })
      .populate('propertyId', 'title location rentAmount images')
      .populate('tenantId', 'firstName lastName email phone')
      .sort({ createdAt: -1 });
    res.status(200).json({ data: apps });
  } catch (error) {
    console.error('Landlord applications (all) error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.put('/:id/withdraw', authMiddleware, roleMiddleware('tenant'), withdrawApplication);

// Landlord Routes
router.get('/property/:propertyId', authMiddleware, roleMiddleware('landlord'), getLandlordApplications);
router.put('/:id/review', authMiddleware, roleMiddleware('landlord'), reviewApplication);

module.exports = router;
