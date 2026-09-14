const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const RentalAgreement = require('../models/RentalAgreement');
const User = require('../models/User');

const createDispute = async (req, res) => {
    try {
        const raisedBy = req.user.id;
        const { againstUserId, agreementId, propertyId, category, description } = req.body;

        const evidenceKeys = req.files ? req.files.map(file => file.path) : [];

        // Validate basic requirements
        if (!againstUserId || !category || !description) {
            return res.status(400).json({ message: "againstUserId, category, and description are required." });
        }

        // Create the dispute
        const dispute = await Dispute.create({
            raisedBy,
            againstUserId,
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
            userId: againstUserId,
            title: "New Dispute Filed Against You",
            message: `A dispute regarding '${category}' has been filed against you. Please review and respond in the Resolution Center.`,
            type: "system",
            metadata: { disputeId: dispute._id }
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
        const { message, isAdminNote } = req.body;

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

module.exports = {
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage
};
