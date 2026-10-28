const Viewing = require('../models/Viewing');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

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

const normalizeViewing = (v) => {
    if (!v) return v;
    let slotDate = v.preferredDate || v.scheduledDate || v.date;
    let slotTime = v.preferredTime || v.scheduledTime || v.time;
    if ((!slotDate || !slotTime) && Array.isArray(v.requestedSlots) && v.requestedSlots.length > 0) {
        const first = v.requestedSlots[0];
        if (typeof first === 'string') {
            slotDate = slotDate || first;
            if (first.includes('T')) {
                const parts = first.split('T')[1]?.slice(0, 5);
                if (parts && parts !== '00:00') slotTime = slotTime || parts;
            }
        } else if (first && typeof first === 'object') {
            slotDate = slotDate || first.date;
            slotTime = slotTime || first.startTime || first.time;
        }
    }
    if ((!slotDate || !slotTime) && v.confirmedSlot) {
        slotDate = slotDate || v.confirmedSlot.date;
        slotTime = slotTime || v.confirmedSlot.startTime;
    }
    return {
        ...v,
        date: slotDate,
        preferredDate: slotDate,
        preferredTime: slotTime,
        scheduledDate: v.status === 'confirmed' ? (v.confirmedSlot?.date || slotDate) : (v.scheduledDate || slotDate),
        scheduledTime: v.status === 'confirmed' ? (v.confirmedSlot?.startTime || slotTime) : (v.scheduledTime || slotTime),
        message: v.message || v.tenantNote || ''
    };
};

const requestViewing = async (req, res) => {
    try {
        const { propertyId, requestedSlots, tenantNote, preferredDate, preferredTime, scheduledDate, scheduledTime, date } = req.body;
        const tenantId = req.user.id;

        let slotDate = preferredDate || scheduledDate || date;
        let slotTime = preferredTime || scheduledTime;
        if (!slotDate && Array.isArray(requestedSlots) && requestedSlots.length > 0) {
            const first = requestedSlots[0];
            slotDate = typeof first === 'string' ? first : (first?.date || first?.preferredDate);
            slotTime = first?.startTime || first?.time || first?.preferredTime;
        }
        if (slotDate && String(slotDate).includes('T') && !slotTime) {
            slotTime = String(slotDate).split('T')[1]?.slice(0, 5);
        }

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
                requestedSlots: requestedSlots || (slotDate ? [{ date: slotDate, startTime: slotTime, endTime: slotTime }] : []),
                date: slotDate,
                preferredDate: slotDate,
                preferredTime: slotTime,
                scheduledDate: slotDate,
                scheduledTime: slotTime,
                status: "pending",
                tenantNote: tenantNote || "",
                createdAt: new Date().toISOString()
            };
            mockStore.viewings.unshift(viewing);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(201).json({
                message: "Viewing requested successfully",
                viewing: normalizeViewing(viewing),
                data: normalizeViewing(viewing)
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
            requestedSlots: requestedSlots || (slotDate ? [{ date: slotDate, startTime: slotTime, endTime: slotTime }] : []),
            date: slotDate,
            preferredDate: slotDate,
            preferredTime: slotTime,
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
            viewing: normalizeViewing(viewing.toObject ? viewing.toObject() : viewing),
            data: normalizeViewing(viewing.toObject ? viewing.toObject() : viewing)
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
            const currentUserId = String(req.user?.id || req.user?.userId || "");
            const userEmail = String(req.user?.email || "").toLowerCase();
            const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || currentUserId === 'mock-user-seed-1';

            // Only seed demo viewing if mockStore is completely empty AND user is explicitly the dev seed tenant
            if (mockStore.viewings.length === 0 && isSeedTenant) {
                mockStore.viewings = [
                    {
                        _id: "viewing-mock-1",
                        propertyId: {
                            _id: "prop-1",
                            title: "Luxury 2 Bedroom Apartment in Bole",
                            location: { city: "Addis Ababa", subCity: "Bole" },
                            rentAmount: 35000,
                            images: ["/homes/modern-villa.png"]
                        },
                        tenantId: "mock-user-seed-1",
                        landlordId: "mock-landlord-1",
                        date: "2026-10-30T10:00:00Z",
                        requestedSlots: [{ date: "2026-10-30T10:00:00Z", startTime: "10:00" }],
                        preferredDate: "2026-10-30T10:00:00Z",
                        preferredTime: "10:00",
                        scheduledDate: "2026-10-30T10:00:00Z",
                        scheduledTime: "10:00",
                        confirmedSlot: { date: "2026-10-30T10:00:00Z", startTime: "10:00" },
                        status: "confirmed",
                        tenantNote: "Looking forward to seeing the property.",
                        createdAt: new Date().toISOString()
                    }
                ];
            }

            // Strictly filter by this tenant's ID
            const list = mockStore.viewings.filter(v => {
                const vTenantId = v.tenantId?._id ? String(v.tenantId._id) : String(v.tenantId || "");
                return vTenantId === currentUserId || (isSeedTenant && (vTenantId === 'mock-user-seed-1' || vTenantId === 'mock-user-tenant'));
            }).map(normalizeViewing);

            return res.status(200).json({ success: true, data: list, viewings: list });
        }

        const viewings = await Viewing.find({ tenantId: req.user.id })
            .populate('propertyId', 'title location rentAmount images')
            .sort({ date: 1, createdAt: -1 });
        const list = viewings.map(v => normalizeViewing(v.toObject ? v.toObject() : v));
            
        res.status(200).json({ success: true, data: list, viewings: list });
    } catch (error) {
        console.error("getTenantViewings error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getLandlordViewings = async (req, res) => {
    try {
        if (isMockMode()) {
            if (!mockStore.viewings) mockStore.viewings = [];
            const currentUserId = String(req.user?.id || req.user?.userId || "");
            const userEmail = String(req.user?.email || "").toLowerCase();
            const isSeedLandlord = userEmail === 'dev.landlord@homelink.test' || currentUserId === 'mock-landlord-1';

            const myPropIds = new Set(
                (mockStore.properties || [])
                    .filter(p => String(p.landlordId) === currentUserId || (isSeedLandlord && String(p.landlordId) === 'mock-landlord-1'))
                    .map(p => String(p._id))
            );

            const userList = Array.isArray(mockStore.users) ? mockStore.users : Array.from(mockStore.users?.values() || []);

            const list = mockStore.viewings
                .filter(v => {
                    const propId = String(v.propertyId?._id || v.propertyId || "");
                    const ownsProp = myPropIds.has(propId);
                    const vLandlordId = v.landlordId?._id ? String(v.landlordId._id) : String(v.landlordId || "");
                    return ownsProp || vLandlordId === currentUserId || (isSeedLandlord && (vLandlordId === 'mock-landlord-1' || !vLandlordId));
                })
                .map(v => {
                    const normalized = normalizeViewing(v);
                    let prop = normalized.propertyId;
                    if (typeof prop === 'string') {
                        prop = (mockStore.properties || []).find(p => String(p._id) === String(prop)) || { title: "Property" };
                    }
                    let tenant = normalized.tenantId;
                    if (typeof tenant === 'string') {
                        const found = userList.find(u => String(u._id) === String(tenant) || String(u.id) === String(tenant));
                        tenant = found || { firstName: "Tenant", lastName: "", phone: "", email: "" };
                    }
                    return {
                        ...normalized,
                        propertyId: prop,
                        tenantId: tenant
                    };
                });

            return res.status(200).json({ success: true, data: list, viewings: list });
        }

        const viewings = await Viewing.find({ landlordId: req.user.id })
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .sort({ date: 1, createdAt: -1 });
        const list = viewings.map(v => normalizeViewing(v.toObject ? v.toObject() : v));
            
        res.status(200).json({ success: true, data: list, viewings: list });
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
                if (typeof persistMockData === 'function') persistMockData();
                return res.status(200).json({ message: "Viewing cancelled", viewing: normalizeViewing(viewing), data: normalizeViewing(viewing) });
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
        const { confirmedSlot, landlordNote } = req.body || {};
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                const targetDate = req.body?.scheduledDate || req.body?.date || confirmedSlot?.date || viewing.preferredDate || viewing.scheduledDate || viewing.date || new Date().toISOString();
                const targetTime = req.body?.scheduledTime || req.body?.time || confirmedSlot?.startTime || viewing.preferredTime || viewing.scheduledTime || viewing.time || '10:00';
                viewing.status = req.body?.reschedule ? 'rescheduled' : 'confirmed';
                viewing.confirmedSlot = { date: targetDate, startTime: targetTime };
                viewing.scheduledDate = targetDate;
                viewing.scheduledTime = targetTime;
                if (landlordNote) viewing.landlordNote = landlordNote;
                if (typeof persistMockData === 'function') persistMockData();
                return res.status(200).json({ message: viewing.status === 'rescheduled' ? "Viewing rescheduled" : "Viewing confirmed", viewing: normalizeViewing(viewing), data: normalizeViewing(viewing) });
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
        const { cancellationReason } = req.body || {};
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'cancelled';
                viewing.cancellationReason = cancellationReason || 'Declined by landlord';
                viewing.cancelledBy = 'landlord';
                if (typeof persistMockData === 'function') persistMockData();
                return res.status(200).json({ message: "Viewing cancelled", viewing: normalizeViewing(viewing), data: normalizeViewing(viewing) });
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
        const { confirmedSlot, landlordNote, scheduledDate, scheduledTime, date, time } = req.body || {};
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                const targetDate = scheduledDate || date || confirmedSlot?.date || viewing.preferredDate || new Date().toISOString();
                const targetTime = scheduledTime || time || confirmedSlot?.startTime || viewing.preferredTime || '10:00';
                viewing.status = 'rescheduled';
                viewing.confirmedSlot = { date: targetDate, startTime: targetTime };
                viewing.scheduledDate = targetDate;
                viewing.scheduledTime = targetTime;
                if (landlordNote) viewing.landlordNote = landlordNote;
                if (typeof persistMockData === 'function') persistMockData();
                return res.status(200).json({ message: "Viewing rescheduled", viewing: normalizeViewing(viewing), data: normalizeViewing(viewing) });
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
        const { tenantInterested, tenantFeedback } = req.body || {};
        
        if (isMockMode()) {
            const viewing = (mockStore.viewings || []).find(v => String(v._id) === String(id));
            if (viewing) {
                viewing.status = 'completed';
                viewing.outcome = { tenantInterested, tenantFeedback };
                if (typeof persistMockData === 'function') persistMockData();
                return res.status(200).json({ message: "Viewing marked as completed", viewing: normalizeViewing(viewing), data: normalizeViewing(viewing) });
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
