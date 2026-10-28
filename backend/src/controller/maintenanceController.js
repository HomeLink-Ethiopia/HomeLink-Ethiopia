const MaintenanceRequest = require('../models/MaintenanceRequest');
const RentalAgreement = require('../models/RentalAgreement');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

// Ensure mockStore has maintenanceRequests initialized with seed tickets
function ensureMockMaintenance() {
    if (!mockStore.maintenanceRequests) {
        mockStore.maintenanceRequests = mockStore.maintenance || [];
    }
    if (mockStore.maintenanceRequests.length === 0) {
        const prop1 = (mockStore.properties || [])[0] || { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole", location: { city: "Addis Ababa", subCity: "Bole" } };
        mockStore.maintenanceRequests = [
            {
                _id: "mock-maint-1",
                agreementId: "mock-agreement-1",
                propertyId: { _id: prop1._id, title: prop1.title, location: prop1.location },
                tenantId: "mock-user-seed-1",
                landlordId: "mock-landlord-1",
                title: "Water Tanker Pressure Pump Fluctuations",
                description: "The overhead water tank pump shuts off intermittently during peak morning hours.",
                category: "plumbing",
                priority: "high",
                mediaKeys: [],
                status: "in_progress",
                scheduledDate: new Date(Date.now() + 86400000).toISOString(),
                assignedTo: { firstName: "Alemayehu", lastName: "Plumbing Services", phone: "+251911445566" },
                resolutionNote: "Technician dispatched to inspect pressure switch.",
                response: "Technician dispatched to inspect pressure switch.",
                tenantConfirmedResolution: false,
                updates: [
                    { status: "reported", note: "Issue reported by tenant.", timestamp: new Date(Date.now() - 2 * 86400000).toISOString() },
                    { status: "assigned", note: "Assigned to Alemayehu Plumbing.", timestamp: new Date(Date.now() - 86400000).toISOString() },
                    { status: "in_progress", note: "Parts arrived, replacement in progress.", timestamp: new Date().toISOString() }
                ],
                createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
            },
            {
                _id: "mock-maint-2",
                agreementId: "mock-agreement-1",
                propertyId: { _id: prop1._id, title: prop1.title, location: prop1.location },
                tenantId: "mock-user-seed-1",
                landlordId: "mock-landlord-1",
                title: "Kitchen Balcony Light Fixture Replacement",
                description: "Balcony LED fixture needs replacement due to rain water ingress.",
                category: "electrical",
                priority: "medium",
                status: "resolved",
                resolvedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
                resolutionNote: "Waterproof LED fixture installed and sealed.",
                response: "Waterproof LED fixture installed and sealed.",
                tenantConfirmedResolution: true,
                updates: [
                    { status: "reported", note: "Reported by tenant.", timestamp: new Date(Date.now() - 5 * 86400000).toISOString() },
                    { status: "resolved", note: "Electrician replaced fixture and sealed wiring box.", timestamp: new Date(Date.now() - 3 * 86400000).toISOString() }
                ],
                createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
            }
        ];
    }
    // Ensure Tsedenia's agreement has an active maintenance ticket
    const tsedeniaAgr = (mockStore.agreements || []).find(a => String(a._id) === 'mock-agreement-tsedenia-3br');
    if (tsedeniaAgr && !mockStore.maintenanceRequests.some(m => String(m.agreementId) === 'mock-agreement-tsedenia-3br')) {
        const p = tsedeniaAgr.propertyId || {};
        mockStore.maintenanceRequests.unshift({
            _id: "mock-maint-tsedenia-1",
            agreementId: "mock-agreement-tsedenia-3br",
            propertyId: { _id: p._id || "mock-prop-1793127878397", title: p.title || "3bedroom", location: p.location || { city: "Addis Ababa", subCity: "Bole" } },
            tenantId: {
                _id: "mock-user-1793083864425",
                firstName: "Tsedenia",
                lastName: "Worku",
                phone: "0987654321",
                email: "kidkinfe7@gmail.com"
            },
            landlordId: "mock-user-1793084104793",
            title: "Master Bedroom Bathroom Water Heater Sensor",
            description: "Instant water heater cuts off power after 3 minutes. Thermostat and breaker check requested.",
            category: "electrical",
            priority: "high",
            mediaKeys: [],
            status: "in_progress",
            scheduledDate: new Date(Date.now() + 86400000).toISOString(),
            assignedTo: "Kassahun Electrical (+251911778899)",
            response: "Technician Kassahun dispatched to inspect the water heater switch tomorrow morning.",
            resolutionNote: "Technician Kassahun dispatched to inspect the water heater switch tomorrow morning.",
            tenantConfirmedResolution: false,
            updates: [
                { status: "reported", note: "Reported by tenant via HomeLink portal.", timestamp: new Date(Date.now() - 86400000).toISOString() },
                { status: "in_progress", note: "Landlord reviewed and dispatched Kassahun Electrical.", timestamp: new Date().toISOString() }
            ],
            createdAt: new Date(Date.now() - 86400000).toISOString()
        });
    }
    mockStore.maintenance = mockStore.maintenanceRequests;
}

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        const { mockCreateNotification } = require('../config/db');
        if (isMockMode() && typeof mockCreateNotification === 'function') {
            mockCreateNotification(userId, type, title, body, entityType, entityId);
            return;
        }
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
        
        const mediaKeys = req.files ? req.files.map(file => file.path) : [];

        if (isMockMode()) {
            ensureMockMaintenance();
            let agr = (mockStore.agreements || []).find(a => String(a._id) === String(agreementId));
            if (!agr) {
                agr = (mockStore.agreements || []).find(a => {
                    const tId = String(a.tenantId?._id || a.tenantId || '');
                    return (tId === String(tenantId) || tId.includes('1793083864425')) && a.status === 'active';
                });
            }
            let propId = propertyId || agr?.propertyId?._id || agr?.propertyId;
            let prop = (mockStore.properties || []).find(p => String(p._id) === String(propId));
            if (!prop && agr?.propertyId && typeof agr.propertyId === 'object') {
                prop = agr.propertyId;
            }
            if (!prop && mockStore.properties && mockStore.properties.length > 0) {
                prop = mockStore.properties[0];
            }
            const landlordId = String((agr && (agr.landlordId?._id || agr.landlordId)) || (prop && (prop.landlordId?._id || prop.landlordId)) || "mock-landlord-1");
            const tenantUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === String(tenantId));
            const tenantObj = tenantUser ? {
                _id: tenantUser._id,
                firstName: tenantUser.firstName,
                lastName: tenantUser.lastName,
                phone: tenantUser.phone,
                email: tenantUser.email
            } : { _id: tenantId, firstName: "Tenant" };

            const ticket = {
                _id: "mock-ticket-" + Date.now(),
                agreementId: agr?._id || agreementId || "mock-agreement-1",
                propertyId: prop ? { _id: prop._id, title: prop.title, location: prop.location } : { _id: "prop-1", title: "Rental Property" },
                tenantId: tenantObj,
                landlordId: landlordId,
                title: title || "Maintenance Request",
                description: description || "",
                category: category || "other",
                priority: priority || "medium",
                mediaKeys,
                status: 'reported',
                tenantConfirmedResolution: false,
                updates: [{ status: 'reported', note: 'Ticket submitted by tenant', updatedBy: tenantId, timestamp: new Date().toISOString() }],
                createdAt: new Date().toISOString()
            };
            mockStore.maintenanceRequests.unshift(ticket);
            mockStore.maintenance = mockStore.maintenanceRequests;
            createNotification(landlordId, 'maintenance_update', 'New Maintenance Request', `Tenant submitted maintenance request: ${title}`, 'MaintenanceRequest', ticket._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(201).json({ message: "Maintenance request submitted", ticket, data: ticket });
        }

        const property = await Property.findById(propertyId);
        if (!property) return res.status(404).json({ message: "Property not found" });

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
            status: 'reported',
            updates: [{
                status: 'reported',
                note: 'Ticket created',
                updatedBy: tenantId
            }]
        });

        await createNotification(
            landlordProfile.accountId, 'maintenance_update', 'New Maintenance Request',
            `Tenant has submitted a new maintenance request: ${title}`,
            'MaintenanceRequest', ticket._id
        );

        res.status(201).json({ message: "Maintenance request submitted", ticket, data: ticket });
    } catch (error) {
        console.error("createTicket error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { status, assignedTo, scheduledDate, resolutionNote, response } = req.body;
        const note = response || resolutionNote;

        if (isMockMode()) {
            ensureMockMaintenance();
            const ticket = mockStore.maintenanceRequests.find(t => String(t._id) === String(id));
            if (!ticket) return res.status(404).json({ message: "Ticket not found or unauthorized" });
            if (status) ticket.status = status;
            if (assignedTo) ticket.assignedTo = assignedTo;
            if (scheduledDate) ticket.scheduledDate = scheduledDate;
            if (note) {
                ticket.resolutionNote = note;
                ticket.response = note;
                ticket.respondedAt = new Date().toISOString();
            }
            if (status === 'resolved') ticket.resolvedAt = new Date().toISOString();
            if (status === 'closed') ticket.closedAt = new Date().toISOString();
            
            if (!ticket.updates) ticket.updates = [];
            ticket.updates.push({ status: ticket.status, note: note || `Status updated to ${ticket.status}`, updatedBy: userId, timestamp: new Date().toISOString() });
            
            const tenantUserId = String(ticket.tenantId?._id || ticket.tenantId || '');
            createNotification(tenantUserId, 'maintenance_update', `Maintenance Update: ${ticket.status}`, note || `Maintenance status changed to ${ticket.status}`, 'MaintenanceRequest', ticket._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Ticket updated", ticket, data: ticket });
        }

        const ticket = await MaintenanceRequest.findOne({ _id: id, landlordId: userId }).populate('propertyId', 'title');
        if (!ticket) return res.status(404).json({ message: "Ticket not found or unauthorized" });

        if (status) ticket.status = status;
        if (assignedTo) ticket.assignedTo = assignedTo;
        if (scheduledDate) ticket.scheduledDate = scheduledDate;
        if (note) {
            ticket.resolutionNote = note;
            ticket.response = note;
        }
        
        if (status === 'resolved') {
            ticket.resolvedAt = new Date();
        } else if (status === 'closed') {
            ticket.closedAt = new Date();
        }

        ticket.updates.push({
            status: ticket.status,
            note: note || `Status updated to ${ticket.status}`,
            updatedBy: userId
        });

        await ticket.save();

        await createNotification(
            ticket.tenantId, 
            status === 'resolved' ? 'maintenance_resolved' : 'maintenance_update', 
            `Maintenance Update: ${ticket.status}`,
            `The status of your maintenance request for ${ticket.propertyId.title} has changed to ${ticket.status}.`,
            'MaintenanceRequest', ticket._id
        );

        res.status(200).json({ message: "Ticket updated", ticket, data: ticket });
    } catch (error) {
        console.error("updateTicketStatus error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const addUpdateNote = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { note } = req.body;

        if (isMockMode()) {
            ensureMockMaintenance();
            const ticket = mockStore.maintenanceRequests.find(t => String(t._id) === String(id));
            if (!ticket) return res.status(404).json({ message: "Ticket not found" });
            if (!ticket.updates) ticket.updates = [];
            ticket.updates.push({ status: ticket.status, note, updatedBy: userId, timestamp: new Date().toISOString() });
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Note added to ticket", ticket, data: ticket });
        }

        const ticket = await MaintenanceRequest.findById(id).populate('propertyId', 'title');
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (ticket.tenantId.toString() !== userId && ticket.landlordId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        ticket.updates.push({
            status: ticket.status,
            note,
            updatedBy: userId
        });

        await ticket.save();

        const notifyUserId = ticket.tenantId.toString() === userId ? ticket.landlordId : ticket.tenantId;
        await createNotification(
            notifyUserId, 'maintenance_update', 'New Comment on Maintenance Ticket',
            `A new comment was added to the maintenance ticket for ${ticket.propertyId.title}.`,
            'MaintenanceRequest', ticket._id
        );

        res.status(200).json({ message: "Note added to ticket", ticket, data: ticket });
    } catch (error) {
        console.error("addUpdateNote error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getTickets = async (req, res) => {
    try {
        const userId = String(req.user.id || req.user.userId || '');
        const role = req.user.role;
        const userEmail = (req.user?.email || '').toLowerCase().trim();
        const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userId === 'mock-user-seed-1';
        const isSeedLandlord = userEmail === 'dev.landlord@homelink.test' || userId === 'mock-landlord-1';
        
        if (isMockMode()) {
            ensureMockMaintenance();
            const allProps = mockStore.properties || [];
            const allAgrs = mockStore.agreements || [];
            
            // Find all properties owned by this landlord
            const landlordPropIds = new Set(
                allProps.filter(p => {
                    const lId = String(p.landlordId?._id || p.landlordId || '');
                    return lId === userId || (p.landlordId?.email && p.landlordId.email.toLowerCase() === userEmail);
                }).map(p => String(p._id))
            );
            // Also add agreement properties for this landlord
            allAgrs.filter(a => {
                const lId = String(a.landlordId?._id || a.landlordId || '');
                return lId === userId || (a.landlordId?.email && a.landlordId.email.toLowerCase() === userEmail);
            }).forEach(a => {
                const pId = String(a.propertyId?._id || a.propertyId || '');
                if (pId) landlordPropIds.add(pId);
            });

            const tickets = (mockStore.maintenanceRequests || []).filter(t => {
                const tTenantId = String(t.tenantId?._id || t.tenantId || '');
                const tLandlordId = String(t.landlordId?._id || t.landlordId || '');
                const tPropId = String(t.propertyId?._id || t.propertyId || '');
                
                if (role === 'tenant') {
                    if (tTenantId === userId) return true;
                    if (isSeedTenant && (tTenantId === 'mock-user-seed-1' || !tTenantId)) return true;
                    const isMyAgr = allAgrs.some(a => String(a._id) === String(t.agreementId) && String(a.tenantId?._id || a.tenantId) === userId);
                    if (isMyAgr) return true;
                    return false;
                }
                
                // Landlord role
                if (tLandlordId === userId) return true;
                if (landlordPropIds.has(tPropId)) return true;
                if (isSeedLandlord && (tLandlordId === 'mock-landlord-1' || !tLandlordId)) return true;
                const isMyAgr = allAgrs.some(a => String(a._id) === String(t.agreementId) && String(a.landlordId?._id || a.landlordId) === userId);
                if (isMyAgr) return true;
                return false;
            }).map(t => {
                const pId = String(t.propertyId?._id || t.propertyId || '');
                const foundProp = allProps.find(p => String(p._id) === pId);
                const assigned = typeof t.assignedTo === 'object' && t.assignedTo
                    ? `${t.assignedTo.firstName || ''} ${t.assignedTo.lastName || ''} ${t.assignedTo.phone ? `(${t.assignedTo.phone})` : ''}`.trim()
                    : (t.assignedTo || '');
                return {
                    ...t,
                    propertyId: (typeof t.propertyId === 'object' && t.propertyId?.title) ? t.propertyId : {
                        _id: pId,
                        title: foundProp?.title || 'Rental Property',
                        location: foundProp?.location || { city: 'Addis Ababa' }
                    },
                    assignedTo: assigned,
                    response: t.response || t.resolutionNote || '',
                    resolutionNote: t.resolutionNote || t.response || ''
                };
            });
            return res.status(200).json({ success: true, data: tickets, requests: tickets });
        }

        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };
        const tickets = await MaintenanceRequest.find(filter)
            .populate('propertyId', 'title location')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: tickets, requests: tickets });
    } catch (error) {
        console.error("getTickets error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        if (isMockMode()) {
            ensureMockMaintenance();
            const ticket = mockStore.maintenanceRequests.find(t => String(t._id) === String(id));
            if (!ticket) return res.status(404).json({ message: "Ticket not found" });
            return res.status(200).json({ success: true, data: ticket, ticket });
        }

        const ticket = await MaintenanceRequest.findById(id)
            .populate('propertyId', 'title location images')
            .populate('tenantId', 'firstName lastName phone email')
            .populate('landlordId', 'firstName lastName phone email')
            .populate('assignedTo', 'firstName lastName phone')
            .populate('updates.updatedBy', 'firstName lastName role');

        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        if (role === 'tenant' && ticket.tenantId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && ticket.landlordId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        res.status(200).json({ success: true, data: ticket, ticket });
    } catch (error) {
        console.error("getTicketById error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const confirmResolution = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (isMockMode()) {
            ensureMockMaintenance();
            const ticket = mockStore.maintenanceRequests.find(t => String(t._id) === String(id));
            if (!ticket) return res.status(404).json({ message: "Ticket not found" });
            ticket.tenantConfirmedResolution = true;
            ticket.status = 'closed';
            if (!ticket.updates) ticket.updates = [];
            ticket.updates.push({ status: 'closed', note: 'Tenant confirmed the resolution and closed ticket.', updatedBy: userId, timestamp: new Date().toISOString() });
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Resolution confirmed and ticket closed", ticket, data: ticket });
        }

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

        res.status(200).json({ message: "Resolution confirmed and ticket closed", ticket, data: ticket });
    } catch (error) {
        console.error("confirmResolution error:", error);
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
