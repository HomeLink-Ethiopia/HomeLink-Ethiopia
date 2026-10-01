const Application = require('../models/Application');
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

const applyForProperty = async (req, res) => {
    try {
        const { 
            propertyId, viewingAppointmentId, message, moveInDate, 
            durationMonths, numberOfOccupants, hasPets, 
            monthlyIncome, employmentStatus 
        } = req.body;
        const tenantId = req.user.id;
        
        // Map multer files to supportingDocuments structure
        const supportingDocuments = req.files ? req.files.map(file => ({
            documentType: 'general', // You could extract this from req.body if sent, defaulting to general
            fileKey: file.path
        })) : [];

        let property;
        if (isMockMode()) {
            property = Array.from(mockStore.properties || []).find(p => String(p._id) === String(propertyId));
        } else {
            property = await Property.findById(propertyId);
        }

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        let landlordProfile;
        if (isMockMode()) {
            landlordProfile = Array.from(mockStore.landlordProfiles.values() || []).find(l => String(l._id) === String(property.landlordId)) || { accountId: 'mock-landlord-1' };
        } else {
            landlordProfile = await LandlordProfile.findById(property.landlordId);
        }

        if (!landlordProfile) {
            return res.status(404).json({ message: "Landlord profile not found for this property" });
        }

        if (isMockMode()) {
            if (!mockStore.applications) mockStore.applications = [];
            const existing = mockStore.applications.find(a => String(a.propertyId) === String(propertyId) && String(a.tenantId) === String(tenantId));
            if (existing && existing.status !== 'withdrawn' && existing.status !== 'rejected') {
                return res.status(400).json({ message: "You already have an active application for this property" });
            }
        } else {
            const existingApplication = await Application.findOne({ propertyId, tenantId });
            if (existingApplication && existingApplication.status !== 'withdrawn' && existingApplication.status !== 'rejected') {
                return res.status(400).json({ message: "You already have an active application for this property" });
            }
        }

        let application;
        if (isMockMode()) {
            application = {
                _id: "mock-app-" + Date.now(),
                propertyId,
                tenantId,
                landlordId: landlordProfile.accountId,
                viewingAppointmentId,
                message,
                moveInDate,
                durationMonths,
                numberOfOccupants,
                hasPets,
                monthlyIncome,
                employmentStatus,
                supportingDocuments,
                status: 'submitted',
                history: [{ status: 'submitted', changedBy: tenantId, note: 'Application submitted', date: new Date() }],
                createdAt: new Date()
            };
            mockStore.applications.push(application);
        } else {
            application = await Application.create({
                propertyId,
                tenantId,
                landlordId: landlordProfile.accountId,
                viewingAppointmentId,
                message,
                moveInDate,
                durationMonths,
                numberOfOccupants,
                hasPets,
                monthlyIncome,
                employmentStatus,
                supportingDocuments,
                history: [{
                    status: 'submitted',
                    changedBy: tenantId,
                    note: 'Application submitted'
                }]
            });
        }

        await createNotification(
            landlordProfile.accountId,
            'application_received', // Changed from application_submitted to match enum
            'New Rental Application',
            `A new rental application has been submitted for your property: ${property.title}`,
            'Application',
            application._id
        );

        res.status(201).json({
            message: "Application submitted successfully",
            application
        });
    } catch (error) {
        console.error("Apply error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getTenantApplications = async (req, res) => {
    try {
        if (isMockMode()) {
            if (!mockStore.applications) mockStore.applications = [];
            let apps = mockStore.applications.filter(a => String(a.tenantId) === String(req.user.id));
            apps = apps.map(a => ({
                ...a,
                propertyId: Array.from(mockStore.properties || []).find(p => String(p._id) === String(a.propertyId)) || { title: "Mock Property", location: {}, rentAmount: 0 }
            }));
            return res.status(200).json(apps);
        }

        const applications = await Application.find({ tenantId: req.user.id })
            .populate('propertyId', 'title location rentAmount images')
            .sort({ createdAt: -1 });
            
        res.status(200).json(applications);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getLandlordApplications = async (req, res) => {
    try {
        const { propertyId } = req.params;

        if (isMockMode()) {
            let apps = (mockStore.applications || []).filter(a => String(a.landlordId) === String(req.user.id) && String(a.propertyId) === String(propertyId));
            apps = apps.map(a => ({
                ...a,
                tenantId: { firstName: "Mock", lastName: "Tenant", email: "mock@test.com", phone: "0911223344" }
            }));
            return res.status(200).json(apps);
        }

        const applications = await Application.find({ landlordId: req.user.id, propertyId })
            .populate('tenantId', 'firstName lastName email phone')
            .sort({ createdAt: -1 });
            
        res.status(200).json(applications);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, landlordFeedback, infoRequested } = req.body; 
        
        if (!['approved', 'rejected', 'under_review', 'info_requested'].includes(status)) {
            return res.status(400).json({ message: "Invalid status provided" });
        }

        const updateData = { status, landlordFeedback, infoRequested };
        if (status === 'approved' || status === 'rejected') {
            updateData.decidedAt = new Date();
        }
        
        // As discussed, if approved, set the ticking time bomb (48 hours)
        if (status === 'approved') {
            const expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() + 48);
            updateData.expiresAt = expirationDate;
        }

        const application = await Application.findOneAndUpdate(
            { _id: id, landlordId: req.user.id },
            { 
                ...updateData,
                $push: {
                    history: {
                        status,
                        changedBy: req.user.id,
                        note: landlordFeedback || `Status updated to ${status}`
                    }
                }
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!application) {
            return res.status(404).json({ message: "Application not found or unauthorized" });
        }

        if (status === 'approved' || status === 'rejected') {
            await createNotification(
                application.tenantId,
                `application_${status}`,
                `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                `Your application for ${application.propertyId.title} has been ${status}.`,
                'Application',
                application._id
            );
        }

        res.status(200).json({ message: `Application ${status}`, application });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const withdrawApplication = async (req, res) => {
    try {
        const { id } = req.params;
        
        const application = await Application.findOneAndUpdate(
            { _id: id, tenantId: req.user.id },
            { 
                status: 'withdrawn',
                $push: {
                    history: {
                        status: 'withdrawn',
                        changedBy: req.user.id,
                        note: 'Application withdrawn by tenant'
                    }
                }
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!application) {
            return res.status(404).json({ message: "Application not found or unauthorized" });
        }

        // Notify landlord
        await createNotification(
            application.landlordId,
            'application_withdrawn',
            'Application Withdrawn',
            `The tenant has withdrawn their application for ${application.propertyId.title}.`,
            'Application',
            application._id
        );

        res.status(200).json({ message: "Application withdrawn", application });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    applyForProperty,
    getTenantApplications,
    getLandlordApplications,
    reviewApplication,
    withdrawApplication
};
