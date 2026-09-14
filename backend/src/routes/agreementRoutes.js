const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
    createAgreement,
    signAgreement,
    getAgreements,
    getAgreementById,
    terminateAgreement,
    renewAgreement
} = require('../controller/agreementController');

// Landlord creates the agreement
router.post('/', authMiddleware, roleMiddleware('landlord'), createAgreement);

// Both landlord and tenant can fetch their agreements
router.get('/', authMiddleware, roleMiddleware('landlord', 'tenant'), getAgreements);
router.get('/:id', authMiddleware, roleMiddleware('landlord', 'tenant'), getAgreementById);

// Both landlord and tenant can digitally sign the agreement
router.put('/:id/sign', authMiddleware, roleMiddleware('landlord', 'tenant'), signAgreement);

// Both landlord and tenant can terminate the agreement
router.put('/:id/terminate', authMiddleware, roleMiddleware('landlord', 'tenant'), terminateAgreement);

// Only landlords can renew the agreement
router.put('/:id/renew', authMiddleware, roleMiddleware('landlord'), renewAgreement);

module.exports = router;
