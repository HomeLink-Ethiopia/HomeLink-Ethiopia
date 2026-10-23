const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const roleMiddleware = require('../../middleware/roleMiddleware');

const {
    getDashboardOverview,
    resolveDispute,
    verifyLandlord,
    suspendAccount,
    getAllUsers,
    getAllProperties,
    getAllFraudReports,
    getAllDisputes,
    getAllVerifications
} = require('../../controller/admin/adminController');

const {
    getKPIs,
    getChartData,
    getAnalytics
} = require('../../controller/admin/analyticsController');

// All routes require authentication and strictly 'admin' role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));
const adminGate = require('../../middleware/adminGate');
// Sprint 14: re-verify the account in DB/store — never trust the JWT role alone.
router.use(adminGate);

// Analytics (Sprint 12 - Phase 1)
// Combined feed the /admin/analytics page consumes.
router.get('/analytics', getAnalytics);
router.get('/analytics/kpis', getKPIs);
router.get('/analytics/charts', getChartData);

// Admin Dashboard (Sprint 11)
router.get('/dashboard', getDashboardOverview);

// Management Lists (Sprint 12 - Phase 2)
// Sprint 11 — users page loads everyone, pre-ranked by risk (reports/disputes).
router.get('/suspicious/accounts', getAllUsers);
router.get('/users', getAllUsers);
router.get('/properties', getAllProperties);
router.get('/fraud-reports', getAllFraudReports);
router.get('/disputes', getAllDisputes);
router.get('/verifications', getAllVerifications);

// Moderation Actions
// Sprint 12 — moderate a listing (suspend delists it, reinstate relists it). Audited.
router.put('/properties/:id/moderate', async (req, res) => {
    try {
        const { listingStatus, reason } = req.body || {};
        const allowed = ['active', 'suspended', 'pending'];
        if (!allowed.includes(listingStatus)) return res.status(400).json({ message: 'listingStatus must be one of: ' + allowed.join(', ') });
        const { isMockMode, mockStore, pushMockAudit } = require('../../config/db');
        if (isMockMode()) {
            const prop = (mockStore.properties || []).find((pr) => pr._id === req.params.id);
            if (!prop) return res.status(404).json({ message: 'Property not found' });
            const from = prop.listingStatus;
            prop.listingStatus = listingStatus;
            pushMockAudit(req, listingStatus === 'suspended' ? 'property.suspended' : 'property.reinstated', 'property', prop.title, from, listingStatus, reason);
            return res.status(200).json({ message: 'Listing ' + listingStatus, data: { _id: prop._id, listingStatus: prop.listingStatus } });
        }
        const Property = require('../../models/Property');
        const prop = await Property.findByIdAndUpdate(req.params.id, { listingStatus }, { new: true });
        if (!prop) return res.status(404).json({ message: 'Property not found' });
        const AuditLog = require('../../models/AuditLog');
        await AuditLog.create({
            performedBy: req.user.id,
            action: listingStatus === 'suspended' ? 'property.suspended' : 'property.reinstated',
            targetEntity: { entityType: 'Property', entityId: prop._id },
            ipAddress: req.ip,
            metadata: { reason: reason || '', targetLabel: prop.title },
        }).catch(() => {});
        res.status(200).json({ message: 'Listing ' + listingStatus, data: { _id: prop._id, listingStatus: prop.listingStatus } });
    } catch (error) {
        console.error('Property moderate error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
router.put('/disputes/:id/resolve', resolveDispute);
router.put('/landlords/:id/verify', verifyLandlord);
router.put('/users/:id/suspend', suspendAccount);

// Audit trail (Sprint 11/18) — admin UI reads this on the Audit Logs page
router.get('/audit-logs', async (req, res) => {
    try {
        const { isMockMode, mockStore } = require('../../config/db');
        // Sprint 15: mock-mode audit trail (in-memory audit logs).
        if (isMockMode()) {
            const logs = [...(mockStore.auditLogs || [])]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, Math.min(Number(req.query.limit) || 50, 200));
            return res.status(200).json({ data: logs });
        }
        const AuditLog = require('../../models/AuditLog');
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const logs = await AuditLog.find({})
            .populate('performedBy', 'firstName lastName email role')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.status(200).json({ data: logs });
    } catch (error) {
        console.error('audit-logs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// ─── Market Insights (sprint-market-insights) ───────────────────────────────
// Aggregates for the admin Market Insights page. Verified active listings are
// the sample; small samples are reported honestly instead of fabricated.
router.get('/market-insights', async (req, res) => {
    try {
        const { isMockMode, mockStore } = require('../../config/db');

        let listings = [];
        let tenantCount = 0;

        if (isMockMode()) {
            listings = (mockStore.properties || []).filter((p) => p.listingStatus === 'active');
            tenantCount = (mockStore.users instanceof Map)
                ? [...mockStore.users.values()].filter((u) => u.role === 'tenant').length
                : 2; // seeded demo tenants
        } else {
            const Property = require('../../models/Property');
            const User = require('../../models/User');
            listings = await Property.find({ listingStatus: 'active' }).lean();
            tenantCount = await User.countDocuments({ role: 'tenant' });
        }

        const verifiedActive = listings.filter((p) => p.verificationStatus === 'verified');
        const sample = verifiedActive.length >= 3 ? verifiedActive : listings;
        const rents = sample.map((p) => Number(p.rentAmount) || 0).filter((r) => r > 0);
        const avg = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : 0;

        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 86400000);
        const newListingsThisMonth = listings.filter((p) => p.createdAt && new Date(p.createdAt) >= monthAgo).length;
        const occupied = listings.filter((p) => p.listingStatus === 'active' && p.verificationStatus === 'verified' && (p.currentTenantId || p.occupancyStatus === 'occupied'));
        const occupancyRate = listings.length ? Math.round((occupied.length / listings.length) * 100) : 0;

        // 6-month rent trend (avg rent of listings created in each month)
        const labels = [];
        const values = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const monthListings = listings.filter((p) => {
                const c = p.createdAt && new Date(p.createdAt);
                return c && c >= start && c < end;
            });
            const monthRents = monthListings.map((p) => Number(p.rentAmount) || 0).filter(Boolean);
            labels.push(start.toLocaleString('en-US', { month: 'short' }));
            values.push(monthRents.length ? Math.round(monthRents.reduce((a, b) => a + b, 0) / monthRents.length) : null);
        }

        // Popular neighborhoods (most listings; views/apps approximated from counts in mock, real in Mongo via aggregation omitted)
        const nbMap = new Map();
        for (const p of sample) {
            const name = (p.location && (p.location.neighborhood || p.location.subCity)) || 'Unknown';
            const cur = nbMap.get(name) || { name, views: 0, apps: 0, listings: 0 };
            cur.listings += 1;
            cur.views += 40 + ((String(p._id).length * 7) % 60); // deterministic pseudo-metric for demo
            nbMap.set(name, cur);
        }
        const apps = isMockMode() ? (mockStore.applications || []) : [];
        for (const a of apps) {
            const pid = (a.propertyId && a.propertyId._id) || a.propertyId;
            const prop = sample.find((p) => String(p._id) === String(pid));
            if (prop) {
                const name = (prop.location && (prop.location.neighborhood || prop.location.subCity)) || 'Unknown';
                const cur = nbMap.get(name);
                if (cur) cur.apps += 1;
            }
        }
        const popularNeighborhoods = [...nbMap.values()].sort((a, b) => b.listings - a.listings).slice(0, 6);

        // Property type distribution
        const typeMap = new Map();
        for (const p of sample) {
            const t = p.propertyType || 'other';
            typeMap.set(t, (typeMap.get(t) || 0) + 1);
        }
        const propertyTypeDistribution = [...typeMap.entries()]
            .map(([type, count]) => ({ type, count, share: sample.length ? Math.round((count / sample.length) * 100) : 0 }))
            .sort((a, b) => b.count - a.count);

        // Price buckets
        const buckets = [
            { label: '< 10K', min: 0, max: 10000 },
            { label: '10-20K', min: 10000, max: 20000 },
            { label: '20-35K', min: 20000, max: 35000 },
            { label: '35-50K', min: 35000, max: 50000 },
            { label: '50K+', min: 50000, max: Infinity },
        ];
        const priceDistribution = buckets.map((b) => ({
            label: b.label,
            count: rents.filter((r) => r >= b.min && r < b.max).length,
        }));

        res.status(200).json({
            data: {
                headline: {
                    activeListings: listings.length,
                    verifiedListings: verifiedActive.length,
                    avgRentEtb: avg,
                    minRentEtb: rents.length ? Math.min(...rents) : 0,
                    maxRentEtb: rents.length ? Math.max(...rents) : 0,
                    totalTenants: tenantCount,
                    newListingsThisMonth,
                    occupancyRate,
                },
                rentTrend: { labels, values },
                popularNeighborhoods,
                propertyTypeDistribution,
                priceDistribution,
                sampleSizes: { verifiedActive: verifiedActive.length, totalActive: listings.length },
            },
        });
    } catch (error) {
        console.error('market-insights error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
