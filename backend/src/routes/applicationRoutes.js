const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload');

// THIS LINE IS CRITICAL
const {
    applyForProperty,
    getTenantApplications,
    getLandlordApplications,
    reviewApplication,
    withdrawApplication
} = require('../controller/applicationController');

router.post('/', authMiddleware, roleMiddleware('tenant'), documentUpload.array('documents', 5), applyForProperty);
router.get('/my', authMiddleware, roleMiddleware('tenant'), getTenantApplications);
router.get('/my-applications', authMiddleware, roleMiddleware('tenant'), getTenantApplications);
router.put('/:id/withdraw', authMiddleware, roleMiddleware('tenant'), withdrawApplication);

router.get('/landlord', authMiddleware, roleMiddleware('landlord'), getLandlordApplications);
router.get('/property/:propertyId', authMiddleware, roleMiddleware('landlord'), getLandlordApplications);
router.put('/:id/review', authMiddleware, roleMiddleware('landlord'), reviewApplication);

module.exports = router;