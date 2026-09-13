const Application = require('../models/Application');
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

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        const landlordProfile = await LandlordProfile.findById(property.landlordId);
        if (!landlordProfile) {
            return res.status(404).json({ message: "Landlord profile not found for this property" });
        }

        const existingApplication = await Application.findOne({ propertyId, tenantId });
        if (existingApplication && existingApplication.status !== 'withdrawn' && existingApplication.status !== 'rejected') {
            return res.status(400).json({ message: "You already have an active application for this property" });
        }

        const application = await Application.create({
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

module.exports = {
    applyForProperty,
    getTenantApplications,
    getLandlordApplications,
    reviewApplication
};
