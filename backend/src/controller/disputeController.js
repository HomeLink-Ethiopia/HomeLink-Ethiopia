const Dispute = require('../models/Dispute');
const { isMockMode, mockStore, pushMockAudit } = require('../config/db');
const Notification = require('../models/Notification');
const RentalAgreement = require('../models/RentalAgreement');
const User = require('../models/User');

const createDispute = async (req, res) => {
    try {
        // Mock DB: persist the dispute so it appears in My Disputes.
        if (isMockMode()) {
            const body = req.body || {};
            const category = body.category || body.reason || "other";
            const description = (body.description || "").trim();
            if (!description) return res.status(400).json({ message: "description is required." });
            const agreementId = body.agreementId || null;
            const agreement = agreementId ? (mockStore.agreements || []).find((a) => a._id === agreementId) : null;
            if (agreementId && !agreement) return res.status(404).json({ message: "Rental agreement not found." });

            // Related property: from the agreement, else from the body.
            const propFromAgreement = agreement ? agreement.propertyId : null;
            const propFromBody = body.propertyId ? (mockStore.properties || []).find((pr) => pr._id === body.propertyId) : null;
            const propertyId = propFromAgreement
                ? { _id: propFromAgreement._id || propFromAgreement, title: propFromAgreement.title || "Property" }
                : propFromBody
                    ? { _id: propFromBody._id, title: propFromBody.title }
                    : body.propertyId
                        ? { _id: body.propertyId, title: "Property" }
                        : null;

            // Counterparty: the other side of the agreement, else the filer's most
            // recent agreement, else explicit againstUserId (mirrors the real path).
            const idOf = (v) => String((v && v._id) || v || "");
            let againstId = body.againstUserId || null;
            if (!againstId && agreement) {
                const t = idOf(agreement.tenantId);
                againstId = t === String(req.user.id) ? idOf(agreement.landlordId) : t;
            }
            if (!againstId) {
                const mine = (mockStore.agreements || []).filter((a) => idOf(a.tenantId) === String(req.user.id) || idOf(a.landlordId) === String(req.user.id));
                const latest = mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                if (latest) {
                    const t = idOf(latest.tenantId);
                    againstId = t === String(req.user.id) ? idOf(latest.landlordId) : t;
                }
            }
            let againstUser = null;
            if (againstId) {
                const found = Array.from(mockStore.users.values()).find((u) => u._id === againstId);
                againstUser = found
                    ? { _id: found._id, firstName: found.firstName, lastName: found.lastName, email: found.email, role: found.role }
                    : { _id: againstId, firstName: "User", lastName: "", email: "", role: idOf(againstId) === "mock-landlord-1" ? "landlord" : "tenant" };
            }

            const evidenceKeys = req.files ? req.files.map((f) => f.path) : [];
            const evidenceNames = req.files ? req.files.map((f) => f.originalname) : [];
            const now = new Date().toISOString();
            const dispute = {
                _id: "mock-dispute-" + Date.now(),
                raisedBy: { _id: req.user.id, firstName: req.user.firstName || "User", lastName: req.user.lastName || "", email: req.user.email || "", role: req.user.role },
                againstUserId: againstUser,
                agreementId,
                propertyId,
                category,
                reason: category,
                description,
                evidenceKeys,
                evidence: evidenceNames,
                status: "open",
                filedByRole: req.user.role,
                communications: [],
                thread: [],
                history: [{ status: "open", note: "Dispute opened by user.", at: now }],
                createdAt: now,
            };
            mockStore.disputes.push(dispute);
            return res.status(201).json({ message: "Dispute filed", data: shapeDisputeForFrontend(dispute) });
        }


        const raisedBy = req.user.id;
        // Frontend sends { reason, agreementId, description } — accept `reason`
        // as the category alias. `againstUserId` is derived from the agreement
        // (the counterparty) when not explicitly provided.
        const { againstUserId, agreementId, propertyId } = req.body;
        const category = req.body.category || req.body.reason;
        const description = req.body.description;

        const evidenceKeys = req.files ? req.files.map(file => file.path) : [];

        // Validate basic requirements
        if (!category || !description) {
            return res.status(400).json({ message: "category (or reason) and description are required." });
        }

        // Resolve the counterparty from the agreement when againstUserId is missing.
        // No agreement chosen? Fall back to the filer's most recent active
        // agreement — the dispute is about a rental, so the counterparty is
        // whoever is on the other side of it.
        let resolvedAgainst = againstUserId;
        if (!resolvedAgainst && agreementId) {
            const agreement = await RentalAgreement.findById(agreementId).select('tenantId landlordId');
            if (agreement) {
                resolvedAgainst =
                    String(agreement.tenantId) === String(raisedBy)
                        ? agreement.landlordId
                        : agreement.tenantId;
            }
        }
        if (!resolvedAgainst) {
            const role = req.user.role;
            const filter = role === 'landlord' ? { landlordId: raisedBy } : { tenantId: raisedBy };
            const latest = await RentalAgreement.findOne(filter)
                .sort({ createdAt: -1 })
                .select('tenantId landlordId');
            if (latest) {
                resolvedAgainst =
                    String(latest.tenantId) === String(raisedBy)
                        ? latest.landlordId
                        : latest.tenantId;
            }
        }
        if (!resolvedAgainst) {
            return res.status(400).json({ message: "We couldn't determine who this dispute is against. Select the related agreement (you need at least one rental agreement first)." });
        }

        // Create the dispute
        const dispute = await Dispute.create({
            raisedBy,
            againstUserId: resolvedAgainst,
            agreementId,
            propertyId,
            category,
            description,
            evidenceKeys,
            history: [{
                status: 'open',
                note: 'Dispute opened by user.'
            }]
        });

        // Notify the user being disputed
        await Notification.create({
            userId: resolvedAgainst,
            title: "New Dispute Filed Against You",
            body: `A dispute regarding '${category}' has been filed against you. Please review and respond in the Resolution Center.`,
            type: "system",
            relatedEntity: { entityType: "Dispute", entityId: dispute._id },
            channels: ['in_app']
        });

        res.status(201).json({
            message: "Dispute submitted successfully.",
            data: dispute
        });

    } catch (error) {
        console.error("Create dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getMyDisputes = async (req, res) => {
    try {
        if (isMockMode()) {
            const idOf = (v) => String((v && v._id) || v || "");
            const mine = (mockStore.disputes || [])
                .filter((d) => idOf(d.raisedBy) === String(req.user.id) || idOf(d.againstUserId) === String(req.user.id))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(shapeDisputeForFrontend);
            return res.status(200).json({ data: mine });
        }
        const userId = req.user.id;

        // Find disputes where user is either the creator or the defendant
        const disputes = await Dispute.find({
            $or: [{ raisedBy: userId }, { againstUserId: userId }]
        })
        .populate('raisedBy', 'firstName lastName email')
        .populate('againstUserId', 'firstName lastName email')
        .populate('propertyId', 'title')
        .sort({ createdAt: -1 });

        res.status(200).json({ data: disputes });

    } catch (error) {
        console.error("Get my disputes error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getDisputeById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role; // Assuming role is set by authMiddleware

        const dispute = await Dispute.findById(id)
            .populate('raisedBy', 'firstName lastName email')
            .populate('againstUserId', 'firstName lastName email')
            .populate('handledBy', 'firstName lastName email')
            .populate('communications.fromUserId', 'firstName lastName role');

        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }

        // Authorization: Only parties involved or an admin can view
        if (
            dispute.raisedBy._id.toString() !== userId && 
            dispute.againstUserId._id.toString() !== userId && 
            userRole !== 'admin'
        ) {
            return res.status(403).json({ message: "You are not authorized to view this dispute." });
        }

        // Strip internal admin notes if the requester is not an admin
        if (userRole !== 'admin') {
            dispute.communications = dispute.communications.filter(msg => !msg.isAdminNote);
        }

        res.status(200).json({ data: dispute });

    } catch (error) {
        console.error("Get dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const addDisputeMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Mock DB: append to the in-memory thread; an admin message on an open
        // dispute moves it to under_review (investigation) and is audit-logged.
        if (isMockMode()) {
            const dispute = (mockStore.disputes || []).find((d) => d._id === id);
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });
            const idOf = (v) => String((v && v._id) || v || "");
            const isParticipant = idOf(dispute.raisedBy) === String(userId) || idOf(dispute.againstUserId) === String(userId);
            const isAdmin = userRole === "admin";
            if (!isParticipant && !isAdmin) return res.status(403).json({ message: "Not authorized to reply to this dispute." });
            const text = ((req.body && (req.body.message || req.body.text)) || "").trim();
            const attachments = req.files ? req.files.map((f) => f.path) : [];
            if (!text && attachments.length === 0) return res.status(400).json({ message: "Message or attachments are required." });
            const msg = {
                fromUserId: userId,
                fromRole: userRole,
                fromName: (req.user.firstName || "") + " " + (req.user.lastName || ""),
                message: text,
                attachments,
                isAdminNote: isAdmin ? Boolean(req.body && req.body.isAdminNote) : false,
                timestamp: new Date().toISOString(),
            };
            dispute.communications.push(msg);
            if (isAdmin && dispute.status === "open") {
                dispute.status = "under_review";
                dispute.history.push({ status: "under_review", changedBy: userId, note: "Admin started investigation.", at: new Date().toISOString() });
                pushMockAudit(req, "dispute.investigate", "dispute", (dispute.reason || dispute.category || "dispute") + " — " + String(dispute.description || "").slice(0, 48), "open", "under_review", "");
            }
            return res.status(201).json({ message: "Message added", data: msg });
        }

        const attachments = req.files ? req.files.map(file => file.path) : [];

        if (!message && attachments.length === 0) {
            return res.status(400).json({ message: "Message or attachments are required." });
        }

        const dispute = await Dispute.findById(id);
        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }

        // Verify participant
        const isParticipant = (dispute.raisedBy.toString() === userId) || (dispute.againstUserId.toString() === userId);
        const isAdmin = (userRole === 'admin');

        if (!isParticipant && !isAdmin) {
            return res.status(403).json({ message: "Not authorized to reply to this dispute." });
        }

        // Only admins can post internal notes
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

        // Notify the other party (only if it's not an internal admin note)
        if (!isInternal) {
            const recipientId = (dispute.raisedBy.toString() === userId) ? dispute.againstUserId : dispute.raisedBy;
            
            // Only notify if the sender is a participant (or if admin is sending a public message)
            if (isParticipant || isAdmin) {
                await Notification.create({
                    userId: recipientId,
                    title: "New Message in Dispute",
                    message: "A new message has been posted in your active dispute.",
                    type: "system",
                    metadata: { disputeId: dispute._id }
                });
            }
            
            // If sender is a participant, also notify admin if one is assigned
            if (isParticipant && dispute.handledBy) {
                 await Notification.create({
                    userId: dispute.handledBy,
                    title: "Dispute Update",
                    message: "A user replied to a dispute you are handling.",
                    type: "system",
                    metadata: { disputeId: dispute._id }
                });
            }
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

// ─── Sprint 11: shaping + admin moderation ──────────────────────────────────
const shapeDisputeForFrontend = (d) => {
    const idOf = (v) => String((v && v._id) || v || "");
    return {
        ...d,
        reason: d.reason || d.category,
        filedByRole: d.filedByRole || (d.raisedBy && d.raisedBy.role) || "tenant",
        filedBy: d.raisedBy || null,
        againstUserId: d.againstUserId || null,
        resolution: d.outcome || d.resolution || "",
        evidence: d.evidence || [],
        thread: (d.communications || []).map((c) => ({
            from: c.fromRole || (c.isAdminNote ? "admin" : "user"),
            fromName: c.fromName || "",
            text: c.message,
            at: c.timestamp || c.at,
        })),
        history: (d.history || []).map((h) => ({ status: h.status, note: h.note, at: h.at || h.changedAt })),
    };
};

// Admin list — every dispute, newest first.
const listAllDisputes = async (req, res) => {
    try {
        if (isMockMode()) {
            const all = [...(mockStore.disputes || [])]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(shapeDisputeForFrontend);
            return res.status(200).json({ data: all });
        }
        const disputes = await Dispute.find()
            .populate('raisedBy againstUserId handledBy', 'firstName lastName email role')
            .populate('propertyId', 'title')
            .sort({ createdAt: -1 });
        res.status(200).json({ data: disputes });
    } catch (error) {
        console.error("List all disputes error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Filer withdraws their own dispute while it is still open.
const withdrawDispute = async (req, res) => {
    try {
        if (isMockMode()) {
            const dispute = (mockStore.disputes || []).find((d) => d._id === req.params.id);
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });
            const idOf = (v) => String((v && v._id) || v || "");
            if (idOf(dispute.raisedBy) !== String(req.user.id) && req.user.role !== "admin") {
                return res.status(403).json({ message: "Only the filer can withdraw a dispute." });
            }
            if (!["open", "under_review"].includes(dispute.status)) {
                return res.status(400).json({ message: "This dispute has already been decided." });
            }
            const before = dispute.status;
            dispute.status = "withdrawn";
            dispute.history.push({ status: "withdrawn", changedBy: req.user.id, note: "Withdrawn by filer.", at: new Date().toISOString() });
            return res.status(200).json({ message: "Dispute withdrawn", data: shapeDisputeForFrontend(dispute) });
        }
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ message: "Dispute not found" });
        if (String(dispute.raisedBy) !== String(req.user.id) && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only the filer can withdraw a dispute." });
        }
        if (!["open", "under_review"].includes(dispute.status)) {
            return res.status(400).json({ message: "This dispute has already been decided." });
        }
        dispute.status = "closed";
        dispute.history.push({ status: "closed", changedBy: req.user.id, note: "Withdrawn by filer." });
        await dispute.save();
        res.status(200).json({ message: "Dispute withdrawn", data: dispute });
    } catch (error) {
        console.error("Withdraw dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Admin moderation: investigate | request_evidence | resolve | reject.
// Every decision is audit-logged with who/what/when/why.
const reviewDispute = async (req, res) => {
    try {
        const { decision, resolution, note } = req.body || {};
        const allowed = ["resolve", "reject", "investigate", "request_evidence"];
        if (!allowed.includes(decision)) {
            return res.status(400).json({ message: "decision must be one of: " + allowed.join(", ") });
        }
        if (isMockMode()) {
            const dispute = (mockStore.disputes || []).find((d) => d._id === req.params.id);
            if (!dispute) return res.status(404).json({ message: "Dispute not found" });
            const needsNote = decision === "resolve" || decision === "reject";
            if (needsNote && !(resolution || "").trim()) {
                return res.status(400).json({ message: "A written decision reason is required — both parties will see it." });
            }
            const before = dispute.status;
            const now = new Date().toISOString();
            if (decision === "resolve") {
                dispute.status = "resolved";
                dispute.outcome = resolution.trim();
                dispute.resolvedAt = now;
                dispute.handledBy = req.user.id;
            } else if (decision === "reject") {
                dispute.status = "rejected";
                dispute.outcome = resolution.trim();
                dispute.resolvedAt = now;
                dispute.handledBy = req.user.id;
            } else if (decision === "investigate") {
                dispute.status = "under_review";
                dispute.handledBy = req.user.id;
            } else {
                dispute.status = "under_review";
                dispute.handledBy = req.user.id;
                dispute.communications.push({
                    fromUserId: req.user.id,
                    fromRole: "admin",
                    fromName: req.user.firstName || "Admin",
                    message: "Evidence requested: " + (resolution || note || "Please attach receipts, photos, or contracts that support your position."),
                    isAdminNote: false,
                    timestamp: now,
                });
            }
            dispute.history.push({ status: dispute.status, changedBy: req.user.id, note: (resolution || note || decision), at: now });
            pushMockAudit(req, "dispute." + decision, "dispute", (dispute.reason || dispute.category || "dispute") + " — " + String(dispute.description || "").slice(0, 48), before, dispute.status, resolution || note || "");
            return res.status(200).json({ message: "Dispute updated", data: shapeDisputeForFrontend(dispute) });
        }
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ message: "Dispute not found" });
        const before = { status: dispute.status, outcome: dispute.outcome };
        const needsNote = decision === "resolve" || decision === "reject";
        if (needsNote && !(resolution || "").trim()) {
            return res.status(400).json({ message: "A written decision reason is required — both parties will see it." });
        }
        if (decision === "resolve") {
            dispute.status = "resolved";
            dispute.outcome = resolution.trim();
        } else if (decision === "reject") {
            dispute.status = "closed";
            dispute.outcome = "Rejected: " + resolution.trim();
        } else {
            dispute.status = "under_review";
            if (decision === "request_evidence") {
                dispute.communications.push({
                    fromUserId: req.user.id,
                    message: "Evidence requested: " + (resolution || note || "Please attach supporting documents."),
                    isAdminNote: false,
                    timestamp: new Date(),
                });
            }
        }
        dispute.resolvedAt = ["resolved", "closed"].includes(dispute.status) ? new Date() : dispute.resolvedAt;
        dispute.handledBy = req.user.id;
        dispute.history.push({ status: dispute.status, changedBy: req.user.id, note: resolution || note || decision });
        await dispute.save();
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            performedBy: req.user.id,
            action: "dispute." + decision,
            targetEntity: { entityType: "Dispute", entityId: dispute._id },
            ipAddress: req.ip,
            before,
            after: { status: dispute.status, outcome: dispute.outcome },
            metadata: { reason: resolution || note || "", targetLabel: dispute.category },
        }).catch(() => {});
        return res.status(200).json({ message: "Dispute updated", data: dispute });
    } catch (error) {
        console.error("Review dispute error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage,
    withdrawDispute,
    reviewDispute,
    listAllDisputes
};
