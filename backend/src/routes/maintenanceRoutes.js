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

// ─── Sprint 8/9: mock-mode branches so tenant updates + confirmation work offline ───
// (sprint89-mock-maintenance) POST /:id/updates (add response) and PUT /:id/confirm.
const { isMockMode, mockStore, mockCreateNotification } = require('../config/db');

const sprint89FindTicket = (id) => (mockStore.maintenance || []).find((t) => t._id === id);

router.post('/:id/updates', authMiddleware, roleMiddleware('tenant', 'landlord'), (req, res) => {
  if (isMockMode()) {
    const t = sprint89FindTicket(req.params.id);
    if (!t) return res.status(404).json({ message: 'Ticket not found' });
    const userId = req.user.id;
    if (t.tenantId !== userId && t.landlordId !== userId) return res.status(403).json({ message: 'Unauthorized' });
    const note = (req.body && (req.body.note || req.body.response)) || '';
    if (!note.trim()) return res.status(400).json({ message: 'Note cannot be empty' });
    t.updates = t.updates || [];
    t.updates.push({ status: t.status, note, updatedBy: userId, timestamp: new Date().toISOString() });
    const other = t.tenantId === userId ? t.landlordId : t.tenantId;
    mockCreateNotification(other, 'maintenance_update', 'New Comment on Maintenance Ticket', note.slice(0, 120), 'MaintenanceRequest', t._id);
    return res.status(201).json({ message: 'Note added to ticket', data: t });
  }
  addUpdateNote(req, res);
});

router.put('/:id/confirm', authMiddleware, roleMiddleware('tenant'), (req, res) => {
  if (isMockMode()) {
    const t = sprint89FindTicket(req.params.id);
    if (!t) return res.status(404).json({ message: 'Ticket not found or unauthorized' });
    if (t.tenantId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });
    if (t.status !== 'resolved') return res.status(400).json({ message: 'Ticket is not in resolved state' });
    t.status = 'closed';
    t.closedAt = new Date().toISOString();
    t.updates = t.updates || [];
    t.updates.push({ status: 'closed', note: 'Tenant confirmed the resolution', updatedBy: req.user.id, timestamp: new Date().toISOString() });
    mockCreateNotification(t.landlordId, 'maintenance_update', 'Resolution Confirmed', 'The tenant has confirmed the repair is complete.', 'MaintenanceRequest', t._id);
    return res.status(200).json({ message: 'Resolution confirmed and ticket closed', data: t });
  }
  confirmResolution(req, res);
});

// Tenant creates a maintenance request (can attach photos/videos)
router.post('/', authMiddleware, roleMiddleware('tenant'), documentUpload.array('media', 5), createTicket);

// Landlord updates the status (e.g., assigned, in_progress, resolved)
router.put('/:id/status', authMiddleware, roleMiddleware('landlord'), updateTicketStatus);

// Tenant or Landlord adds a comment/update to the ticket
router.post('/:id/updates', authMiddleware, roleMiddleware('tenant', 'landlord'), addUpdateNote);

// Get tickets for the logged-in user
// Frontend alias: GET /my (same handler, role inferred from token)
router.get('/my', authMiddleware, roleMiddleware('tenant', 'landlord'), getTickets);
router.get('/landlord', authMiddleware, roleMiddleware('landlord'), getTickets);
router.get('/', authMiddleware, roleMiddleware('tenant', 'landlord'), getTickets);
router.get('/:id', authMiddleware, roleMiddleware('tenant', 'landlord'), getTicketById);

// Tenant confirms the resolution
router.put('/:id/confirm', authMiddleware, roleMiddleware('tenant'), confirmResolution);

module.exports = router;
