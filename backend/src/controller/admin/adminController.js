const AuditLog = require('../../models/AuditLog');
const Dispute = require('../../models/Dispute');
const FraudReport = require('../../models/FraudReport');
const LandlordProfile = require('../../models/LandlordProfile');
const Property = require('../../models/Property');
const User = require('../../models/User');
const RentalAgreement = require('../../models/RentalAgreement');
const Application = require('../../models/Application');
const MaintenanceRequest = require('../../models/MaintenanceRequest');
const { STANDARD_RENTAL_TERMS } = require('../../utils/rentalTerms');
const { isMockMode, mockStore, persistMockData, persistMockUsers, pushMockAudit, mockCreateNotification } = require('../../config/db');

// --- Helper: Create Audit Log ---
const createAuditLog = async (req, action, targetType, targetId, before, after, metadata = {}) => {
    try {
        if (isMockMode()) {
            pushMockAudit({
                actorName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'Admin',
                actorRole: 'admin',
                action,
                targetType,
                targetLabel: `${targetType} ${targetId}`,
                changes: [{ field: 'status', from: before?.status, to: after?.status }],
                reason: metadata?.reason || action,
                ip: req.ip || '127.0.0.1'
            });
            return;
        }
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

// --- Dashboard Overview ---
const getDashboardOverview = async (req, res) => {
    try {
        if (isMockMode()) {
            const openDisputes = (mockStore.disputes || []).filter(d => ['open', 'under_review', 'mediation'].includes(d.status));
            const openFraudReports = (mockStore.fraudReports || []).filter(f => ['open', 'under_review'].includes(f.status));
            
            const rawProfiles = Array.from((mockStore.landlordProfiles || new Map()).values());
            const pendingVerifications = rawProfiles.filter(lp => lp.verificationStatus === 'pending').map(lp => {
                const u = Array.from(mockStore.users.values()).find(user => String(user._id) === String(lp.accountId?._id || lp.accountId));
                return {
                    _id: lp._id,
                    accountId: u ? { firstName: u.firstName, lastName: u.lastName, email: u.email } : { firstName: lp.legalName || 'Landlord', email: 'landlord@test.com' },
                    legalName: lp.legalName,
                    verificationStatus: lp.verificationStatus,
                    createdAt: lp.createdAt || new Date().toISOString()
                };
            });

            const suspiciousProperties = (mockStore.properties || []).filter(p => p.riskLevel === 'high' || (p.fraudRiskScore && p.fraudRiskScore > 7));
            const suspiciousAccounts = Array.from(mockStore.users.values()).filter(u => u.status === 'suspended' || u.role === 'suspended').slice(0, 5);

            return res.status(200).json({
                data: {
                    openDisputes,
                    openFraudReports,
                    pendingVerifications,
                    suspiciousProperties,
                    suspiciousAccounts
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

        if (isMockMode()) {
            const dispute = (mockStore.disputes || []).find(d => String(d._id) === String(id));
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });

            const before = { status: dispute.status, outcome: dispute.outcome };
            dispute.status = status || 'resolved';
            dispute.outcome = outcome;
            dispute.resolvedAt = new Date().toISOString();
            dispute.handledBy = req.user.id;
            if (!dispute.history) dispute.history = [];
            dispute.history.push({
                status: dispute.status,
                changedBy: req.user.id,
                note: outcome,
                at: new Date().toISOString()
            });

            const after = { status: dispute.status, outcome: dispute.outcome };
            await createAuditLog(req, 'dispute.resolve', 'Dispute', dispute._id, before, after);
            persistMockData();

            mockCreateNotification(dispute.raisedBy?._id || dispute.raisedBy, 'dispute_resolved', 'Dispute Resolved', `Your dispute has been resolved by Admin: ${outcome}`);
            mockCreateNotification(dispute.againstUserId?._id || dispute.againstUserId, 'dispute_resolved', 'Dispute Resolved', `The dispute regarding this tenancy has been resolved by Admin: ${outcome}`);

            return res.status(200).json({ message: "Dispute resolved successfully", data: dispute });
        }

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

        if (isMockMode()) {
            let profile = null;
            if (mockStore.landlordProfiles) {
                profile = mockStore.landlordProfiles.get(id);
                if (!profile) {
                    for (const v of mockStore.landlordProfiles.values()) {
                        if (String(v._id) === String(id) || String(v.accountId) === String(id)) {
                            profile = v;
                            break;
                        }
                    }
                }
            }

            if (!profile) return res.status(404).json({ message: "Landlord profile not found" });

            const before = { verificationStatus: profile.verificationStatus };
            profile.verificationStatus = (action === 'approve') ? 'verified' : 'rejected';
            const after = { verificationStatus: profile.verificationStatus };

            // Update user account
            for (const user of mockStore.users.values()) {
                if (String(user._id) === String(profile.accountId?._id || profile.accountId || profile._id)) {
                    user.identityStatus = profile.verificationStatus;
                    break;
                }
            }

            persistMockData();
            persistMockUsers();
            await createAuditLog(req, `landlord.${action}`, 'LandlordProfile', profile._id, before, after);

            return res.status(200).json({ message: `Landlord verification ${action}d successfully` });
        }

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
        const { reason, suspend } = req.body;
        const shouldSuspend = suspend !== false;

        if (isMockMode()) {
            const user = Array.from(mockStore.users.values()).find(u => String(u._id) === String(id) || String(u.email) === String(id));
            if (!user) return res.status(404).json({ message: "User not found" });

            const before = { status: user.status || 'active' };
            user.status = shouldSuspend ? 'suspended' : 'active';
            const after = { status: user.status };

            persistMockUsers();
            await createAuditLog(req, shouldSuspend ? 'user.suspend' : 'user.reinstate', 'User', user._id, before, after, { reason });

            return res.status(200).json({ message: `User ${shouldSuspend ? 'suspended' : 'reinstated'} successfully` });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const before = { status: user.status };
        user.status = shouldSuspend ? 'suspended' : 'active';
        await user.save();

        const after = { status: user.status };
        await createAuditLog(req, shouldSuspend ? 'user.suspend' : 'user.reinstate', 'User', user._id, before, after, { reason });

        res.status(200).json({ message: `User ${shouldSuspend ? 'suspended' : 'reinstated'} successfully` });
    } catch (error) {
        console.error("Suspend user error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const moderateProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const { listingStatus, reason } = req.body;

        if (isMockMode()) {
            const prop = (mockStore.properties || []).find(p => String(p._id) === String(id) || String(p.id) === String(id));
            if (!prop) return res.status(404).json({ message: "Property not found" });

            const before = { listingStatus: prop.listingStatus };
            prop.listingStatus = listingStatus || (prop.listingStatus === 'suspended' ? 'active' : 'suspended');
            const after = { listingStatus: prop.listingStatus };

            persistMockData();
            await createAuditLog(req, 'property.moderate', 'Property', prop._id, before, after, { reason });
            return res.status(200).json({ message: `Property marked as ${prop.listingStatus}`, data: prop });
        }

        const prop = await Property.findById(id);
        if (!prop) return res.status(404).json({ message: "Property not found" });

        const before = { listingStatus: prop.listingStatus };
        prop.listingStatus = listingStatus || (prop.listingStatus === 'suspended' ? 'active' : 'suspended');
        await prop.save();

        const after = { listingStatus: prop.listingStatus };
        await createAuditLog(req, 'property.moderate', 'Property', prop._id, before, after, { reason });
        res.status(200).json({ message: `Property marked as ${prop.listingStatus}`, data: prop });
    } catch (error) {
        console.error("Moderate property error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// --- Management Lists ---

const getAllUsers = async (req, res) => {
    try {
        if (isMockMode()) {
            const fraudReports = mockStore.fraudReports || [];
            const disputes = mockStore.disputes || [];
            const users = Array.from(mockStore.users.values()).map(u => {
                const reportsAgainst = fraudReports.filter(f => String(f.againstUserId) === String(u._id) || String(f.reportedUserId) === String(u._id)).length;
                const disputesAgainst = disputes.filter(d => String(d.againstUserId?._id || d.againstUserId) === String(u._id)).length;
                return {
                    _id: u._id,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    email: u.email,
                    phone: u.phone,
                    role: u.role,
                    status: u.status || 'active',
                    isActive: u.status !== 'suspended',
                    identityStatus: u.identityStatus || (u.role === 'admin' ? 'verified' : 'unverified'),
                    verificationStatus: u.verificationStatus || u.identityStatus || (u.role === 'admin' ? 'verified' : 'unverified'),
                    emailVerified: u.emailVerified ?? true,
                    reportsAgainst,
                    disputesAgainst,
                    createdAt: u.createdAt || '2026-01-10T00:00:00.000Z'
                };
            });
            return res.status(200).json({ data: users });
        }

        const users = await User.find().select('-password').sort({ createdAt: -1 });
        const mappedUsers = users.map(u => {
            const obj = u.toObject ? u.toObject() : u;
            obj.verificationStatus = obj.verificationStatus || obj.identityStatus || (obj.role === 'admin' ? 'verified' : 'unverified');
            return obj;
        });
        res.status(200).json({ data: mappedUsers });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const { enrichDispute } = require('../disputeController');

const getAllProperties = async (req, res) => {
    try {
        if (isMockMode()) {
            const allUsers = Array.from(mockStore.users ? mockStore.users.values() : []);
            const allProfiles = mockStore.landlordProfiles ? Array.from(mockStore.landlordProfiles.values()) : [];
            const mapped = (mockStore.properties || []).map(p => {
                const lId = String(p.landlordId?._id || p.landlordId || '');
                const landlord = allUsers.find(u => String(u._id) === lId) || allProfiles.find(lp => String(lp._id) === lId);
                const landlordName = landlord ? (landlord.legalName || `${landlord.firstName || ''} ${landlord.lastName || ''}`.trim() || landlord.email) : 'HomeLink Landlord';
                return {
                    ...p,
                    city: p.location?.city || 'Addis Ababa',
                    subCity: p.location?.subCity || '',
                    neighborhood: p.location?.neighborhood || '',
                    landlordName,
                    landlordEmail: landlord?.email || '',
                    rentAmount: p.rentAmount || p.price || 0,
                    price: p.rentAmount || p.price || 0
                };
            });
            return res.status(200).json({ data: mapped });
        }

        const properties = await Property.find().populate('landlordId', 'firstName lastName email').sort({ createdAt: -1 });
        res.status(200).json({ data: properties });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllFraudReports = async (req, res) => {
    try {
        if (isMockMode()) {
            const allUsers = Array.from(mockStore.users ? mockStore.users.values() : []);
            const allProps = mockStore.properties || [];
            const mapped = (mockStore.fraudReports || []).map(f => {
                const repId = String(f.reportedBy?._id || f.reportedBy || f.reporterId || '');
                const reporter = allUsers.find(u => String(u._id) === repId) || (typeof f.reportedBy === 'object' ? f.reportedBy : null);
                const reporterObj = reporter ? {
                    _id: reporter._id || repId,
                    firstName: reporter.firstName || 'User',
                    lastName: reporter.lastName || '',
                    email: reporter.email || ''
                } : { firstName: 'Mikias', lastName: 'Bekele', email: 'mikias@example.com' };

                const propId = String(f.reportedPropertyId?._id || f.reportedPropertyId || f.propertyId || '');
                const prop = allProps.find(p => String(p._id) === propId) || (typeof f.reportedPropertyId === 'object' ? f.reportedPropertyId : null);
                const propertyObj = prop ? {
                    _id: prop._id || propId,
                    title: prop.title || 'Executive Studio in Kazanchis',
                    address: prop.location ? `${prop.location.neighborhood || ''}, ${prop.location.subCity || ''}` : 'Kazanchis'
                } : { _id: propId || 'mock-prop', title: 'Listing in Addis Ababa' };

                const cat = f.category || f.reportType || 'duplicate_listing';
                const score = f.aiRiskScore !== undefined ? (f.aiRiskScore > 1 ? f.aiRiskScore : Math.round(f.aiRiskScore * 100)) : (f.riskScore || 55);

                return {
                    ...f,
                    reportedBy: reporterObj,
                    reporterId: reporterObj,
                    reportedPropertyId: propertyObj,
                    propertyId: propertyObj,
                    category: cat,
                    reportType: cat,
                    aiRiskScore: score,
                    riskScore: score,
                    riskLevel: f.aiRiskLevel || (score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW')
                };
            });
            return res.status(200).json({ data: mapped });
        }

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
        if (isMockMode()) {
            const enriched = (mockStore.disputes || []).map(d => enrichDispute(d));
            return res.status(200).json({ data: enriched });
        }

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
            const profiles = Array.from((mockStore.landlordProfiles || new Map()).values());
            return res.status(200).json({ data: profiles });
        }

        const profiles = await LandlordProfile.find()
            .populate('accountId', 'firstName lastName email')
            .sort({ createdAt: -1 });
        res.status(200).json({ data: profiles });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAllAgreements = async (req, res) => {
    try {
        if (isMockMode()) {
            const allUsers = Array.from(mockStore.users ? mockStore.users.values() : []);
            const allProps = mockStore.properties || [];
            const mapped = (mockStore.agreements || []).map((agr) => {
                const tId = String((typeof agr.tenantId === 'object' ? agr.tenantId?._id : agr.tenantId) || '');
                const tenantUser = allUsers.find(u => String(u._id) === tId || String(u.id) === tId);
                const tenantObj = typeof agr.tenantId === 'object' ? agr.tenantId : (tenantUser ? {
                    _id: tenantUser._id,
                    firstName: tenantUser.firstName,
                    lastName: tenantUser.lastName,
                    email: tenantUser.email,
                    phone: tenantUser.phone
                } : { _id: tId, firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com" });

                const lId = String((typeof agr.landlordId === 'object' ? agr.landlordId?._id : agr.landlordId) || '');
                const landlordUser = allUsers.find(u => String(u._id) === lId || String(u.id) === lId);
                const landlordObj = typeof agr.landlordId === 'object' ? agr.landlordId : (landlordUser ? {
                    _id: landlordUser._id,
                    firstName: landlordUser.firstName,
                    lastName: landlordUser.lastName,
                    email: landlordUser.email,
                    phone: landlordUser.phone
                } : { _id: lId, firstName: "Abebe", lastName: "Kebede", email: "landlord@homelink.test" });

                const pId = String((typeof agr.propertyId === 'object' ? agr.propertyId?._id : agr.propertyId) || '');
                const prop = allProps.find(p => String(p._id) === pId || String(p.id) === pId);
                const propObj = typeof agr.propertyId === 'object' ? agr.propertyId : (prop ? {
                    _id: prop._id,
                    title: prop.title,
                    location: prop.location,
                    rentAmount: prop.rentAmount,
                    images: prop.images || []
                } : { _id: pId, title: "Modern Residence" });

                const rentAmt = Number(agr.rentAmount || agr.monthlyRentEtb || (propObj && propObj.rentAmount) || 0);
                const depositAmt = agr.depositAmount !== undefined ? Number(agr.depositAmount) : rentAmt;

                return {
                    ...agr,
                    tenantId: tenantObj,
                    landlordId: landlordObj,
                    propertyId: propObj,
                    rentAmount: rentAmt,
                    monthlyRentEtb: rentAmt,
                    depositAmount: depositAmt,
                    terms: (Array.isArray(agr.terms) && agr.terms.length > 0) ? agr.terms : (STANDARD_RENTAL_TERMS || []),
                };
            }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            return res.status(200).json({ data: mapped });
        }

        const agreements = await RentalAgreement.find()
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .populate('applicationId')
            .sort({ createdAt: -1 });

        res.status(200).json({ data: agreements });
    } catch (error) {
        console.error("getAllAgreements error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getAllApplications = async (req, res) => {
    try {
        if (isMockMode()) {
            const allUsers = Array.from(mockStore.users ? mockStore.users.values() : []);
            const allProps = mockStore.properties || [];
            const mapped = (mockStore.applications || []).map((app) => {
                const tId = String((typeof app.tenantId === 'object' ? app.tenantId?._id : app.tenantId) || '');
                const tenantUser = allUsers.find(u => String(u._id) === tId || String(u.id) === tId);
                const tenantObj = typeof app.tenantId === 'object' ? app.tenantId : (tenantUser ? {
                    _id: tenantUser._id,
                    firstName: tenantUser.firstName,
                    lastName: tenantUser.lastName,
                    email: tenantUser.email,
                    phone: tenantUser.phone
                } : { firstName: app.fullName || "Applicant", email: app.email, phone: app.phone });

                const lId = String((typeof app.landlordId === 'object' ? app.landlordId?._id : app.landlordId) || '');
                const landlordUser = allUsers.find(u => String(u._id) === lId || String(u.id) === lId);
                const landlordObj = typeof app.landlordId === 'object' ? app.landlordId : (landlordUser ? {
                    _id: landlordUser._id,
                    firstName: landlordUser.firstName,
                    lastName: landlordUser.lastName,
                    email: landlordUser.email
                } : { firstName: "Landlord" });

                const pId = String((typeof app.propertyId === 'object' ? app.propertyId?._id : app.propertyId) || '');
                const prop = allProps.find(p => String(p._id) === pId || String(p.id) === pId);
                const propObj = typeof app.propertyId === 'object' ? app.propertyId : (prop ? {
                    _id: prop._id,
                    title: prop.title,
                    location: prop.location,
                    rentAmount: prop.rentAmount
                } : { title: "Rental Property" });

                return {
                    ...app,
                    tenantId: tenantObj,
                    landlordId: landlordObj,
                    propertyId: propObj,
                };
            }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            return res.status(200).json({ data: mapped });
        }

        const applications = await Application.find()
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        res.status(200).json({ data: applications });
    } catch (error) {
        console.error("getAllApplications error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getAllMaintenance = async (req, res) => {
    try {
        if (isMockMode()) {
            const allUsers = Array.from(mockStore.users ? mockStore.users.values() : []);
            const allProps = mockStore.properties || [];
            const tickets = mockStore.maintenanceRequests || mockStore.maintenance || [];
            const mapped = tickets.map((m) => {
                const tId = String((typeof m.tenantId === 'object' ? m.tenantId?._id : m.tenantId) || '');
                const tenantUser = allUsers.find(u => String(u._id) === tId || String(u.id) === tId);
                const tenantObj = typeof m.tenantId === 'object' ? m.tenantId : (tenantUser ? {
                    _id: tenantUser._id,
                    firstName: tenantUser.firstName,
                    lastName: tenantUser.lastName,
                    email: tenantUser.email,
                    phone: tenantUser.phone
                } : { firstName: "Tenant", email: "tenant@example.com" });

                const lId = String((typeof m.landlordId === 'object' ? m.landlordId?._id : m.landlordId) || '');
                const landlordUser = allUsers.find(u => String(u._id) === lId || String(u.id) === lId);
                const landlordObj = typeof m.landlordId === 'object' ? m.landlordId : (landlordUser ? {
                    _id: landlordUser._id,
                    firstName: landlordUser.firstName,
                    lastName: landlordUser.lastName,
                    email: landlordUser.email
                } : { firstName: "Landlord" });

                const pId = String((typeof m.propertyId === 'object' ? m.propertyId?._id : m.propertyId) || '');
                const prop = allProps.find(p => String(p._id) === pId || String(p.id) === pId);
                const propObj = typeof m.propertyId === 'object' ? m.propertyId : (prop ? {
                    _id: prop._id,
                    title: prop.title,
                    location: prop.location
                } : { title: "Property" });

                return {
                    ...m,
                    tenantId: tenantObj,
                    landlordId: landlordObj,
                    propertyId: propObj,
                };
            }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            return res.status(200).json({ data: mapped });
        }

        const requests = await MaintenanceRequest.find()
            .populate('propertyId', 'title location')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        res.status(200).json({ data: requests });
    } catch (error) {
        console.error("getAllMaintenance error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getDashboardOverview,
    resolveDispute,
    verifyLandlord,
    suspendAccount,
    moderateProperty,
    getAllUsers,
    getAllProperties,
    getAllFraudReports,
    getAllDisputes,
    getAllVerifications,
    getAllAgreements,
    getAllApplications,
    getAllMaintenance
};
