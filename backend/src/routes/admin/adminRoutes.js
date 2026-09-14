const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const roleMiddleware = require('../../middleware/roleMiddleware');

const {
    getDashboardOverview,
    resolveDispute,
    verifyLandlord,
    suspendAccount
} = require('../../controller/admin/adminController');

// All routes require authentication and strictly 'admin' role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// Admin Dashboard
router.get('/dashboard', getDashboardOverview);

// Moderation Actions
router.put('/disputes/:id/resolve', resolveDispute);
router.put('/landlords/:id/verify', verifyLandlord);
router.put('/users/:id/suspend', suspendAccount);

module.exports = router;
