const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require('../middleware/upload');
const {
    submitIdentityVerification,
    submitVerification,
    getVerificationStatus,
    getPendingVerifications,
    reviewVerification,
    getVerificationDetails,
    reviewLandlordVerification,
    resetIdentityVerification
} = require('../controller/verificationController');

router.post(
    '/reset-identity',
    authMiddleware,
    roleMiddleware('landlord'),
    resetIdentityVerification
);

router.post(
    '/submit-identity',
    authMiddleware,
    roleMiddleware('landlord'),
    upload.array('files', 10),
    submitIdentityVerification
);

router.post(
    '/submit',
    authMiddleware,
    roleMiddleware('landlord'),
    upload.array('files', 10),
    submitVerification
);

router.get(
    '/status',
    authMiddleware,
    roleMiddleware('landlord'),
    getVerificationStatus
);

router.get(
    '/pending',
    authMiddleware,
    roleMiddleware('admin'),
    getPendingVerifications
);

router.put(
    '/landlord/:id/review',
    authMiddleware,
    roleMiddleware('admin'),
    reviewLandlordVerification
);

router.put(
    '/:id/review',
    authMiddleware,
    roleMiddleware('admin'),
    reviewVerification
);

router.get(
    '/:id',
    authMiddleware,
    roleMiddleware('admin'),
    getVerificationDetails
);

module.exports = router;
