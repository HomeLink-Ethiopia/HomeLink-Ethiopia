const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload');
const {
    submitVerification,
    submitIdentityVerification,
    getVerificationStatus,
    getPendingVerifications,
    reviewVerification,
    reviewLandlordVerification,
    getVerificationDetails,
    preScanDocument,
    requestFaydaOtp,
    verifyFaydaOtp
} = require('../controller/verificationController');

router.post(
    '/pre-scan',
    authMiddleware,
    documentUpload.single('file'),
    preScanDocument
);

router.post(
    '/fayda/request-otp',
    authMiddleware,
    roleMiddleware('landlord'),
    requestFaydaOtp
);

router.post(
    '/fayda/verify-otp',
    authMiddleware,
    roleMiddleware('landlord'),
    verifyFaydaOtp
);

router.post(
    '/submit-identity',
    authMiddleware,
    roleMiddleware('landlord'),
    documentUpload.array('files'),
    submitIdentityVerification
);

router.post(
    '/submit',
    authMiddleware,
    roleMiddleware('landlord'),
    documentUpload.array('files'),
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
