const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const AuditLog = require('../models/AuditLog');
const { isMockMode, mockStore } = require('../config/db');

// Admin only: Get system audit trail
router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
    try {
        if (isMockMode()) {
            return res.status(200).json({ data: mockStore.auditLogs || [] });
        }

        const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
        const mapped = logs.map(l => ({
            _id: l._id,
            actorName: l.actorName || 'Admin',
            actorRole: l.actorRole || 'admin',
            action: l.action,
            targetType: l.targetEntity?.entityType || l.targetType || 'System',
            targetLabel: l.targetLabel || `${l.targetEntity?.entityType || 'Entity'} ${l.targetEntity?.entityId || ''}`,
            changes: l.changes || [],
            decision: l.decision || l.action,
            reason: l.metadata?.reason || l.reason || '',
            ip: l.ipAddress || l.ip || '127.0.0.1',
            createdAt: l.createdAt
        }));
        res.status(200).json({ data: mapped });
    } catch (error) {
        console.error('Audit logs error:', error);
        res.status(500).json({ message: 'Server error loading audit logs' });
    }
});

module.exports = router;
