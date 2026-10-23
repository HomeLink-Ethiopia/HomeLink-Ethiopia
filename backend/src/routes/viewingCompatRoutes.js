/**
 * Sprint 7 — Viewing compat routes, mounted inside viewingRoutes before /:id.
 *
 * The frontend calls two endpoints the team router doesn't expose:
 *   GET  /api/v1/viewings/my          → tenant's viewing list (populated)
 *   POST /api/v1/viewings/:id/cancel  → tenant cancels their own request
 *
 * Kept additive so the team's own routes stay untouched.
 */
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const Viewing = require('../models/Viewing');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

// GET /api/v1/viewings/my — tenant's requests, newest first
router.get('/my', authMiddleware, async (req, res) => {
  try {
    if (isMockMode()) {
      const userId = String(req.user.id || '');
      const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
      const userEmail = req.user?.email || foundUser?.email;
      const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userEmail === 'hanna@example.com';
      const mine = [...(mockStore.viewings || [])]
        .filter((v) => {
          const tId = String((v.tenantId && typeof v.tenantId === 'object' ? v.tenantId._id : v.tenantId) || '');
          return tId === userId || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId));
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ data: mine });
    }
    const viewings = await Viewing.find({ tenantId: req.user.id })
      .populate('propertyId', 'title location rentAmount images')
      .sort({ createdAt: -1 });

    // Frontend parses: data.data || data.viewings, reads preferredDate/
    // preferredTime/message/landlordResponse — map from the team schema
    const data = viewings.map((v) => {
      const doc = v.toObject();
      const slot = doc.requestedSlots?.[0] || doc.confirmedSlot || null;
      return {
        ...doc,
        preferredDate: slot?.date || null,
        preferredTime: slot?.startTime || null,
        message: doc.tenantNote || '',
        landlordResponse: doc.landlordNote || '',
      };
    });

    res.status(200).json({ data });
  } catch (error) {
    console.error('Get my viewings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/v1/viewings/:id/cancel — tenant cancels their own request
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    if (isMockMode()) {
      const userId = String(req.user.id || '');
      const viewing = (mockStore.viewings || []).find(
        (x) => x._id === req.params.id && (String(typeof x.tenantId === 'object' ? x.tenantId._id : x.tenantId) === userId || userId === 'mock-user-seed-1')
      );
      if (!viewing) {
        return res.status(404).json({ message: 'Viewing not found or unauthorized' });
      }
      viewing.status = 'cancelled';
      viewing.cancellationReason = req.body?.reason || 'Cancelled by tenant';
      viewing.cancelledBy = 'tenant';
      if (typeof persistMockData === 'function') persistMockData();
      return res.status(200).json({ message: 'Viewing cancelled', data: viewing });
    }
    const viewing = await Viewing.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.id },
      {
        status: 'cancelled',
        cancellationReason: req.body?.reason || 'Cancelled by tenant',
        cancelledBy: 'tenant',
      },
      { new: true }
    );

    if (!viewing) {
      return res.status(404).json({ message: 'Viewing not found or unauthorized' });
    }

    res.status(200).json({ message: 'Viewing cancelled', data: viewing });
  } catch (error) {
    console.error('Cancel viewing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
