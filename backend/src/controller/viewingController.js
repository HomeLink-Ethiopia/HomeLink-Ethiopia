const Viewing = require('../models/Viewing');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        await Notification.create({
            userId,
            type,
            title,
            body,
            relatedEntity: {
                entityType,
                entityId
            },
            channels: ['in_app']
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const requestViewing = async (req, res) => {
    try {
        const { propertyId, requestedSlots, tenantNote } = req.body;
        const tenantId = req.user.id;

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        const landlordProfile = await LandlordProfile.findById(property.landlordId);
        if (!landlordProfile) {
            return res.status(404).json({ message: "Landlord profile not found for this property" });
        }

        const viewing = await Viewing.create({
            propertyId,
            tenantId,
            landlordId: landlordProfile.accountId, // Use the user's account ID for the landlord
            requestedSlots,
            tenantNote
        });

        // Notify Landlord
        await createNotification(
            landlordProfile.accountId, 
            'viewing_requested', 
            'New Viewing Request',
            `A new viewing has been requested for your property: ${property.title}`,
            'Viewing',
            viewing._id
        );

        res.status(201).json({
            message: "Viewing requested successfully",
            viewing
        });
    } catch (error) {
        console.error("Request viewing error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getTenantViewings = async (req, res) => {
    try {
        const viewings = await Viewing.find({ tenantId: req.user.id })
            .populate('propertyId', 'title location rentAmount images')
            .sort({ date: 1 });
            
        res.status(200).json(viewings);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getLandlordViewings = async (req, res) => {
    try {
        const viewings = await Viewing.find({ landlordId: req.user.id })
            .populate('propertyId', 'title location rentAmount')
            .populate('tenantId', 'firstName lastName email phone')
            .sort({ date: 1 });
            
        res.status(200).json(viewings);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const acceptViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmedSlot, landlordNote } = req.body;
        
        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, landlordId: req.user.id },
            { status: 'confirmed', confirmedSlot, landlordNote },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Viewing not found or unauthorized" });
        }

        await createNotification(
            viewing.tenantId, 
            'viewing_confirmed', 
            'Viewing Confirmed',
            `Your viewing for ${viewing.propertyId.title} has been confirmed.`,
            'Viewing',
            viewing._id
        );

        res.status(200).json({ message: "Viewing confirmed", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rejectViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;
        
        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, landlordId: req.user.id },
            { status: 'cancelled', cancellationReason, cancelledBy: 'landlord' },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Viewing not found or unauthorized" });
        }

        await createNotification(
            viewing.tenantId, 
            'viewing_cancelled', 
            'Viewing Cancelled',
            `Your viewing for ${viewing.propertyId.title} has been cancelled by the landlord.`,
            'Viewing',
            viewing._id
        );

        res.status(200).json({ message: "Viewing cancelled", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rescheduleViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmedSlot, landlordNote } = req.body;
        
        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, landlordId: req.user.id },
            { status: 'rescheduled', confirmedSlot, landlordNote },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Viewing not found or unauthorized" });
        }

        await createNotification(
            viewing.tenantId, 
            'viewing_confirmed', 
            'Viewing Rescheduled',
            `Your viewing for ${viewing.propertyId.title} has been rescheduled to ${new Date(confirmedSlot.date).toLocaleDateString()} at ${confirmedSlot.startTime}.`,
            'Viewing',
            viewing._id
        );

        res.status(200).json({ message: "Viewing rescheduled", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    requestViewing,
    getTenantViewings,
    getLandlordViewings,
    acceptViewing,
    rejectViewing,
    rescheduleViewing
};
