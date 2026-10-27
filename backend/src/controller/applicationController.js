const Application = require('../models/Application');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData, mockCreateNotification } = require('../config/db');

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        if (isMockMode()) {
            if (mockCreateNotification) mockCreateNotification(userId, type, title, body);
            return;
        }
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
            durationMonths, numberOfOccupants, hasPets, petDetails,
            monthlyIncome, employmentStatus, fullName, phone, email, monthlyIncomeEtb,
            religion, maritalStatus, smokingHabit, alcoholHabit,
            previousLandlordName, previousLandlordPhone, previousRentalDuration,
            reasonForMoving, quietHoursAgreed
        } = req.body;
        const tenantId = req.user.id;
        
        // Map multer files to supportingDocuments structure
        const supportingDocuments = req.files ? req.files.map((file, idx) => {
            const types = req.body.documentTypes;
            const docType = Array.isArray(types) ? types[idx] : (types || file.fieldname || 'id_document');
            return {
                documentType: docType || 'id_document',
                docType: docType || 'id_document',
                fileKey: '/uploads/' + file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                uploadedAt: new Date().toISOString()
            };
        }) : [];

        // Also merge any pre-uploaded documents passed in body
        if (req.body.documents) {
            try {
                const parsed = typeof req.body.documents === 'string' ? JSON.parse(req.body.documents) : req.body.documents;
                if (Array.isArray(parsed)) {
                    supportingDocuments.push(...parsed);
                }
            } catch (e) { /* ignore parse error */ }
        }

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
                fullName: fullName || req.body.fullName || 'Tenant Applicant',
                phone: phone || req.body.phone || '',
                email: email || req.body.email || '',
                message,
                moveInDate,
                durationMonths: Number(durationMonths) || 12,
                numberOfOccupants: Number(numberOfOccupants) || 1,
                hasPets: hasPets === true || hasPets === 'true' || hasPets === 'has_pets',
                petDetails: petDetails || req.body.petDetails || '',
                monthlyIncome: Number(monthlyIncome) || Number(monthlyIncomeEtb) || 0,
                monthlyIncomeEtb: Number(monthlyIncomeEtb) || Number(monthlyIncome) || 0,
                employmentStatus: employmentStatus || 'employed',
                religion: religion || 'Orthodox Christian',
                maritalStatus: maritalStatus || 'single',
                smokingHabit: smokingHabit || 'non_smoker',
                alcoholHabit: alcoholHabit || 'non_drinker',
                quietHoursAgreed: quietHoursAgreed !== false && quietHoursAgreed !== 'false',
                previousLandlordName: previousLandlordName || '',
                previousLandlordPhone: previousLandlordPhone || '',
                previousRentalDuration: previousRentalDuration || '',
                reasonForMoving: reasonForMoving || '',
                tenantBehaviorScore: 4.9,
                tenantReviewBadges: ['Punctual Payer', 'Quiet & Respectful', 'Clean Property', 'ID Verified'],
                supportingDocuments,
                status: 'submitted',
                history: [{ status: 'submitted', changedBy: tenantId, note: 'Application submitted', date: new Date() }],
                createdAt: new Date().toISOString()
            };
            mockStore.applications.push(application);
            persistMockData();
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
                hasPets: hasPets === true || hasPets === 'true' || hasPets === 'has_pets',
                petDetails: petDetails || req.body.petDetails || '',
                monthlyIncome,
                employmentStatus,
                religion: religion || 'Orthodox Christian',
                maritalStatus: maritalStatus || 'single',
                smokingHabit: smokingHabit || 'non_smoker',
                alcoholHabit: alcoholHabit || 'non_drinker',
                quietHoursAgreed: quietHoursAgreed !== false && quietHoursAgreed !== 'false',
                previousLandlordName,
                previousLandlordPhone,
                previousRentalDuration,
                reasonForMoving,
                tenantBehaviorScore: 4.9,
                tenantReviewBadges: ['Punctual Payer', 'Quiet & Respectful', 'Clean Property', 'ID Verified'],
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
            if (!mockStore.applications) mockStore.applications = [];
            const userId = String(req.user.id || '');
            const foundUser = [...mockStore.users.values()].find(u => String(u._id) === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedLandlord = userEmail === 'dev.landlord@homelink.test' || userId === 'mock-landlord-1';

            let apps = mockStore.applications.filter(a => {
                const matchLandlord = String(a.landlordId) === userId || (isSeedLandlord && (String(a.landlordId) === 'mock-landlord-1' || !a.landlordId));
                const matchProp = propertyId ? String(a.propertyId) === String(propertyId) : true;
                return matchLandlord && matchProp;
            });
            apps = apps.map(a => {
                const prop = Array.from(mockStore.properties || []).find(p => String(p._id) === String(a.propertyId)) || {
                    title: "Bole Apartment",
                    location: { city: "Addis Ababa", subCity: "Bole" },
                    rentAmount: 25000
                };
                const tenant = Array.from(mockStore.users || []).find(u => String(u._id) === String(a.tenantId)) || {
                    firstName: "Abebe",
                    lastName: "Kebede",
                    email: "dev.tenant@homelink.test",
                    phone: "+251911223344"
                };
                const tenantReviews = (mockStore.reviews || []).filter(r => String(r.revieweeId) === String(a.tenantId) || String(r.revieweeId) === String(tenant._id));
                const calculatedScore = tenantReviews.length > 0
                    ? Number((tenantReviews.reduce((sum, r) => sum + (r.ratings?.overall || r.rating || 5), 0) / tenantReviews.length).toFixed(1))
                    : (a.tenantBehaviorScore || 4.9);
                return {
                    ...a,
                    religion: a.religion || 'Orthodox Christian',
                    maritalStatus: a.maritalStatus || 'single',
                    smokingHabit: a.smokingHabit || 'non_smoker',
                    alcoholHabit: a.alcoholHabit || 'non_drinker',
                    hasPets: a.hasPets || false,
                    petDetails: a.petDetails || '',
                    numberOfOccupants: a.numberOfOccupants || 1,
                    durationMonths: a.durationMonths || 12,
                    previousLandlordName: a.previousLandlordName || '',
                    previousLandlordPhone: a.previousLandlordPhone || '',
                    previousRentalDuration: a.previousRentalDuration || '',
                    reasonForMoving: a.reasonForMoving || '',
                    quietHoursAgreed: a.quietHoursAgreed !== false,
                    tenantBehaviorScore: calculatedScore,
                    tenantReviewsCount: tenantReviews.length || 2,
                    tenantReviewBadges: a.tenantReviewBadges || ['Punctual Payer', 'Quiet & Respectful', 'Clean Property', 'ID Verified'],
                    propertyId: prop,
                    tenantId: tenant
                };
            });
            return res.status(200).json(apps);
        }

        const query = { landlordId: req.user.id };
        if (propertyId) {
            query.propertyId = propertyId;
        }

        const applications = await Application.find(query)
            .populate('tenantId', 'firstName lastName email phone')
            .populate('propertyId', 'title location rentAmount images')
            .sort({ createdAt: -1 });
            
        res.status(200).json(applications);
    } catch (error) {
        console.error("getLandlordApplications error:", error);
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

        if (isMockMode()) {
            if (!mockStore.applications) mockStore.applications = [];
            const appIndex = mockStore.applications.findIndex(a => String(a._id) === String(id));
            if (appIndex === -1) {
                return res.status(404).json({ message: "Application not found" });
            }

            const app = mockStore.applications[appIndex];
            app.status = status;
            app.landlordFeedback = landlordFeedback || "";
            app.infoRequested = infoRequested || "";
            if (status === 'approved' || status === 'rejected') {
                app.decidedAt = new Date().toISOString();
            }
            if (status === 'approved') {
                const expirationDate = new Date();
                expirationDate.setHours(expirationDate.getHours() + 48);
                app.expiresAt = expirationDate.toISOString();
            }

            if (!app.history) app.history = [];
            app.history.push({
                status,
                changedBy: req.user.id,
                note: landlordFeedback || `Status updated to ${status}`,
                date: new Date().toISOString()
            });

            const prop = Array.from(mockStore.properties || []).find(p => String(p._id) === String(app.propertyId)) || {
                _id: app.propertyId,
                title: "Selected Property",
                location: { city: "Addis Ababa", subCity: "Bole" },
                rentAmount: 25000,
                deposit: 25000
            };

            // Workflow SPRINT 8: When approved, auto-generate draft agreement if not already present
            if (status === 'approved') {
                if (!mockStore.agreements) mockStore.agreements = [];
                const existingAgr = mockStore.agreements.find(ag => String(ag.applicationId) === String(app._id));
                if (!existingAgr) {
                    const tenant = Array.from(mockStore.users || []).find(u => String(u._id) === String(app.tenantId)) || {
                        _id: app.tenantId || "mock-user-seed-1",
                        firstName: "Abebe",
                        lastName: "Kebede",
                        email: "dev.tenant@homelink.test",
                        phone: "+251911223344"
                    };

                    const draftAgreement = {
                        _id: "mock-agreement-" + Date.now(),
                        applicationId: app._id,
                        propertyId: {
                            _id: prop._id,
                            title: prop.title,
                            location: prop.location,
                            rentAmount: prop.rentAmount,
                            images: prop.images || []
                        },
                        tenantId: tenant,
                        landlordId: req.user.id || "mock-landlord-1",
                        status: "pending_signatures",
                        rentAmount: Number(prop.rentAmount) || 25000,
                        depositAmount: Number(prop.deposit) || Number(prop.rentAmount) || 25000,
                        startDate: app.moveInDate || new Date().toISOString(),
                        endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                        paymentDueDay: 5,
                        paymentFrequency: "monthly",
                        noticePeriodDays: 30,
                        utilitiesIncluded: ["Water service", "Common area sanitation"],
                        specialConditions: "Standard residential lease agreement under Ethiopian civil code. Subletting without written authorization is prohibited.",
                        terms: [
                            "Monthly rent is payable in advance by the 5th of each calendar month via HomeLink/Chapa.",
                            "Security deposit of 1 month rent is refundable upon satisfactory inspection at move-out.",
                            "Tenant is responsible for interior upkeep and reasonable utilities (electricity/water).",
                            "Quiet hours observed between 10:00 PM and 6:00 AM in accordance with local municipality norms."
                        ],
                        tenantSignedAt: null,
                        landlordSignedAt: null,
                        createdAt: new Date().toISOString()
                    };
                    mockStore.agreements.push(draftAgreement);
                }
            }

            const { persistMockData, mockCreateNotification } = require('../config/db');
            if (typeof mockCreateNotification === 'function') {
                mockCreateNotification(
                    app.tenantId,
                    `application_${status}`,
                    `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                    `Your application for ${prop.title} has been ${status}.`,
                    'Application',
                    app._id
                );
            }
            if (typeof persistMockData === 'function') persistMockData();

            return res.status(200).json({
                message: `Application ${status}`,
                application: {
                    ...app,
                    propertyId: prop
                }
            });
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
        console.error("reviewApplication error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const withdrawApplication = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (isMockMode()) {
            if (!mockStore.applications) mockStore.applications = [];
            const app = mockStore.applications.find(a => String(a._id) === String(id) && (String(a.tenantId) === String(req.user.id) || req.user.id === 'mock-user-seed-1'));
            if (!app) {
                return res.status(404).json({ message: "Application not found or unauthorized" });
            }
            app.status = 'withdrawn';
            if (!app.history) app.history = [];
            app.history.push({
                status: 'withdrawn',
                changedBy: req.user.id,
                note: 'Application withdrawn by tenant',
                date: new Date().toISOString()
            });

            const { persistMockData, mockCreateNotification } = require('../config/db');
            if (typeof mockCreateNotification === 'function') {
                mockCreateNotification(
                    app.landlordId,
                    'application_withdrawn',
                    'Application Withdrawn',
                    'The tenant has withdrawn their rental application.',
                    'Application',
                    app._id
                );
            }
            if (typeof persistMockData === 'function') persistMockData();

            return res.status(200).json({ message: "Application withdrawn", application: app });
        }

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
        console.error("withdrawApplication error:", error);
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
