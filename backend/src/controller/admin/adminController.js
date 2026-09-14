const AuditLog = require('../../models/AuditLog');
const Dispute = require('../../models/Dispute');
const FraudReport = require('../../models/FraudReport');
const LandlordProfile = require('../../models/LandlordProfile');
const Property = require('../../models/Property');
const User = require('../../models/User');

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
        const { reason } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const before = { status: user.status };
        // Assuming user model has a status field
        user.status = 'suspended';
        await user.save();

        const after = { status: user.status };
        await createAuditLog(req, 'user.suspend', 'User', user._id, before, after, { reason });

        res.status(200).json({ message: "User suspended successfully" });
    } catch (error) {
        console.error("Suspend user error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// --- Management Lists (Phase 2) ---

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ data: users });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllProperties = async (req, res) => {
    try {
        const properties = await Property.find().populate('landlordId', 'firstName lastName email').sort({ createdAt: -1 });
        res.status(200).json({ data: properties });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllFraudReports = async (req, res) => {
    try {
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
