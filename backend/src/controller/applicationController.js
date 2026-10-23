const Application = require('../models/Application');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');
const { STANDARD_RENTAL_TERMS } = require('../utils/rentalTerms');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

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

const mapUploadedDocuments = (files, body = {}) => {
    if (!files || !Array.isArray(files) || files.length === 0) return [];
    return files.map((file, idx) => {
        const rawType = String(body[`docType_${idx}`] || body[`docType_${file.fieldname}`] || file.fieldname || 'general').toLowerCase();
        let category = 'Additional Document';
        let docKey = 'additional_doc';

        if (rawType.includes('id') || file.fieldname.includes('id') || file.fieldname.includes('government') || file.fieldname.includes('kebele')) {
            category = 'Government ID (Kebele / Fayda / Passport)';
            docKey = 'government_id';
        } else if (rawType.includes('income') || rawType.includes('employment') || file.fieldname.includes('income') || file.fieldname.includes('pay') || file.fieldname.includes('work')) {
            category = 'Proof of Income / Employment';
            docKey = 'proof_of_income';
        } else if (rawType.includes('bank') || rawType.includes('financial') || file.fieldname.includes('bank') || file.fieldname.includes('cbe')) {
            category = 'Bank Statement / Proof of Funds';
            docKey = 'bank_statement';
        }

        const normPath = '/uploads/' + file.filename;
        return {
            name: file.originalname,
            originalName: file.originalname,
            filename: file.filename,
            fileKey: normPath,
            url: normPath,
            documentType: docKey,
            type: category,
            mimeType: file.mimetype,
            size: (file.size / 1024).toFixed(1) + ' KB',
            uploadedAt: new Date().toISOString()
        };
    });
};

const applyForProperty = async (req, res) => {
    try {
        const { 
            propertyId, viewingAppointmentId, message, moveInDate, 
            durationMonths, numberOfOccupants, hasPets, 
            monthlyIncome, monthlyIncomeEtb, employmentStatus,
            fullName, phone, email, note, emergencyContact
        } = req.body || {};
        const tenantId = req.user.id;
        const uploadedDocs = mapUploadedDocuments(req.files, req.body);

        // Mock DB: persist the application with real uploaded documents
        if (isMockMode()) {
            const mockProperty = (mockStore.properties || []).find((pr) => pr._id === propertyId);
            const userObj = mockStore.users.get(tenantId) || req.user || {};

            // Check if tenant already has an active application for this property
            const existing = (mockStore.applications || []).find((a) => {
                const pId = String(typeof a.propertyId === 'object' ? a.propertyId._id : a.propertyId || '');
                const tId = String(typeof a.tenantId === 'object' ? a.tenantId._id : a.tenantId || '');
                return pId === String(propertyId) && tId === String(tenantId) && !['withdrawn', 'rejected'].includes(a.status);
            });
            if (existing) {
                return res.status(400).json({ message: "You already have an active application for this property" });
            }

            const finalFullName = (fullName && String(fullName).trim()) || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || 'Tenant Applicant';
            const finalPhone = (phone && String(phone).trim()) || userObj.phone || '';
            const finalEmail = (email && String(email).trim()) || userObj.email || '';
            const nameParts = finalFullName.split(' ');
            const fName = nameParts[0] || 'Tenant';
            const lName = nameParts.slice(1).join(' ') || '';

            const application = {
                _id: "mock-application-" + Date.now(),
                propertyId: mockProperty
                    ? { _id: mockProperty._id, title: mockProperty.title, rentAmount: mockProperty.rentAmount, location: mockProperty.location, images: mockProperty.images }
                    : { _id: propertyId || "", title: "Property" },
                tenantId: {
                    _id: tenantId,
                    firstName: fName,
                    lastName: lName,
                    email: finalEmail,
                    phone: finalPhone
                },
                landlordId: mockProperty ? (typeof mockProperty.landlordId === 'object' ? mockProperty.landlordId._id : mockProperty.landlordId) : "mock-landlord-1",
                status: "under_review",
                fullName: finalFullName,
                phone: finalPhone,
                email: finalEmail,
                employmentStatus: employmentStatus || "employed",
                monthlyIncome: Number(monthlyIncome || monthlyIncomeEtb || 0),
                monthlyIncomeEtb: Number(monthlyIncome || monthlyIncomeEtb || 0),
                moveInDate: moveInDate || null,
                durationMonths: Number(durationMonths || 12),
                numberOfOccupants: Number(numberOfOccupants || 1),
                hasPets: Boolean(hasPets),
                emergencyContact: emergencyContact || "",
                message: message || note || "",
                note: note || message || "",
                documents: uploadedDocs,
                supportingDocuments: uploadedDocs,
                createdAt: new Date().toISOString(),
            };
            mockStore.applications.push(application);
            if (typeof persistMockData === 'function') persistMockData();
            // (sprint567-notify) spec: landlord notified on application received
            createNotification(application.landlordId, 'application_received', 'New Application', `A tenant applied for your property: ${mockProperty?.title || 'Property'}.`, 'Application', application._id);
            return res.status(201).json({ message: "Application submitted", data: application });
        }

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

        const finalFullName = (fullName && String(fullName).trim()) || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || '';
        const finalPhone = (phone && String(phone).trim()) || req.user?.phone || '';
        const finalEmail = (email && String(email).trim()) || req.user?.email || '';

        const application = await Application.create({
            propertyId,
            tenantId,
            landlordId: landlordProfile.accountId,
            viewingAppointmentId,
            fullName: finalFullName,
            phone: finalPhone,
            email: finalEmail,
            emergencyContact: emergencyContact || '',
            message: message || note,
            moveInDate,
            durationMonths,
            numberOfOccupants: Number(numberOfOccupants || 1),
            hasPets,
            monthlyIncome: Number(monthlyIncome || monthlyIncomeEtb || 0),
            employmentStatus,
            supportingDocuments: uploadedDocs,
            documents: uploadedDocs,
            history: [{
                status: 'submitted',
                changedBy: tenantId,
                note: 'Application submitted'
            }]
        });

        await createNotification(
            landlordProfile.accountId,
            'application_received',
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
            const userId = String(req.user.id || '');
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userEmail === 'hanna@example.com';
            const rows = (mockStore.applications || []).filter((app) => {
                const tId = String((app.tenantId && typeof app.tenantId === 'object' ? app.tenantId._id : app.tenantId) || '');
                return tId === userId || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId));
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.status(200).json(rows);
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
        if (isMockMode()) {
            const userId = String(req.user.id || '');
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedLandlord = userEmail === 'dev.landlord@homelink.test';
            const { propertyId } = req.params;
            const rows = (mockStore.applications || []).filter((app) => {
                const lId = String((app.landlordId && typeof app.landlordId === 'object' ? app.landlordId._id : app.landlordId) || '');
                const pId = String((app.propertyId && typeof app.propertyId === 'object' ? app.propertyId._id : app.propertyId) || '');
                const matchesLandlord = lId === userId || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId));
                const matchesProp = !propertyId || pId === propertyId;
                return matchesLandlord && matchesProp;
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.status(200).json(rows);
        }
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

        // Sprint 15: mock-mode review — mutate the in-memory application.
        if (isMockMode()) {
            const app2 = (mockStore.applications || []).find((x) => x._id === id);
            if (!app2) return res.status(404).json({ message: "Application not found" });
            app2.status = status;
            if (landlordFeedback) app2.landlordFeedback = landlordFeedback;
            if (status === 'approved' || status === 'rejected') app2.decidedAt = new Date().toISOString();

            // Sprint 8 workflow: Application approved → Digital agreement record created
            let agreement = null;
            if (status === 'approved') {
                mockStore.agreements = mockStore.agreements || [];
                agreement = mockStore.agreements.find((a) => a.applicationId === id);
                if (!agreement) {
                    const propId = typeof app2.propertyId === 'object' ? app2.propertyId._id : app2.propertyId;
                    const prop = (mockStore.properties || []).find((p) => p._id === propId) || (typeof app2.propertyId === 'object' ? app2.propertyId : {});
                    const rentAmount = Number(prop.rentAmount || app2.monthlyIncomeEtb || 15000);
                    const depositAmount = Number(prop.depositAmount || rentAmount);
                    const startDate = app2.moveInDate || new Date().toISOString();
                    const durationMonths = Number(app2.durationMonths) || 12;
                    const endDate = new Date(new Date(startDate).getTime() + durationMonths * 30 * 24 * 3600 * 1000).toISOString();

                    agreement = {
                        _id: "mock-agreement-" + Date.now(),
                        applicationId: id,
                        propertyId: prop._id ? { _id: prop._id, title: prop.title, location: prop.location, rentAmount, images: prop.images } : { _id: propId, title: "Rental Property", rentAmount },
                        tenantId: typeof app2.tenantId === 'object' ? app2.tenantId : { _id: app2.tenantId, firstName: app2.fullName || "Tenant", email: app2.email || "", phone: app2.phone || "" },
                        landlordId: req.user?.id || app2.landlordId || "mock-landlord-1",
                        status: "pending_signatures",
                        rentAmount,
                        depositAmount,
                        startDate,
                        endDate,
                        paymentDueDay: 5,
                        paymentFrequency: "monthly",
                        terms: STANDARD_RENTAL_TERMS,
                        specialConditions: app2.message || "Standard residential lease agreement under Ethiopian law.",
                        tenantSignedAt: null,
                        landlordSignedAt: null, // Workflow step: Landlord confirms next!
                        createdAt: new Date().toISOString(),
                    };
                    mockStore.agreements.push(agreement);
                }

                // Notify Landlord to confirm
                createNotification(
                    req.user.id,
                    'agreement_ready',
                    'Digital Agreement Created',
                    'A digital rental agreement has been created. Please review terms and confirm your signature in Agreements.',
                    'RentalAgreement',
                    agreement._id
                );
            }

            // (sprint567-notify) spec: tenant notified on application accept/reject
            createNotification((typeof app2.tenantId === 'object' ? app2.tenantId._id : app2.tenantId),
                status === 'approved' ? 'application_approved' : 'application_rejected',
                'Application ' + (status === 'approved' ? 'Approved' : 'Rejected'),
                status === 'approved' 
                    ? 'Congratulations! Your application was approved. The digital rental agreement is being prepared for your review.' 
                    : 'Your application was rejected by the landlord.',
                'Application', app2._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Application " + status, data: app2, agreement });
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
        ).populate('propertyId');

        if (!application) {
            return res.status(404).json({ message: "Application not found or unauthorized" });
        }

        // Sprint 8: Automatically generate the RentalAgreement upon application approval
        let agreement = null;
        if (status === 'approved') {
            const prop = application.propertyId;
            const rentAmount = Number((prop && prop.rentAmount) || 15000);
            const depositAmount = Number((prop && prop.deposit) || rentAmount);
            const startDate = application.moveInDate || new Date();
            const durationMonths = Number(application.durationMonths) || 12;
            const endDate = new Date(new Date(startDate).getTime() + durationMonths * 30 * 24 * 3600 * 1000);

            agreement = await RentalAgreement.findOne({ applicationId: application._id });
            if (!agreement) {
                agreement = await RentalAgreement.create({
                    applicationId: application._id,
                    propertyId: prop._id,
                    tenantId: application.tenantId,
                    landlordId: req.user.id,
                    status: "pending_signatures",
                    rentAmount,
                    depositAmount,
                    startDate,
                    endDate,
                    paymentDueDay: 5,
                    paymentFrequency: "monthly",
                    terms: STANDARD_RENTAL_TERMS,
                    specialConditions: application.message || "Standard residential lease agreement under Ethiopian law.",
                    tenantSignedAt: null,
                    landlordSignedAt: null, // Landlord confirms next!
                });
            }

            // Notify Landlord to review and confirm
            await createNotification(
                req.user.id,
                'agreement_ready',
                'Digital Agreement Created',
                `A digital rental agreement for ${prop.title} is ready. Please review terms and confirm your signature.`,
                'RentalAgreement',
                agreement._id
            );
        }

        if (status === 'approved' || status === 'rejected') {
            await createNotification(
                application.tenantId,
                `application_${status}`,
                `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                status === 'approved'
                    ? `Your application for ${application.propertyId.title} has been approved! The rental agreement has been created.`
                    : `Your application for ${application.propertyId.title} has been rejected.`,
                'Application',
                application._id
            );
        }

        res.status(200).json({ message: `Application ${status}`, application, agreement });
    } catch (error) {
        console.error("reviewApplication error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const withdrawApplication = async (req, res) => {
    try {
        const { id } = req.params;

        // (sprint567-withdraw) tenant withdraw without a DB
        if (isMockMode()) {
            const appW = (mockStore.applications || []).find((x) => x._id === id && (typeof x.tenantId === 'object' ? x.tenantId._id : x.tenantId) === req.user.id);
            if (!appW) return res.status(404).json({ message: "Application not found or unauthorized" });
            appW.status = 'withdrawn';
            appW.decidedAt = new Date().toISOString();
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Application withdrawn", data: appW });
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
