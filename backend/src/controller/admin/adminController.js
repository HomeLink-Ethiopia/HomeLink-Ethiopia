const AuditLog = require('../../models/AuditLog');
const Dispute = require('../../models/Dispute');
const FraudReport = require('../../models/FraudReport');
const LandlordProfile = require('../../models/LandlordProfile');
const Property = require('../../models/Property');
const User = require('../../models/User');
const { isMockMode, mockStore, pushMockAudit } = require('../../config/db');

// --- Helper: Create Audit Log ---
const createAuditLog = async (req, action, targetType, targetId, before, after, metadata = {}) => {
    try {
        await AuditLog.create({
            performedBy: req.user.id,
            action,
            targetEntity: {
                entityType: targetType,
                entityId: targetId
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            before,
            after,
            metadata
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
    }
};

// --- Dashboard ---
const getDashboardOverview = async (req, res) => {
    try {
        if (isMockMode()) {
            const openDisputes = (mockStore.disputes || []).filter((d) => ['open', 'under_review', 'mediation'].includes(d.status));
            const openFraudReports = (mockStore.fraudReports || [])
                .filter((r) => ['open', 'under_review'].includes(r.status))
                .sort((a, b) => (b.aiRiskScore || 0) - (a.aiRiskScore || 0));
            const pendingVerifications = [...(mockStore.landlordProfiles || new Map()).values()].filter((p) => p.verificationStatus === 'pending');
            const suspiciousProperties = (mockStore.properties || []).filter((p) => (p.riskLevel === 'high' || (p.fraudRiskScore || 0) > 50) && p.listingStatus === 'active');
            const flagged = new Set(
                (mockStore.fraudReports || []).filter((r) => r.status === 'open' && r.reportedUserId).map((r) => String((r.reportedUserId && r.reportedUserId._id) || r.reportedUserId))
            );
            const suspiciousAccounts = Array.from(mockStore.users.values()).filter((u) => flagged.has(String(u._id)));
            return res.status(200).json({
                data: {
                    openDisputes,
                    openFraudReports,
                    pendingVerifications,
                    suspiciousProperties,
                    suspiciousAccounts,
                    counts: {
                        disputes: openDisputes.length,
                        fraud: openFraudReports.length,
                        verifications: pendingVerifications.length,
                        suspiciousProperties: suspiciousProperties.length,
                        suspiciousAccounts: suspiciousAccounts.length,
                    },
                }
            });
        }
        const [
            openDisputes,
            openFraudReports,
            pendingVerifications,
            suspiciousProperties
        ] = await Promise.all([
            Dispute.find({ status: { $in: ['open', 'under_review', 'mediation'] } }).populate('raisedBy againstUserId', 'firstName lastName email').limit(10),
            FraudReport.find({ status: { $in: ['open', 'under_review'] } }).populate('reportedBy reportedPropertyId reportedUserId').sort({ aiRiskScore: -1 }).limit(10),
            LandlordProfile.find({ verificationStatus: 'pending' }).populate('accountId', 'firstName lastName email').limit(10),
            Property.find({ riskLevel: 'high', listingStatus: 'active' }).populate('landlordId').limit(10)
        ]);

        // Suspicious accounts can be found by finding users with open fraud reports against them
        const suspiciousAccountsIds = await FraudReport.distinct('reportedUserId', { status: 'open', reportedUserId: { $ne: null } });
        const suspiciousAccounts = await User.find({ _id: { $in: suspiciousAccountsIds } }).limit(10);

        res.status(200).json({
            data: {
                openDisputes,
                openFraudReports,
                pendingVerifications,
                suspiciousProperties,
                suspiciousAccounts
            }
        });
    } catch (error) {
        console.error("Dashboard overview error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// --- Actions ---

const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { outcome, status } = req.body;

        const dispute = await Dispute.findById(id);
        if (!dispute) return res.status(404).json({ message: "Dispute not found" });

        const before = { status: dispute.status, outcome: dispute.outcome };
        
        dispute.status = status || 'resolved';
        dispute.outcome = outcome;
        dispute.resolvedAt = new Date();
        dispute.handledBy = req.user.id;
        dispute.history.push({
            status: dispute.status,
            changedBy: req.user.id,
            note: outcome
        });

        await dispute.save();

        const after = { status: dispute.status, outcome: dispute.outcome };
        await createAuditLog(req, 'dispute.resolve', 'Dispute', dispute._id, before, after);

        res.status(200).json({ message: "Dispute resolved successfully", data: dispute });
    } catch (error) {
        console.error("Resolve dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const verifyLandlord = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' or 'reject'

        const profile = await LandlordProfile.findById(id);
        if (!profile) return res.status(404).json({ message: "Landlord profile not found" });

        const before = { verificationStatus: profile.verificationStatus };
        
        profile.verificationStatus = (action === 'approve') ? 'verified' : 'rejected';
        await profile.save();

        const after = { verificationStatus: profile.verificationStatus };
        await createAuditLog(req, `landlord.${action}`, 'LandlordProfile', profile._id, before, after);

        res.status(200).json({ message: `Landlord verification ${action}d successfully` });
    } catch (error) {
        console.error("Verify landlord error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const suspendAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const suspend = req.body && req.body.suspend !== undefined ? Boolean(req.body.suspend) : true;
        const reason = (req.body && req.body.reason) || '';

        if (isMockMode()) {
            let user = null;
            for (const u of mockStore.users.values()) { if (u._id === id) { user = u; break; } }
            if (!user) return res.status(404).json({ message: "User not found" });
            const before = user.isActive !== false;
            user.isActive = !suspend;
            pushMockAudit(req, suspend ? 'user.suspend' : 'user.unsuspend', 'user', ((user.firstName || '') + ' ' + (user.lastName || '')).trim() + ' (' + user.email + ')', before ? 'active' : 'suspended', suspend ? 'suspended' : 'active', reason);
            return res.status(200).json({ message: suspend ? 'User suspended successfully' : 'User reinstated successfully', data: { _id: user._id, isActive: user.isActive } });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const before = user.isActive;
        user.isActive = !suspend;
        await user.save();

        await createAuditLog(req, suspend ? 'user.suspend' : 'user.unsuspend', 'User', user._id, { isActive: before }, { isActive: user.isActive }, { reason });

        res.status(200).json({ message: suspend ? 'User suspended successfully' : 'User reinstated successfully' });
    } catch (error) {
        console.error("Suspend user error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// --- Management Lists (Phase 2) ---

const getAllUsers = async (req, res) => {
    try {
        if (isMockMode()) {
            const seen = new Set();
            const rows = [];
            for (const u of mockStore.users.values()) { rows.push(u); seen.add(u._id); }
            const synth = [
                { _id: 'mock-user-seed-1', firstName: 'Hanna', lastName: 'Tesfaye', email: 'hanna@example.com', role: 'tenant' },
                { _id: 'mock-user-seed-2', firstName: 'Mikias', lastName: 'Bekele', email: 'mikias@example.com', role: 'tenant' },
                { _id: 'mock-landlord-1', firstName: 'Dev', lastName: 'Landlord', email: 'dev.landlord@homelink.test', role: 'landlord' },
                { _id: 'mock-admin-1', firstName: 'Dev', lastName: 'Admin', email: 'dev.admin@homelink.test', role: 'admin' },
            ];
            for (const su of synth) if (!seen.has(su._id)) rows.push({ ...su, identityStatus: 'verified', isActive: true, emailVerified: true });
            const idOf = (v) => String((v && v._id) || v || '');
            const data = rows.map((u) => ({
                _id: u._id,
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                verificationStatus: u.verificationStatus || (u.role === 'landlord' ? 'verified' : 'unverified'),
                identityStatus: u.identityStatus || 'verified',
                isActive: u.isActive !== false,
                emailVerified: u.emailVerified !== false,
                reportsAgainst: (mockStore.fraudReports || []).filter((r) => idOf(r.reportedUserId) === String(u._id)).length,
                disputesAgainst: (mockStore.disputes || []).filter((d) => idOf(d.againstUserId) === String(u._id)).length,
                createdAt: u.createdAt || new Date().toISOString(),
            })).sort((a, b) => (b.reportsAgainst + b.disputesAgainst) - (a.reportsAgainst + a.disputesAgainst));
            return res.status(200).json({ data });
        }
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ data: users });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllProperties = async (req, res) => {
    try {
            if (isMockMode()) {
                const idOf = (v) => String((v && v._id) || v || '');
                const nameOf = (lid) => {
                    const pid = idOf(lid);
                    const prof = (mockStore.landlordProfiles || new Map()).get(pid);
                    if (prof && prof.legalName) return prof.legalName;
                    const u = Array.from(mockStore.users.values()).find((x) => x._id === pid);
                    return u ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim() : 'Unknown landlord';
                };
                const data = (mockStore.properties || []).slice().reverse().map((pr) => ({
                    ...pr,
                    landlordName: nameOf(pr.landlordId),
                    city: (pr.location && (pr.location.subCity || pr.location.city)) || '',
                }));
                return res.status(200).json({ data });
            }
        const properties = await Property.find().populate('landlordId', 'firstName lastName email').sort({ createdAt: -1 });
        res.status(200).json({ data: properties });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllFraudReports = async (req, res) => {
    try {
            if (isMockMode()) return res.status(200).json({ data: [...(mockStore.fraudReports || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
        const reports = await FraudReport.find()
            .populate('reportedBy reportedPropertyId reportedUserId')
            .sort({ createdAt: -1 });
        res.status(200).json({ data: reports });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllDisputes = async (req, res) => {
    try {
            if (isMockMode()) return res.status(200).json({ data: [...(mockStore.disputes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
        const disputes = await Dispute.find()
            .populate('raisedBy againstUserId handledBy', 'firstName lastName email')
            .sort({ createdAt: -1 });
        res.status(200).json({ data: disputes });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllVerifications = async (req, res) => {
    try {
            if (isMockMode()) {
                const landlords = [...(mockStore.landlordProfiles || new Map()).values()];
                const properties = mockStore.propertyVerifications || [];
                return res.status(200).json({ data: { landlords, properties } });
            }
        const profiles = await LandlordProfile.find()
            .populate('accountId', 'firstName lastName email')
            .sort({ createdAt: -1 });
        res.status(200).json({ data: profiles });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getDashboardOverview,
    resolveDispute,
    verifyLandlord,
    suspendAccount,
    getAllUsers,
    getAllProperties,
    getAllFraudReports,
    getAllDisputes,
    getAllVerifications
};
