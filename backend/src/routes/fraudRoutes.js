const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    reportFraud,
    getAdminReports,
    reviewFraudReport,
    getPropertyRiskScore
} = require('../controller/fraudController');

// Submit a fraud report (can include evidence images/docs)
router.post('/', authMiddleware, documentUpload.array('evidence', 5), reportFraud);

// Admin dashboard endpoints to fetch reports sorted by risk
router.get('/', authMiddleware, roleMiddleware('admin'), getAdminReports);
router.get('/admin', authMiddleware, roleMiddleware('admin'), getAdminReports);
router.put('/:id/review', authMiddleware, roleMiddleware('admin'), reviewFraudReport);
router.get('/risk-score/:id', authMiddleware, getPropertyRiskScore);

module.exports = router;
