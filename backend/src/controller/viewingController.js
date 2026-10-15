const Viewing = require('../models/Viewing');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');
const { isMockMode, mockStore } = require('../config/db');

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        if (isMockMode()) return;
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

        if (isMockMode()) {
            if (!mockStore.viewings) mockStore.viewings = [];
            const property = (mockStore.properties || []).find(p => String(p._id) === String(propertyId)) || {
                _id: propertyId,
                title: "Selected Property",
                location: { city: "Addis Ababa", subCity: "Bole" },
                rentAmount: 30000,
                images: []
            };
            const viewing = {
                _id: "viewing-" + Date.now(),
                propertyId: {
                    _id: property._id,
                    title: property.title,
                    location: property.location,
                    rentAmount: property.rentAmount,
                    images: property.images
                },
                tenantId,
                landlordId: property.landlordId || "mock-landlord-1",
                requestedSlots: requestedSlots || [],
                status: "pending",
                tenantNote: tenantNote || "",
                createdAt: new Date().toISOString()
            };
            mockStore.viewings.unshift(viewing);
            return res.status(201).json({
                message: "Viewing requested successfully",
                viewing,
                data: viewing
            });
        }

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
            landlordId: landlordProfile.accountId,
            requestedSlots,
            tenantNote
        });

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
            viewing,
            data: viewing
        });
    } catch (error) {
        console.error("Request viewing error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getTenantViewings = async (req, res) => {
    try {
        if (isMockMode()) {
            if (!mockStore.viewings) mockStore.viewings = [];
            let list = mockStore.viewings.filter(v => String(v.tenantId) === String(req.user.id));
            if (list.length === 0 && mockStore.viewings.length > 0) {
                list = mockStore.viewings.map(v => ({ ...v, tenantId: req.user.id }));
            }
            return res.status(200).json({ success: true, data: list, viewings: list });
        }

        const viewings = await Viewing.find({ tenantId: req.user.id })
            .populate('propertyId', 'title location rentAmount images')
            .sort({ date: 1, createdAt: -1 });
            
        res.status(200).json({ success: true, data: viewings, viewings: viewings });
    } catch (error) {
        console.error("getTenantViewings error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getLandlordViewings = async (req, res) => {
    try {
        if (isMockMode()) {
            if (!mockStore.viewings) mockStore.viewings = [];
            let list = mockStore.viewings.filter(v => String(v.landlordId) === String(req.user.id));
            if (list.length === 0 && mockStore.viewings.length > 0) {
                list = mockStore.viewings.map(v => ({ ...v, landlordId: req.user.id }));
            }
            return res.status(200).json({ success: true, data: list, viewings: list });
        }

        const viewings = await Viewing.find({ landlordId: req.user.id })
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .sort({ date: 1, createdAt: -1 });
            
        res.status(200).json({ success: true, data: viewings, viewings: viewings });
    } catch (error) {
        console.error("getLandlordViewings error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getMyViewings = async (req, res, next) => {
    if (req.user && req.user.role === 'landlord') {
        return getLandlordViewings(req, res, next);
    }
    return getTenantViewings(req, res, next);
};

const cancelViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body || {};

        if (isMockMode()) {
            if (!mockStore.viewings) mockStore.viewings = [];
            const viewing = mockStore.viewings.find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'cancelled';
                viewing.cancellationReason = cancellationReason || 'Cancelled by user';
                viewing.cancelledBy = req.user?.role || 'tenant';
                return res.status(200).json({ message: "Viewing cancelled", viewing, data: viewing });
            }
            return res.status(404).json({ message: "Viewing not found" });
        }

        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, $or: [{ tenantId: req.user.id }, { landlordId: req.user.id }] },
            { status: 'cancelled', cancellationReason: cancellationReason || 'Cancelled by user', cancelledBy: req.user.role },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Viewing not found or unauthorized" });
        }

        res.status(200).json({ message: "Viewing cancelled", viewing, data: viewing });
    } catch (error) {
        console.error("Cancel viewing error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const acceptViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmedSlot, landlordNote } = req.body;
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'confirmed';
                viewing.confirmedSlot = confirmedSlot;
                viewing.landlordNote = landlordNote;
                return res.status(200).json({ message: "Viewing confirmed", viewing, data: viewing });
            }
            return res.status(404).json({ message: "Viewing not found" });
        }

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

        res.status(200).json({ message: "Viewing confirmed", viewing, data: viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rejectViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'cancelled';
                viewing.cancellationReason = cancellationReason;
                viewing.cancelledBy = 'landlord';
                return res.status(200).json({ message: "Viewing cancelled", viewing, data: viewing });
            }
            return res.status(404).json({ message: "Viewing not found" });
        }

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

        res.status(200).json({ message: "Viewing cancelled", viewing, data: viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rescheduleViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmedSlot, landlordNote } = req.body;
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'rescheduled';
                viewing.confirmedSlot = confirmedSlot;
                viewing.landlordNote = landlordNote;
                return res.status(200).json({ message: "Viewing rescheduled", viewing, data: viewing });
            }
            return res.status(404).json({ message: "Viewing not found" });
        }

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

        res.status(200).json({ message: "Viewing rescheduled", viewing, data: viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const completeViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantInterested, tenantFeedback } = req.body;
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'completed';
                viewing.outcome = { tenantInterested, tenantFeedback };
                return res.status(200).json({ message: "Viewing marked as completed", viewing, data: viewing });
            }
            return res.status(404).json({ message: "Viewing not found" });
        }

        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, landlordId: req.user.id, status: 'confirmed' },
            { 
                status: 'completed',
                outcome: { tenantInterested, tenantFeedback }
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Confirmed viewing not found or unauthorized" });
        }

        res.status(200).json({ message: "Viewing marked as completed", viewing, data: viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const markNoShow = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'no_show';
                return res.status(200).json({ message: "Viewing marked as no-show", viewing, data: viewing });
            }
            return res.status(404).json({ message: "Viewing not found" });
        }

        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, landlordId: req.user.id, status: 'confirmed' },
            { status: 'no_show' },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Confirmed viewing not found or unauthorized" });
        }

        await createNotification(
            viewing.tenantId, 
            'viewing_no_show', 
            'Viewing Missed',
            `You were marked as a no-show for the viewing at ${viewing.propertyId.title}.`,
            'Viewing',
            viewing._id
        );

        res.status(200).json({ message: "Viewing marked as no-show", viewing, data: viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    requestViewing,
    getTenantViewings,
    getLandlordViewings,
    getMyViewings,
    cancelViewing,
    acceptViewing,
    rejectViewing,
    rescheduleViewing,
    completeViewing,
    markNoShow
};
