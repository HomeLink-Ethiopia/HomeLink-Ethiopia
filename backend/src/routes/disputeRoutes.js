const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage,
    withdrawDispute,
    reviewDispute,
    listAllDisputes
} = require('../controller/disputeController');
const roleMiddleware = require('../middleware/roleMiddleware');

// All dispute routes require authentication
router.use(authMiddleware);

// ─── Sprint 11: admin moderation ────────────────────────────────────────
// Admin list — every dispute (must be registered before /:id routes).
router.get('/', roleMiddleware('admin'), listAllDisputes);
// Admin moderation: investigate | request_evidence | resolve | reject (audited).
router.put('/:id/review', roleMiddleware('admin'), reviewDispute);
// Filer withdraws their own dispute.
router.post('/:id/withdraw', withdrawDispute);

// Create a new dispute (allows uploading evidence like chat screenshots/contracts)
router.post('/', documentUpload.array('evidence', 5), createDispute);

// Get disputes where the logged-in user is involved (either raised by them or against them)
router.get('/my', getMyDisputes);

// Get details of a specific dispute (Admins see all notes, users see public notes)
router.get('/:id', getDisputeById);

// Add a message/reply to a dispute thread
router.post('/:id/messages', documentUpload.array('attachments', 3), addDisputeMessage);

module.exports = router;
