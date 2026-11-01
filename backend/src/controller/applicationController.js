const Application = require('../models/Application');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

// ─── 1. Tenant Applies for a Property ───
const applyForProperty = async (req, res) => {
    try {
        if (isMockMode && isMockMode()) {
            const tenantId = req.user.id;
            const { propertyId, message, moveInDate, employmentStatus, fullName, phone, email } = req.body;
            const prop = (mockStore.properties || []).find(p => String(p._id) === String(propertyId));
            const newApp = {
                _id: 'mock-app-' + Date.now(),
                propertyId: prop ? { _id: prop._id, title: prop.title, rentAmount: prop.rentAmount, images: prop.images, location: prop.location } : propertyId,
                tenantId,
                landlordId: prop?.landlordId || 'mock-landlord-1',
                fullName: fullName || req.user.name || 'Applicant',
                phone: phone || req.user.phone || '',
                email: email || req.user.email || '',
                message,
                moveInDate,
                employmentStatus,
                status: 'submitted',
                history: [{ status: 'submitted', changedBy: tenantId, note: 'Application submitted', date: new Date().toISOString() }],
                createdAt: new Date().toISOString()
            };
            mockStore.applications = mockStore.applications || [];
            mockStore.applications.unshift(newApp);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(201).json({ message: 'Application submitted successfully', application: newApp });
        }
        const tenantId = req.user.id;
        const { propertyId, message, moveInDate, employmentStatus } = req.body;

        const property = await Property.findById(propertyId);
        if (!property) return res.status(404).json({ message: "Property not found" });
        if (property.listingStatus !== 'active') {
            return res.status(400).json({ message: "This property is not available for applications" });
        }

        // Check if already applied
        const existingApp = await Application.findOne({ propertyId, tenantId, status: { $in: ['submitted', 'under_review', 'approved'] } });
        if (existingApp) {
            return res.status(400).json({ message: "You already have an active application for this property" });
        }

        const application = await Application.create({
            propertyId,
            tenantId,
            landlordId: property.landlordId, // This is the LandlordProfile._id
            message,
            moveInDate,
            employmentStatus,
            status: 'submitted',
            history: [{ status: 'submitted', changedBy: tenantId, note: 'Application submitted' }]
        });

        // Notify Landlord
        const landlordProfile = await LandlordProfile.findById(property.landlordId);
        if (landlordProfile) {
            await Notification.create({
                userId: landlordProfile.accountId,
                type: 'system',
                title: 'New Application',
                body: `You have a new application for ${property.title}.`,
                relatedEntity: { entityType: 'Application', entityId: application._id }
            });
        }

        res.status(201).json({ message: "Application submitted successfully", application });
    } catch (error) {
        console.error("Apply error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── 2. Tenant views their own applications ───
const getTenantApplications = async (req, res) => {
    try {
        if (isMockMode && isMockMode()) {
            const tenantId = req.user.id;
            const apps = (mockStore.applications || []).filter(a => {
                const tId = typeof a.tenantId === 'object' ? a.tenantId._id : a.tenantId;
                return String(tId) === String(tenantId) || tenantId === 'mock-user-seed-1' || tenantId === 'mock-user-tenant';
            });
            return res.status(200).json(apps);
        }
        const applications = await Application.find({ tenantId: req.user.id })
            .populate('propertyId', 'title rentAmount images location')
            .populate('landlordId', 'legalName')
            .sort({ createdAt: -1 });
            
        res.status(200).json(applications);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── 3. Landlord views applications for their properties ───
const getLandlordApplications = async (req, res) => {
    try {
        if (isMockMode && isMockMode()) {
            const landlordId = req.user.id;
            const apps = (mockStore.applications || []).filter(a => {
                const lId = typeof a.landlordId === 'object' ? a.landlordId._id : a.landlordId;
                return String(lId) === String(landlordId) || landlordId === 'mock-landlord-1' || landlordId === 'mock-user-landlord' || req.user.role === 'landlord';
            });
            return res.status(200).json({ data: apps });
        }
        const LandlordProfile = require('../models/LandlordProfile'); // Ensure this is imported
        
        // 1. Get the LandlordProfile ID for this user (if it exists)
        const profile = await LandlordProfile.findOne({ accountId: req.user.id });
        
        // 2. Build a query that checks BOTH the User ID and the Profile ID
        const landlordIds = [req.user.id];
        if (profile) {
            landlordIds.push(profile._id);
        }

        const applications = await Application.find({ 
            landlordId: { $in: landlordIds } 
        })
        .populate('tenantId', 'firstName lastName email phone')
        .populate('propertyId', 'title rentAmount images location')
        .sort({ createdAt: -1 });

        res.status(200).json({data:applications});
    } catch (error) {
        console.error("Get landlord apps error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── 4. Landlord approves or rejects ───
// ─── 4. Landlord approves or rejects ───
const reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        if (isMockMode && isMockMode()) {
            const { status, reviewNotes } = req.body;
            const app = (mockStore.applications || []).find(a => String(a._id) === String(id));
            if (!app) return res.status(404).json({ message: 'Application not found' });
            app.status = status;
            app.history = app.history || [];
            app.history.push({
                status: status,
                changedBy: req.user.id,
                note: reviewNotes || ('Application ' + status)
            });
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: 'Application ' + status, application: app });
        }
        const { status, reviewNotes } = req.body; // 'approved' or 'rejected'
        const landlordUserId = req.user.id;

        const application = await Application.findById(id).populate('propertyId', 'title');
        if (!application) return res.status(404).json({ message: "Application not found" });

        // 1. Find the Landlord Profile associated with this user
        const profile = await LandlordProfile.findOne({ accountId: landlordUserId });
        
        // 2. Build an array of allowed IDs (User ID + Profile ID)
        const validIds = [String(landlordUserId)];
        if (profile) {
            validIds.push(String(profile._id));
        }

        // 3. Check if the application's landlordId matches ANY of the allowed IDs
        if (!validIds.includes(String(application.landlordId))) {
            return res.status(403).json({ message: "You are not authorized to review this application" });
        }

        // 4. Update the application
        application.status = status;
        application.decidedAt = new Date();
        application.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // Valid for 48h
        
        application.history.push({
            status: status,
            changedBy: landlordUserId,
            note: reviewNotes || `Application ${status}`
        });

        await application.save();

        // 5. Notify Tenant
       await Notification.create({
    userId: application.tenantId,
    type: 'system', // ✅ Safe, allowed type
    title: `Application ${status.toUpperCase()}`,
    body: `Your application for ${application.propertyId.title} has been ${status}.`,
    relatedEntity: { entityType: 'Application', entityId: application._id }
});

        res.status(200).json({ message: `Application ${status}`, application });
    } catch (error) {
        console.error("Review error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// ─── 5. Tenant withdraws application ───
const withdrawApplication = async (req, res) => {
    try {
        const { id } = req.params;
        if (isMockMode && isMockMode()) {
            const app = (mockStore.applications || []).find(a => String(a._id) === String(id));
            if (!app) return res.status(404).json({ message: 'Application not found' });
            app.status = 'withdrawn';
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: 'Application withdrawn', application: app });
        }
        const application = await Application.findOne({ _id: id, tenantId: req.user.id });
        
        if (!application) return res.status(404).json({ message: "Application not found" });
        if (['approved', 'rejected', 'withdrawn'].includes(application.status)) {
            return res.status(400).json({ message: "Cannot withdraw this application" });
        }

        application.status = 'withdrawn';
        application.history.push({ status: 'withdrawn', changedBy: req.user.id, note: 'Withdrawn by tenant' });
        await application.save();

        res.status(200).json({ message: "Application withdrawn", application });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── EXPORTS (CRITICAL!) ───
module.exports = {
    applyForProperty,
    getTenantApplications,
    getLandlordApplications,
    reviewApplication,
    withdrawApplication
};