const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const roleMiddleware = require('../../middleware/roleMiddleware');

const {
    getDashboardOverview,
    resolveDispute,
    verifyLandlord,
    suspendAccount,
    getAllUsers,
    getAllProperties,
    getAllFraudReports,
    getAllDisputes,
    getAllVerifications
} = require('../../controller/admin/adminController');

const {
    getKPIs,
    getChartData
} = require('../../controller/admin/analyticsController');

// All routes require authentication and strictly 'admin' role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// Analytics (Sprint 12 - Phase 1)
router.get('/analytics/kpis', getKPIs);
router.get('/analytics/charts', getChartData);

// Admin Dashboard (Sprint 11)
router.get('/dashboard', getDashboardOverview);

// Management Lists (Sprint 12 - Phase 2)
router.get('/users', getAllUsers);
router.get('/properties', getAllProperties);
router.get('/fraud-reports', getAllFraudReports);
router.get('/disputes', getAllDisputes);
router.get('/verifications', getAllVerifications);

// Moderation Actions
router.put('/disputes/:id/resolve', resolveDispute);
router.put('/landlords/:id/verify', verifyLandlord);
router.put('/users/:id/suspend', suspendAccount);

module.exports = router;
