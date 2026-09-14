const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    createTicket,
    updateTicketStatus,
    addUpdateNote,
    getTickets,
    getTicketById,
    confirmResolution
} = require('../controller/maintenanceController');

// Tenant creates a maintenance request (can attach photos/videos)
router.post('/', authMiddleware, roleMiddleware('tenant'), documentUpload.array('media', 5), createTicket);

// Landlord updates the status (e.g., assigned, in_progress, resolved)
router.put('/:id/status', authMiddleware, roleMiddleware('landlord'), updateTicketStatus);

// Tenant or Landlord adds a comment/update to the ticket
router.post('/:id/updates', authMiddleware, roleMiddleware('tenant', 'landlord'), addUpdateNote);

// Get tickets for the logged-in user
router.get('/', authMiddleware, roleMiddleware('tenant', 'landlord'), getTickets);
router.get('/:id', authMiddleware, roleMiddleware('tenant', 'landlord'), getTicketById);

// Tenant confirms the resolution
router.put('/:id/confirm', authMiddleware, roleMiddleware('tenant'), confirmResolution);

module.exports = router;
