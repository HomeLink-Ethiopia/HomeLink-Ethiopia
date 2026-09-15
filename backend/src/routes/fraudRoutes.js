const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    reportFraud,
    getAdminReports
} = require('../controller/fraudController');

// Submit a fraud report (can include evidence images/docs)
router.post('/', authMiddleware, documentUpload.array('evidence', 5), reportFraud);

// Admin dashboard endpoint to fetch reports sorted by risk
router.get('/admin', authMiddleware, roleMiddleware('admin'), getAdminReports);

module.exports = router;
