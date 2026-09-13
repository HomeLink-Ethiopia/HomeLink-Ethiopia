const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload');

const {
    applyForProperty,
    getTenantApplications,
    getLandlordApplications,
    reviewApplication
} = require('../controller/applicationController');

// Tenant Routes
// Use documentUpload.array('documents', 5) to allow up to 5 files to be uploaded
router.post('/', authMiddleware, roleMiddleware('tenant'), documentUpload.array('documents', 5), applyForProperty);
router.get('/my-applications', authMiddleware, roleMiddleware('tenant'), getTenantApplications);

// Landlord Routes
router.get('/property/:propertyId', authMiddleware, roleMiddleware('landlord'), getLandlordApplications);
router.put('/:id/review', authMiddleware, roleMiddleware('landlord'), reviewApplication);

module.exports = router;
