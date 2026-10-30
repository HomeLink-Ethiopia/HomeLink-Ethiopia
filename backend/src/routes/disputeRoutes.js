const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage
} = require('../controller/disputeController');

const {
    getAllDisputes,
    resolveDispute
} = require('../controller/admin/adminController');

// All dispute routes require authentication
router.use(authMiddleware);

// Create a new dispute (allows uploading evidence like chat screenshots/contracts)
router.post('/', documentUpload.array('evidence', 5), createDispute);

// Get all disputes for admin or my disputes for tenant/landlord
router.get('/', (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return getAllDisputes(req, res, next);
    }
    return getMyDisputes(req, res, next);
});

// Explicit list endpoints
router.get('/my', getMyDisputes);
router.get('/all', getAllDisputes);

// Admin review / resolution endpoint
router.put('/:id/review', (req, res, next) => {
    if (req.body.decision && !req.body.status) {
        req.body.status = req.body.decision === 'resolve' ? 'resolved' : 'rejected';
    }
    if (req.body.resolution && !req.body.outcome) {
        req.body.outcome = req.body.resolution;
    }
    return resolveDispute(req, res, next);
});

// Get details of a specific dispute
router.get('/:id', getDisputeById);

// Add a message/reply to a dispute thread
router.post('/:id/messages', documentUpload.array('attachments', 3), addDisputeMessage);

module.exports = router;
