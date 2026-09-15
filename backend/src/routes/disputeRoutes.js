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

// All dispute routes require authentication
router.use(authMiddleware);

// Create a new dispute (allows uploading evidence like chat screenshots/contracts)
router.post('/', documentUpload.array('evidence', 5), createDispute);

// Get disputes where the logged-in user is involved (either raised by them or against them)
router.get('/my', getMyDisputes);

// Get details of a specific dispute (Admins see all notes, users see public notes)
router.get('/:id', getDisputeById);

// Add a message/reply to a dispute thread
router.post('/:id/messages', documentUpload.array('attachments', 3), addDisputeMessage);

module.exports = router;
