const MaintenanceRequest = require('../models/MaintenanceRequest');
const RentalAgreement = require('../models/RentalAgreement');
const Property = require('../models/Property');
const Notification = require('../models/Notification');

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        await Notification.create({
            userId, type, title, body,
            relatedEntity: { entityType, entityId },
            channels: ['in_app']
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const createTicket = async (req, res) => {
    try {
        const tenantId = req.user.id;
        const { propertyId, agreementId, title, description, category, priority } = req.body;
        
        // Use Kidist's standard upload logic for multiple images
        const mediaKeys = req.files ? req.files.map(file => file.path) : [];

        const property = await Property.findById(propertyId);
        if (!property) return res.status(404).json({ message: "Property not found" });

        // Landlord ID comes directly from the property object. 
        // Need to trace back to User ID (accountId in LandlordProfile), 
        // but since we know Kidist's property stores the LandlordProfile _id, 
        // we can populate it, or rely on a helper. Assuming property.landlordId is the LandlordProfile _id.
        // Wait, earlier I used `LandlordProfile.findById` to get the accountId.
        const LandlordProfile = require('../models/LandlordProfile');
        const landlordProfile = await LandlordProfile.findById(property.landlordId);
        if (!landlordProfile) return res.status(404).json({ message: "Landlord profile not found" });

        const ticket = await MaintenanceRequest.create({
            agreementId,
            propertyId,
            tenantId,
            landlordId: landlordProfile.accountId,
            title,
            description,
            category,
            priority,
            mediaKeys,
            updates: [{
                status: 'submitted',
                note: 'Ticket created',
                updatedBy: tenantId
            }]
        });

        // Notify landlord
        await createNotification(
            landlordProfile.accountId, 'maintenance_update', 'New Maintenance Request',
            `Tenant has submitted a new maintenance request: ${title}`,
            'MaintenanceRequest', ticket._id
        );

        res.status(201).json({ message: "Maintenance request submitted", ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { status, assignedTo, scheduledDate, resolutionNote } = req.body;

        const ticket = await MaintenanceRequest.findOne({ _id: id, landlordId: userId }).populate('propertyId', 'title');
        if (!ticket) return res.status(404).json({ message: "Ticket not found or unauthorized" });

        ticket.status = status;
        if (assignedTo) ticket.assignedTo = assignedTo;
        if (scheduledDate) ticket.scheduledDate = scheduledDate;
        
        if (status === 'resolved') {
            ticket.resolvedAt = new Date();
            if (resolutionNote) ticket.resolutionNote = resolutionNote;
        } else if (status === 'closed') {
            ticket.closedAt = new Date();
        }

        ticket.updates.push({
            status,
            note: resolutionNote || `Status updated to ${status}`,
            updatedBy: userId
        });

        await ticket.save();

        // Notify tenant
        await createNotification(
            ticket.tenantId, 
            status === 'resolved' ? 'maintenance_resolved' : 'maintenance_update', 
            `Maintenance Update: ${status}`,
            `The status of your maintenance request for ${ticket.propertyId.title} has changed to ${status}.`,
            'MaintenanceRequest', ticket._id
        );

        res.status(200).json({ message: "Ticket updated", ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const addUpdateNote = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { note } = req.body;

        const ticket = await MaintenanceRequest.findById(id).populate('propertyId', 'title');
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        // Ensure user is authorized
        if (ticket.tenantId.toString() !== userId && ticket.landlordId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        ticket.updates.push({
            status: ticket.status,
            note,
            updatedBy: userId
        });

        await ticket.save();

        // Notify the OTHER party
        const notifyUserId = ticket.tenantId.toString() === userId ? ticket.landlordId : ticket.tenantId;
        await createNotification(
            notifyUserId, 'maintenance_update', 'New Comment on Maintenance Ticket',
            `A new comment was added to the maintenance ticket for ${ticket.propertyId.title}.`,
            'MaintenanceRequest', ticket._id
        );

        res.status(200).json({ message: "Note added to ticket", ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getTickets = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        
        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };
        const tickets = await MaintenanceRequest.find(filter)
            .populate('propertyId', 'title location')
            .sort({ createdAt: -1 });

        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const ticket = await MaintenanceRequest.findById(id)
            .populate('propertyId', 'title location images')
            .populate('tenantId', 'firstName lastName phone email')
            .populate('landlordId', 'firstName lastName phone email')
            .populate('assignedTo', 'firstName lastName phone')
            .populate('updates.updatedBy', 'firstName lastName role');

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (role === 'tenant' && ticket.tenantId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && ticket.landlordId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        res.status(200).json(ticket);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const confirmResolution = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const ticket = await MaintenanceRequest.findOne({ _id: id, tenantId: userId });
        if (!ticket) return res.status(404).json({ message: "Ticket not found or unauthorized" });

        if (ticket.status !== 'resolved') {
            return res.status(400).json({ message: "Ticket is not in resolved state" });
        }

        ticket.tenantConfirmedResolution = true;
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        
        ticket.updates.push({
            status: 'closed',
            note: 'Tenant confirmed the resolution',
            updatedBy: userId
        });

        await ticket.save();

        // Notify landlord
        await createNotification(
            ticket.landlordId, 'maintenance_update', 'Resolution Confirmed',
            `The tenant has confirmed the repair is complete and the ticket is now closed.`,
            'MaintenanceRequest', ticket._id
        );

        res.status(200).json({ message: "Resolution confirmed and ticket closed", ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    createTicket,
    updateTicketStatus,
    addUpdateNote,
    getTickets,
    getTicketById,
    confirmResolution
};
