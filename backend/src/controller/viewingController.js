const Viewing = require('../models/Viewing');
const { isMockMode, mockStore, persistMockData } = require('../config/db');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');

const { isMockMode: s89IsMock, mockCreateNotification: s89Notify } = require('../config/db'); // sprint89-notify-bridge
const createNotification = async (userId, type, title, body, entityType, entityId) => {
    if (s89IsMock && s89IsMock()) { s89Notify(userId, type, title, body, entityType, entityId); return; }
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
        // Mock DB: persist the booking so it appears in tenant AND landlord dashboards.
        if (isMockMode()) {
            const { propertyId, requestedSlots, tenantNote } = req.body || {};
            const slot = (requestedSlots && requestedSlots[0]) || {};
            const mockProperty = (mockStore.properties || []).find((pr) => pr._id === propertyId);
            const viewing = {
                _id: "mock-viewing-" + Date.now(),
                propertyId: mockProperty
                    ? { _id: mockProperty._id, title: mockProperty.title, location: mockProperty.location, rentAmount: mockProperty.rentAmount, images: mockProperty.images }
                    : { _id: propertyId || "", title: "Property" },
                tenantId: { _id: req.user.id, firstName: req.user.firstName || "Tenant", lastName: req.user.lastName || "" },
                landlordId: mockProperty ? mockProperty.landlordId : "mock-landlord-1",
                requestedSlots: requestedSlots || [],
                preferredDate: slot.date ? String(slot.date).slice(0, 10) : null,
                preferredTime: slot.startTime || null,
                tenantNote: tenantNote || "",
                status: "requested",
                createdAt: new Date().toISOString(),
            };
            mockStore.viewings.push(viewing);
            if (typeof persistMockData === 'function') persistMockData();
            // (sprint567-notify) spec: landlord notified when a viewing is requested
            createNotification(viewing.landlordId, 'viewing_requested', 'New Viewing Request', 'A tenant requested a viewing of your property.', 'Viewing', viewing._id);
            return res.status(201).json({ message: "Viewing requested", data: viewing });
        }


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
        if (isMockMode()) {
            const userId = String(req.user.id || '');
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userEmail === 'hanna@example.com';
            const rows = (mockStore.viewings || []).filter((v) => {
                const tId = String((v.tenantId && typeof v.tenantId === 'object' ? v.tenantId._id : v.tenantId) || '');
                return tId === userId || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId));
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.status(200).json(rows);
        }
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
        if (isMockMode()) {
            const userId = String(req.user.id || '');
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedLandlord = userEmail === 'dev.landlord@homelink.test';
            const rows = (mockStore.viewings || []).filter((v) => {
                const lId = String((v.landlordId && typeof v.landlordId === 'object' ? v.landlordId._id : v.landlordId) || '');
                return lId === userId || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId));
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.status(200).json(rows);
        }
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
        
        // Sprint 15: mock-mode accept — flip the in-memory booking.
        if (isMockMode()) {
            const v2 = (mockStore.viewings || []).find((x) => x._id === id);
            if (!v2) return res.status(404).json({ message: "Viewing not found or unauthorized" });
            v2.status = 'confirmed';
            if (confirmedSlot) v2.confirmedSlot = confirmedSlot;
            if (landlordNote) v2.landlordNote = landlordNote;
            // (sprint567-notify) spec: tenant notified on viewing accept
            createNotification((typeof v2.tenantId === 'object' ? v2.tenantId._id : v2.tenantId), 'viewing_confirmed', 'Viewing Confirmed', 'Your viewing has been confirmed by the landlord.', 'Viewing', v2._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Viewing confirmed", data: v2 });
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

        res.status(200).json({ message: "Viewing confirmed", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rejectViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;

        // (sprint567-viewing-actions) landlord reject without a DB
        if (isMockMode()) {
            const v3 = (mockStore.viewings || []).find((x) => x._id === id);
            if (!v3) return res.status(404).json({ message: "Viewing not found or unauthorized" });
            v3.status = 'cancelled';
            v3.cancellationReason = cancellationReason;
            v3.cancelledBy = 'landlord';
            createNotification((typeof v3.tenantId === 'object' ? v3.tenantId._id : v3.tenantId), 'viewing_cancelled', 'Viewing Cancelled', 'Your viewing request was declined by the landlord.', 'Viewing', v3._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Viewing cancelled", data: v3 });
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

        res.status(200).json({ message: "Viewing cancelled", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rescheduleViewing = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmedSlot, landlordNote } = req.body;

        // (sprint567-viewing-actions) landlord reschedule without a DB
        if (isMockMode()) {
            const v4 = (mockStore.viewings || []).find((x) => x._id === id);
            if (!v4) return res.status(404).json({ message: "Viewing not found or unauthorized" });
            v4.status = 'rescheduled';
            if (confirmedSlot) v4.confirmedSlot = confirmedSlot;
            if (landlordNote) v4.landlordNote = landlordNote;
            createNotification((typeof v4.tenantId === 'object' ? v4.tenantId._id : v4.tenantId), 'viewing_confirmed', 'Viewing Rescheduled', 'Your viewing was rescheduled by the landlord.', 'Viewing', v4._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Viewing rescheduled", data: v4 });
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

        res.status(200).json({ message: "Viewing rescheduled", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const completeViewing = async (req, res) => {
    try {
        const { id } = req.params;

        // (sprint567-viewing-actions) landlord complete without a DB
        if (isMockMode()) {
            const v5 = (mockStore.viewings || []).find((x) => x._id === id);
            if (!v5) return res.status(404).json({ message: "Viewing not found or unauthorized" });
            v5.status = 'completed';
            v5.completedAt = new Date().toISOString();
            createNotification((typeof v5.tenantId === 'object' ? v5.tenantId._id : v5.tenantId), 'viewing_confirmed', 'Viewing Completed', 'Your viewing was marked completed by the landlord.', 'Viewing', v5._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Viewing completed", data: v5 });
        }
        const { tenantInterested, tenantFeedback } = req.body;
        
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

        res.status(200).json({ message: "Viewing marked as completed", viewing });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const markNoShow = async (req, res) => {
    try {
        const { id } = req.params;
        if (isMockMode()) {
            const v6 = (mockStore.viewings || []).find((x) => x._id === id);
            if (!v6) return res.status(404).json({ message: "Confirmed viewing not found or unauthorized" });
            v6.status = 'no_show';
            createNotification((typeof v6.tenantId === 'object' ? v6.tenantId._id : v6.tenantId), 'viewing_no_show', 'Viewing Missed', 'You were marked as a no-show for the viewing.', 'Viewing', v6._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Viewing marked as no-show", data: v6 });
        }
        
        const viewing = await Viewing.findOneAndUpdate(
            { _id: id, landlordId: req.user.id, status: 'confirmed' },
            { status: 'no_show' },
            { new: true }
        ).populate('propertyId', 'title');

        if (!viewing) {
            return res.status(404).json({ message: "Confirmed viewing not found or unauthorized" });
        }

        // Notify tenant they were marked as a no-show
        await createNotification(
            viewing.tenantId, 
            'viewing_no_show', 
            'Viewing Missed',
            `You were marked as a no-show for the viewing at ${viewing.propertyId.title}.`,
            'Viewing',
            viewing._id
        );

        res.status(200).json({ message: "Viewing marked as no-show", viewing });
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
    rescheduleViewing,
    completeViewing,
    markNoShow
};
