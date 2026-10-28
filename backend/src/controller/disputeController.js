const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const RentalAgreement = require('../models/RentalAgreement');
const User = require('../models/User');
const { isMockMode, mockStore, persistMockData, mockCreateNotification } = require('../config/db');

/**
 * Enriches a dispute object with user names, property title, and formatted thread
 */
function enrichDispute(d) {
    if (!d) return d;
    const disp = { ...d };

    // Find users from mock store if available
    const allUsers = [...(mockStore.users ? mockStore.users.values() : [])];

    // Enrich againstUserId
    const againstId = disp.againstUserId?._id || disp.againstUserId;
    if (againstId) {
        const u = allUsers.find(x => String(x._id) === String(againstId));
        disp.againstUserId = {
            _id: againstId,
            firstName: u?.firstName || 'Host',
            lastName: u?.lastName || '',
            email: u?.email || '',
            role: u?.role || 'landlord'
        };
    }

    // Enrich raisedBy / filedBy
    const raisedId = disp.raisedBy?._id || disp.raisedBy;
    if (raisedId) {
        const u = allUsers.find(x => String(x._id) === String(raisedId));
        disp.raisedBy = {
            _id: raisedId,
            firstName: u?.firstName || 'User',
            lastName: u?.lastName || '',
            email: u?.email || '',
            role: u?.role || 'tenant'
        };
        disp.filedBy = disp.raisedBy;
        disp.filedByRole = u?.role || disp.filedByRole || 'tenant';
    }

    // Enrich propertyId
    const propId = disp.propertyId?._id || disp.propertyId;
    if (propId) {
        const p = (mockStore.properties || []).find(x => String(x._id) === String(propId));
        disp.propertyId = {
            _id: propId,
            title: p?.title || 'Residential Property',
            location: p?.location || { city: 'Addis Ababa' }
        };
    }

    // Aliases for frontend compatibility
    disp.reason = disp.reason || disp.category;
    disp.category = disp.category || disp.reason;

    // Standardize thread / communications
    disp.thread = disp.thread || (disp.communications || []).map(c => {
        const senderId = c.fromUserId?._id || c.fromUserId;
        const sender = allUsers.find(x => String(x._id) === String(senderId));
        return {
            from: sender?.role || 'user',
            fromName: sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'User',
            text: c.message || c.text || '',
            at: c.timestamp || c.at || new Date().toISOString()
        };
    });

    return disp;
}

const createDispute = async (req, res) => {
    try {
        const raisedBy = String(req.user.id || req.user.userId || '');
        let { againstUserId, agreementId, propertyId, category, reason, description, details } = req.body;

        // Auto-normalize category / reason
        category = (category || reason || 'other').trim();

        // Auto-normalize description
        description = (description || details || '').trim();

        const evidenceKeys = req.files ? req.files.map(file => file.path) : [];

        // Auto-resolve from agreement if provided
        let agreement = null;
        if (agreementId) {
            if (isMockMode()) {
                agreement = (mockStore.agreements || []).find(a => String(a._id) === String(agreementId));
            } else {
                try {
                    agreement = await RentalAgreement.findById(agreementId);
                } catch (e) {}
            }
        }

        if (agreement) {
            const tenantId = String(agreement.tenantId?._id || agreement.tenantId || '');
            const landlordId = String(agreement.landlordId?._id || agreement.landlordId || '');

            if (!againstUserId) {
                if (raisedBy === tenantId) {
                    againstUserId = landlordId;
                } else {
                    againstUserId = tenantId;
                }
            }
            if (!propertyId) {
                propertyId = String(agreement.propertyId?._id || agreement.propertyId || '');
            }
        }

        // If againstUserId is still missing, infer from any agreement involving this user
        if (!againstUserId && isMockMode()) {
            const userAgr = (mockStore.agreements || []).find(a => {
                const tId = String(a.tenantId?._id || a.tenantId || '');
                const lId = String(a.landlordId?._id || a.landlordId || '');
                return tId === raisedBy || lId === raisedBy;
            });
            if (userAgr) {
                const tId = String(userAgr.tenantId?._id || userAgr.tenantId || '');
                const lId = String(userAgr.landlordId?._id || userAgr.landlordId || '');
                againstUserId = raisedBy === tId ? lId : tId;
                agreementId = agreementId || userAgr._id;
                propertyId = propertyId || String(userAgr.propertyId?._id || userAgr.propertyId || '');
            } else {
                // Fallback: Pick another user with complementary role
                const allUsers = [...(mockStore.users ? mockStore.users.values() : [])];
                const counterpart = allUsers.find(u => String(u._id) !== raisedBy && (req.user.role === 'tenant' ? u.role === 'landlord' : u.role === 'tenant'));
                if (counterpart) {
                    againstUserId = String(counterpart._id);
                }
            }
        }

        // Validate basic requirements
        if (!againstUserId) {
            return res.status(400).json({ message: "Please select an agreement or counterpart to file a dispute against." });
        }
        if (!description) {
            return res.status(400).json({ message: "Please describe what happened." });
        }

        // Create the dispute
        let dispute = null;
        if (isMockMode()) {
            mockStore.disputes = mockStore.disputes || [];
            dispute = {
                _id: "mock-dispute-" + Date.now(),
                raisedBy,
                filedByRole: req.user.role || 'tenant',
                againstUserId,
                agreementId: agreementId || null,
                propertyId: propertyId || null,
                category,
                reason: category,
                description,
                evidenceKeys,
                communications: [],
                thread: [],
                history: [{
                    status: 'open',
                    note: 'Dispute opened by user.',
                    at: new Date().toISOString()
                }],
                createdAt: new Date().toISOString(),
                status: 'open'
            };
            mockStore.disputes.unshift(dispute);
            if (typeof persistMockData === 'function') persistMockData();

            mockCreateNotification(
                againstUserId,
                'system',
                'New Dispute Filed',
                `A dispute regarding '${category.replace(/_/g, ' ')}' has been submitted and is under mediation review.`
            );

            return res.status(201).json({
                message: "Dispute submitted successfully.",
                data: enrichDispute(dispute)
            });
        }

        // Real MongoDB mode
        try {
            dispute = await Dispute.create({
                raisedBy,
                againstUserId,
                agreementId: agreementId || undefined,
                propertyId: propertyId || undefined,
                category,
                description,
                evidenceKeys,
                history: [{
                    status: 'open',
                    note: 'Dispute opened by user.'
                }]
            });

            await Notification.create({
                userId: againstUserId,
                title: "New Dispute Filed Against You",
                message: `A dispute regarding '${category.replace(/_/g, ' ')}' has been filed against you. Please review and respond in the Resolution Center.`,
                type: "system",
                metadata: { disputeId: dispute._id }
            });

            res.status(201).json({
                message: "Dispute submitted successfully.",
                data: dispute
            });
        } catch (dbErr) {
            console.error("DB Create dispute error:", dbErr);
            res.status(500).json({ message: "Server error", error: dbErr.message });
        }

    } catch (error) {
        console.error("Create dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getMyDisputes = async (req, res) => {
    try {
        const userId = String(req.user.id || req.user.userId || '');

        if (isMockMode()) {
            mockStore.disputes = mockStore.disputes || [];
            const disputes = mockStore.disputes
                .filter(d => {
                    const rId = String(d.raisedBy?._id || d.raisedBy || '');
                    const aId = String(d.againstUserId?._id || d.againstUserId || '');
                    return rId === userId || aId === userId;
                })
                .map(enrichDispute);

            return res.status(200).json({ data: disputes });
        }

        // Find disputes where user is either the creator or the defendant
        const disputes = await Dispute.find({
            $or: [{ raisedBy: userId }, { againstUserId: userId }]
        })
        .populate('raisedBy', 'firstName lastName email role')
        .populate('againstUserId', 'firstName lastName email role')
        .populate('propertyId', 'title location')
        .sort({ createdAt: -1 });

        const mapped = disputes.map(d => ({
            ...d.toObject(),
            reason: d.category,
            filedByRole: d.raisedBy?.role || 'user'
        }));

        res.status(200).json({ data: mapped });

    } catch (error) {
        console.error("Get my disputes error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getDisputeById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = String(req.user.id || req.user.userId || '');
        const userRole = req.user.role;

        if (isMockMode()) {
            mockStore.disputes = mockStore.disputes || [];
            const dispute = mockStore.disputes.find(d => String(d._id) === String(id));
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });
            return res.status(200).json({ data: enrichDispute(dispute) });
        }

        const dispute = await Dispute.findById(id)
            .populate('raisedBy', 'firstName lastName email role')
            .populate('againstUserId', 'firstName lastName email role')
            .populate('handledBy', 'firstName lastName email')
            .populate('communications.fromUserId', 'firstName lastName role');

        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }

        // Authorization: Only parties involved or an admin can view
        const rId = String(dispute.raisedBy?._id || dispute.raisedBy || '');
        const aId = String(dispute.againstUserId?._id || dispute.againstUserId || '');

        if (rId !== userId && aId !== userId && userRole !== 'admin') {
            return res.status(403).json({ message: "You are not authorized to view this dispute." });
        }

        // Strip internal admin notes if the requester is not an admin
        if (userRole !== 'admin') {
            dispute.communications = dispute.communications.filter(msg => !msg.isAdminNote);
        }

        const obj = dispute.toObject();
        obj.reason = obj.category;
        obj.filedByRole = obj.raisedBy?.role || 'user';

        res.status(200).json({ data: obj });

    } catch (error) {
        console.error("Get dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const addDisputeMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = String(req.user.id || req.user.userId || '');
        const userRole = req.user.role;
        const message = req.body.message || req.body.text || "";
        const { isAdminNote } = req.body;

        const attachments = req.files ? req.files.map(file => file.path) : [];

        if (!message && attachments.length === 0) {
            return res.status(400).json({ message: "Message or attachments are required." });
        }

        if (isMockMode()) {
            mockStore.disputes = mockStore.disputes || [];
            const dispute = mockStore.disputes.find(d => String(d._id) === String(id));
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });

            if (!dispute.communications) dispute.communications = [];
            const newMessage = {
                fromUserId: userId,
                message: message || "",
                attachments,
                isAdminNote: Boolean(isAdminNote),
                timestamp: new Date().toISOString()
            };
            dispute.communications.push(newMessage);

            const senderUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === userId);
            const threadItem = {
                from: senderUser?.role || userRole || 'user',
                fromName: senderUser ? `${senderUser.firstName || ''} ${senderUser.lastName || ''}`.trim() : 'User',
                text: message || "",
                at: new Date().toISOString()
            };
            dispute.thread = dispute.thread || [];
            dispute.thread.push(threadItem);

            dispute.updatedAt = new Date().toISOString();
            if (typeof persistMockData === 'function') persistMockData();

            const recipientId = (String(dispute.raisedBy) === userId) ? dispute.againstUserId : dispute.raisedBy;
            mockCreateNotification(recipientId, 'system', 'New Message in Dispute', `New reply: "${message.slice(0, 60)}..."`);

            return res.status(200).json({ message: "Message added", data: newMessage });
        }

        const dispute = await Dispute.findById(id);
        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }

        const rId = String(dispute.raisedBy);
        const aId = String(dispute.againstUserId);
        const isParticipant = (rId === userId) || (aId === userId);
        const isAdmin = (userRole === 'admin');

        if (!isParticipant && !isAdmin) {
            return res.status(403).json({ message: "Not authorized to reply to this dispute." });
        }

        const isInternal = isAdmin ? Boolean(isAdminNote) : false;

        const newMessage = {
            fromUserId: userId,
            message: message || "",
            attachments,
            isAdminNote: isInternal,
            timestamp: new Date()
        };

        dispute.communications.push(newMessage);
        dispute.updatedAt = new Date();
        await dispute.save();

        if (!isInternal) {
            const recipientId = (rId === userId) ? dispute.againstUserId : dispute.raisedBy;
            await Notification.create({
                userId: recipientId,
                title: "New Message in Dispute",
                message: "A new message has been posted in your active dispute.",
                type: "system",
                metadata: { disputeId: dispute._id }
            });
        }

        res.status(201).json({
            message: "Message added to dispute.",
            data: newMessage
        });

    } catch (error) {
        console.error("Add dispute message error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const withdrawDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = String(req.user.id || req.user.userId || '');

        if (isMockMode()) {
            mockStore.disputes = mockStore.disputes || [];
            const dispute = mockStore.disputes.find(d => String(d._id) === String(id));
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });

            dispute.status = 'withdrawn';
            dispute.history = dispute.history || [];
            dispute.history.push({
                status: 'withdrawn',
                note: 'Dispute withdrawn by filer.',
                at: new Date().toISOString()
            });
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Dispute withdrawn successfully", data: dispute });
        }

        const dispute = await Dispute.findById(id);
        if (!dispute) return res.status(404).json({ message: "Dispute not found" });

        if (String(dispute.raisedBy) !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Not authorized to withdraw this dispute." });
        }

        dispute.status = 'withdrawn';
        dispute.history.push({
            status: 'withdrawn',
            note: 'Dispute withdrawn by filer.',
            changedBy: userId,
            changedAt: new Date()
        });
        await dispute.save();

        res.status(200).json({ message: "Dispute withdrawn successfully", data: dispute });
    } catch (error) {
        console.error("Withdraw dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage,
    withdrawDispute
};
