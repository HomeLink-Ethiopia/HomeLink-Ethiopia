/**
 * Support inbox (sprint-support-inbox) — backs the public /support contact
 * form ("Still have questions?"). Messages persist to mockStore.supportMessages
 * in mock mode (MongoDB unavailable locally), so support requests are never
 * silently dropped, and admins can read/reply to them from
 * /admin/support-requests.
 */
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { isMockMode, mockStore } = require('../config/db');

const VALID_STATUS = ['new', 'in_progress', 'resolved'];

// ─── Public: submit a support message — POST /api/v1/support/requests
router.post('/requests', async (req, res) => {
  try {
    const { name, contact, message } = req.body || {};
    if (!String(name || '').trim() || !String(contact || '').trim() || !String(message || '').trim()) {
      return res.status(400).json({ message: 'name, contact and message are required' });
    }
    if (String(message).length > 4000) {
      return res.status(400).json({ message: 'Message too long (max 4000 chars)' });
    }
    const doc = {
      _id: 'mock-support-' + Date.now().toString(36),
      name: String(name).trim().slice(0, 120),
      contact: String(contact).trim().slice(0, 160),
      message: String(message).trim().slice(0, 4000),
      status: 'new',
      userEmail: req.user ? req.user.email : null,
      createdAt: new Date().toISOString(),
    };
    if (isMockMode()) {
      mockStore.supportMessages.push(doc);
      return res.status(201).json({ data: { _id: doc._id, createdAt: doc.createdAt }, message: 'Message received — our team will contact you shortly.' });
    }
    // MongoDB path — best-effort persist into the notifications collection
    // with a dedicated type so support requests survive restarts.
    const Notification = require('../models/Notification');
    await Notification.create({
      userId: null,
      type: 'support_request',
      title: `Support request from ${doc.name}`,
      body: `Contact: ${doc.contact}\n\n${doc.message}`,
      meta: { name: doc.name, contact: doc.contact, supportStatus: 'new' },
    });
    return res.status(201).json({ data: { _id: null, createdAt: doc.createdAt }, message: 'Message received — our team will contact you shortly.' });
  } catch (error) {
    console.error('support POST error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Admin: list support messages — GET /api/v1/support/requests
router.get('/requests', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const list = [...mockStore.supportMessages].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.status(200).json({ data: list });
  } catch (error) {
    console.error('support list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Admin: update status — PUT /api/v1/support/requests/:id
router.put('/requests/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ message: 'status must be one of ' + VALID_STATUS.join(', ') });
    }
    const doc = mockStore.supportMessages.find((m) => m._id === req.params.id);
    if (!doc) return res.status(404).json({ message: 'Support message not found' });
    doc.status = status;
    res.status(200).json({ data: doc });
  } catch (error) {
    console.error('support update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
