
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const agreementController = require('../controller/agreementController');

// All agreement routes require authentication.
router.use(authMiddleware);

// List agreements belonging to the logged-in user.
router.get('/', agreementController.getAgreements);
router.get('/my', agreementController.getAgreements);

// Create an agreement (landlords only).
router.post('/', (req, res, next) => {
    if (req.user.role !== 'landlord') {
        return res.status(403).json({
            message: 'Only landlords can create rental agreements'
        });
    }
    next();
}, agreementController.createAgreement);

// Retrieve one agreement.
router.get('/:id', agreementController.getAgreementById);

// Sign an agreement.
router.post('/:id/sign', agreementController.signAgreement);

// Terminate an agreement.
router.post('/:id/terminate', agreementController.terminateAgreement);

// Renew an agreement.
router.patch('/:id/renew', agreementController.renewAgreement);

module.exports = router;
