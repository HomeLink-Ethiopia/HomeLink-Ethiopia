const PropertyVerification = require('../models/PropertyVerification');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Account = require('../models/Account');
const { isMockMode, mockStore, pushMockAudit } = require('../config/db');

// Sprint 3: Landlord identity document upload
const submitIdentityVerification = async (req, res) => {
    try {
        const userId = req.user.id;
        const files = req.files || [];
        let docTypes = [];
        if (req.body.docTypes) {
            try {
                docTypes = typeof req.body.docTypes === 'string' ? JSON.parse(req.body.docTypes) : req.body.docTypes;
            } catch (e) {
                docTypes = [req.body.docTypes];
            }
        }

        const uploadedDocs = files.map((file, idx) => ({
            docType: docTypes[idx] || 'kebele_id',
            fileKey: `/uploads/${file.filename}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString()
        }));

        if (isMockMode()) {
            let profile = (mockStore.landlordProfiles || new Map()).get(userId);
            if (!profile) {
                profile = [...(mockStore.landlordProfiles || new Map()).values()].find((p) => {
                    const accId = p.accountId && typeof p.accountId === 'object' ? p.accountId._id : p.accountId;
                    return accId === userId || p._id === userId;
                });
            }
            if (!profile) {
                profile = {
                    _id: 'mock-landlord-' + userId,
                    accountId: { _id: userId, email: req.user.email, phone: req.user.phone },
                    legalName: ((req.user.firstName || '') + ' ' + (req.user.lastName || '')).trim() || 'Landlord',
                    phone: req.user.phone || '',
                    verificationStatus: 'pending',
                    submittedDocuments: [],
                    auditTrail: [],
                    createdAt: new Date().toISOString()
                };
                mockStore.landlordProfiles.set(userId, profile);
            }
            profile.verificationStatus = 'pending';
            profile.rejectionReason = undefined;
            profile.submittedDocuments = uploadedDocs.length > 0 ? uploadedDocs : (profile.submittedDocuments || []);
            const adminName = ((req.user && req.user.firstName) || 'Landlord') + ' ' + ((req.user && req.user.lastName) || '');
            (profile.auditTrail = profile.auditTrail || []).push({
                action: 'IDENTITY_DOCUMENTS_SUBMITTED',
                performedByName: adminName.trim(),
                notes: `Submitted ${uploadedDocs.length} identity document(s) for verification`,
                timestamp: new Date().toISOString(),
            });
            pushMockAudit(req, 'landlord.submitted_identity', 'landlord', profile.legalName, 'unverified', 'pending', 'Submitted identity documents');
            return res.status(201).json({
                message: 'Identity documents submitted successfully. Awaiting admin review.',
                data: { profile }
            });
        }

        let landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            landlordProfile = await LandlordProfile.create({
                accountId: userId,
                legalName: ((req.user.firstName || '') + ' ' + (req.user.lastName || '')).trim() || 'Landlord',
                verificationStatus: 'pending',
                submittedDocuments: uploadedDocs,
                auditTrail: [{
                    action: 'IDENTITY_DOCUMENTS_SUBMITTED',
                    performedByName: ((req.user.firstName || '') + ' ' + (req.user.lastName || '')).trim() || 'Landlord',
                    notes: `Submitted ${uploadedDocs.length} identity document(s) for verification`,
                    timestamp: new Date()
                }]
            });
        } else {
            landlordProfile.verificationStatus = 'pending';
            landlordProfile.rejectionReason = undefined;
            if (uploadedDocs.length > 0) {
                landlordProfile.submittedDocuments = uploadedDocs;
            }
            landlordProfile.auditTrail = landlordProfile.auditTrail || [];
            landlordProfile.auditTrail.push({
                action: 'IDENTITY_DOCUMENTS_SUBMITTED',
                performedByName: landlordProfile.legalName,
                notes: `Submitted ${uploadedDocs.length} identity document(s) for verification`,
                timestamp: new Date()
            });
            await landlordProfile.save();
        }

        return res.status(201).json({
            message: 'Identity documents submitted successfully. Awaiting admin review.',
            data: { profile: landlordProfile }
        });
    } catch (error) {
        console.error('Submit identity verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Property verification
const submitVerification = async (req, res) => {
    try {
        if (isMockMode()) {
            const { propertyId } = req.body || {};
            let documents = req.body && req.body.documents;
            if (req.files && req.files.length > 0) {
                let docTypes = [];
                if (req.body.docTypes) {
                    try {
                        docTypes = typeof req.body.docTypes === 'string' ? JSON.parse(req.body.docTypes) : req.body.docTypes;
                    } catch (e) {
                        docTypes = [req.body.docTypes];
                    }
                }
                documents = req.files.map((file, idx) => ({
                    docType: docTypes[idx] || 'property_photos',
                    fileKey: `/uploads/${file.filename}`,
                    originalName: file.originalname,
                    name: file.originalname,
                    mimeType: file.mimetype,
                    uploadedAt: new Date().toISOString()
                }));
            }
            const prop = (mockStore.properties || []).find((pr) => pr._id === propertyId);
            if (!prop) return res.status(404).json({ message: 'Property not found' });
            const ownerId = typeof prop.landlordId === 'object' ? prop.landlordId._id || prop.landlordId.accountId : prop.landlordId;
            const profile = (mockStore.landlordProfiles || new Map()).get(req.user.id);
            const userProfId = profile ? profile._id : req.user.id;
            const foundUser = [...(mockStore.users || new Map()).values()].find(u => u._id === req.user.id);
            const isSeedLandlord = (req.user?.email || foundUser?.email) === 'dev.landlord@homelink.test';
            const isOwner = (ownerId === userProfId || ownerId === req.user.id || (isSeedLandlord && (ownerId === 'mock-landlord-1' || !ownerId)));
            if (!isOwner) {
                return res.status(403).json({ message: 'You do not own this property' });
            }
            const existing = (mockStore.propertyVerifications || []).find(
                (v) => String(v.propertyId && (v.propertyId._id || v.propertyId)) === String(propertyId) && !["verified", "rejected", "suspended"].includes(v.status)
            );
            if (existing) return res.status(400).json({ message: 'A verification request for this property is already pending review.' });
            const v = {
                _id: "mock-propver-" + Date.now(),
                propertyId: { _id: prop._id, title: prop.title, address: prop.location ? [prop.location.subCity, prop.location.city].filter(Boolean).join(", ") : "", price: prop.rentAmount },
                landlordProfileId: { _id: profile ? profile._id : req.user.id, legalName: profile ? profile.legalName : ((req.user.firstName || "") + " " + (req.user.lastName || "")).trim(), phone: profile ? profile.phone : "" },
                status: "submitted",
                submittedDocuments: (documents || []).map((d) => ({
                    fileKey: d.fileKey || "",
                    docType: d.docType || d.documentType || "property_photos",
                    originalName: d.originalName || d.name || "document",
                    name: d.name || d.originalName || "document",
                    mimeType: d.mimeType || "image/jpeg",
                    uploadedAt: d.uploadedAt || new Date().toISOString()
                })),
                reviewNotes: "",
                rejectionReason: "",
                auditTrail: [{
                    action: 'SUBMITTED',
                    performedByName: profile ? profile.legalName : ((req.user.firstName || "") + " " + (req.user.lastName || "")).trim(),
                    notes: 'Landlord submitted property for verification',
                    timestamp: new Date().toISOString()
                }],
                createdAt: new Date().toISOString(),
            };
            (mockStore.propertyVerifications = mockStore.propertyVerifications || []).push(v);
            prop.verificationStatus = 'pending';
            pushMockAudit(req, 'property.submitted_verification', 'property', prop.title, 'unverified', 'pending', 'Submitted for verification');
            return res.status(201).json({
                message: "Property verification submitted successfully. Awaiting admin review.",
                data: { id: v._id, status: v.status, propertyId: v.propertyId, submittedAt: v.createdAt },
            });
        }
        const userId = req.user.id;
        const { propertyId, documents } = req.body;

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        if (property.landlordId && !property.landlordId.equals(landlordProfile._id)) {
            return res.status(403).json({ message: 'You do not own this property' });
        }

        const existing = await PropertyVerification.findOne({
            propertyId,
            status: { $in: ['submitted', 'under_review'] }
        });

        if (existing) {
            return res.status(400).json({
                message: 'This property already has a pending verification request'
            });
        }

        let parsedDocuments = [];
        if (req.files && req.files.length > 0) {
            let docTypes = [];
            if (req.body.docTypes) {
                try {
                    docTypes = typeof req.body.docTypes === 'string' ? JSON.parse(req.body.docTypes) : req.body.docTypes;
                } catch (e) {
                    docTypes = [req.body.docTypes];
                }
            }
            parsedDocuments = req.files.map((file, idx) => ({
                docType: docTypes[idx] || 'property_photos',
                fileKey: `/uploads/${file.filename}`,
                originalName: file.originalname,
                name: file.originalname,
                mimeType: file.mimetype,
                uploadedAt: new Date()
            }));
        } else if (Array.isArray(documents)) {
            parsedDocuments = documents;
        } else
        if (typeof documents === 'string') {
            try {
                parsedDocuments = JSON.parse(documents);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid documents format' });
            }
        }

        const verification = await PropertyVerification.create({
            propertyId,
            landlordProfileId: landlordProfile._id,
            status: 'submitted',
            submittedDocuments: parsedDocuments.map(doc => ({
                docType: doc.docType,
                fileKey: doc.fileKey || '',
                uploadedAt: new Date()
            })),
            auditTrail: [{
                action: 'SUBMITTED',
                performedBy: userId,
                notes: 'Landlord submitted property for verification'
            }]
        });

        await Property.findByIdAndUpdate(propertyId, {
            verificationStatus: 'pending'
        });

        res.status(201).json({
            message: 'Property verification submitted successfully. Awaiting admin review.',
            data: {
                id: verification._id,
                status: verification.status,
                propertyId: verification.propertyId,
                submittedAt: verification.createdAt
            }
        });

    } catch (error) {
        console.error('Submit verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getVerificationStatus = async (req, res) => {
    try {
        // Sprint 15: mock-mode status — my property-verification requests.
        if (isMockMode()) {
            const mine = (mockStore.propertyVerifications || []).filter((v) => {
                const prof = v.landlordProfileId;
                return (prof && (prof._id === req.user.id || prof.accountId === req.user.id)) || v.submittedBy === req.user.id;
            });
            let profile = (mockStore.landlordProfiles || new Map()).get(req.user.id);
            if (!profile) {
                profile = [...(mockStore.landlordProfiles || new Map()).values()].find((p) => {
                    const accId = p.accountId && typeof p.accountId === 'object' ? p.accountId._id : p.accountId;
                    return accId === req.user.id || p._id === req.user.id;
                });
            }
            if (!profile) {
                profile = {
                    _id: "mock-landlord-" + req.user.id,
                    accountId: { _id: req.user.id, email: req.user.email, phone: req.user.phone },
                    legalName: ((req.user.firstName || '') + ' ' + (req.user.lastName || '')).trim() || 'HomeLink Landlord',
                    verificationStatus: 'unverified',
                    submittedDocuments: [],
                    auditTrail: []
                };
                mockStore.landlordProfiles.set(req.user.id, profile);
            }
            if (req.query.format === 'details') {
                return res.status(200).json({ data: { profile, verifications: mine } });
            }
            return res.status(200).json({ data: mine, profile, verifications: mine });
        }
        const userId = req.user.id;

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        const verifications = await PropertyVerification.find({
            landlordProfileId: landlordProfile._id
        }).populate('propertyId', 'title address price');

        const mappedVers = (verifications || []).map(v => ({
            id: v._id,
            property: v.propertyId,
            status: v.status,
            submittedDocuments: v.submittedDocuments,
            submittedAt: v.createdAt,
            reviewedAt: v.verifiedAt,
            rejectionReason: v.rejectionReason,
            auditTrail: v.auditTrail
        }));

        if (req.query.format === 'details') {
            return res.status(200).json({
                data: {
                    profile: landlordProfile,
                    verifications: mappedVers
                }
            });
        }

        res.status(200).json({
            data: mappedVers,
            profile: landlordProfile,
            verifications: mappedVers
        });

    } catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPendingVerifications = async (req, res) => {
    try {
        if (isMockMode()) {
            const landlords = [...(mockStore.landlordProfiles || new Map()).values()].map((p) => ({
                ...p,
                accountId: p.accountId && typeof p.accountId === 'object' ? p.accountId : { _id: p.accountId },
            }));
            const properties = mockStore.propertyVerifications || [];
            return res.status(200).json({ data: { landlords, properties } });
        }
        const { status } = req.query;

        const query = status
            ? { status }
            : { status: { $in: ['submitted', 'under_review'] } };

        const verifications = await PropertyVerification.find(query)
            .populate('propertyId', 'title address price images')
            .populate('landlordProfileId', 'legalName phone address')
            .populate('reviewedBy', 'userId')
            .sort({ createdAt: -1 });

        const landlords = await LandlordProfile.find({})
            .populate('accountId', 'email phone firstName lastName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            data: {
                landlords,
                properties: verifications
            }
        });

    } catch (error) {
        console.error('Get pending verifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const reviewVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewNotes, rejectionReason } = req.body;
        const adminName = ((req.user && req.user.firstName) || 'Admin') + ' ' + ((req.user && req.user.lastName) || '');
        if (isMockMode()) {
            const validStatuses = ['verified', 'rejected', 'more_info_needed', 'suspended'];
            if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Status must be one of: ' + validStatuses.join(', ') });
            const v = (mockStore.propertyVerifications || []).find((x) => x._id === id);
            if (!v) return res.status(404).json({ message: 'Verification request not found' });
            const from = v.status;
            v.status = status;
            v.reviewNotes = reviewNotes || req.body.reason || '';
            v.reviewedBy = req.user.id;
            if (status === 'verified') v.verifiedAt = new Date().toISOString();
            if (status === 'rejected' && (rejectionReason || req.body.reason)) v.rejectionReason = rejectionReason || req.body.reason;
            (v.auditTrail = v.auditTrail || []).push({
                action: 'STATUS_CHANGED_TO_' + status.toUpperCase(),
                performedByName: adminName.trim(),
                notes: reviewNotes || rejectionReason || req.body.reason || ('Admin ' + status + ' the verification request'),
                timestamp: new Date().toISOString(),
            });
            const propId = v.propertyId && (v.propertyId._id || v.propertyId);
            const prop = (mockStore.properties || []).find((p) => p._id === propId);
            if (prop) prop.verificationStatus = status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : status === 'suspended' ? 'suspended' : 'pending';
            pushMockAudit(req, 'property.' + status, 'property', (v.propertyId && v.propertyId.title) || 'Property', from, status, rejectionReason || reviewNotes || req.body.reason || '');
            return res.status(200).json({ message: 'Verification ' + status + ' successfully', data: { id: v._id, status: v.status } });
        }
                const adminId = req.user.id;

        const validStatuses = ['verified', 'rejected', 'more_info_needed', 'suspended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const verification = await PropertyVerification.findById(id);

        if (!verification) {
            return res.status(404).json({ message: 'Verification request not found' });
        }

        if (['verified', 'rejected', 'suspended'].includes(verification.status)) {
            return res.status(400).json({
                message: `This request has already been ${verification.status}`
            });
        }

        const adminAccount = await Account.findOne({ _id: adminId });
        if (!adminAccount) {
            const fromStatus = verification.status;
            verification.status = status;
            verification.reviewedBy = adminId;
            verification.reviewNotes = reviewNotes;
            if (status === 'verified') verification.verifiedAt = new Date();
            if (status === 'rejected' && rejectionReason) verification.rejectionReason = rejectionReason;

            verification.auditTrail.push({
                action: `STATUS_CHANGED_TO_${status.toUpperCase()}`,
                performedBy: adminId,
                notes: reviewNotes || `Admin ${status} the verification request`
            });

            await verification.save();

            let propertyStatus = 'pending';
            if (status === 'verified') propertyStatus = 'verified';
            else if (status === 'rejected') propertyStatus = 'rejected';
            else if (status === 'suspended') propertyStatus = 'suspended';

            await Property.findByIdAndUpdate(verification.propertyId, {
                verificationStatus: propertyStatus
            });

            return res.status(200).json({
                message: `Verification ${status} successfully`,
                data: {
                    id: verification._id,
                    status: verification.status
                }
            });
        }

        const fromStatus = verification.status;
        verification.status = status;
        verification.reviewedBy = adminAccount._id;
        verification.reviewNotes = reviewNotes;

        if (status === 'verified') {
            verification.verifiedAt = new Date();
        }

        if (status === 'rejected' && rejectionReason) {
            verification.rejectionReason = rejectionReason;
        }

        verification.auditTrail.push({
            action: `STATUS_CHANGED_TO_${status.toUpperCase()}`,
            performedBy: adminAccount._id,
            notes: reviewNotes || `Admin ${status} the verification request`
        });

        await verification.save();

        let propertyStatus = 'pending';
        if (status === 'verified') propertyStatus = 'verified';
        else if (status === 'rejected') propertyStatus = 'rejected';
        else if (status === 'suspended') propertyStatus = 'suspended';

        await Property.findByIdAndUpdate(verification.propertyId, {
            verificationStatus: propertyStatus
        });

        res.status(200).json({
            message: `Verification ${status} successfully`,
            data: {
                id: verification._id,
                status: verification.status
            }
        });

    } catch (error) {
        console.error('Review verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getVerificationDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // (sprint1234-verif-details) admin document viewer without a DB
        if (isMockMode()) {
            const v8 = (mockStore.propertyVerifications || []).find((x) => x._id === id)
                || (mockStore.propertyVerifications || []).find((x) => x.propertyId && (x.propertyId._id === id));
            if (!v8) return res.status(404).json({ message: "Verification request not found" });
            return res.status(200).json({ data: v8 });
        }

        const verification = await PropertyVerification.findById(id)
            .populate('propertyId', 'title address price images description')
            .populate('landlordProfileId', 'legalName phone address')
            .populate('reviewedBy', 'userId');

        if (!verification) {
            return res.status(404).json({ message: 'Verification request not found' });
        }

        res.status(200).json({
            data: verification
        });

    } catch (error) {
        console.error('Get verification details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Sprint 11 — landlord identity verification decision (approve/reject/suspend).
const reviewLandlordVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason, reviewNotes } = req.body;
        const valid = ['verified', 'rejected', 'suspended'];
        if (!valid.includes(status)) {
            return res.status(400).json({ message: 'Status must be one of: ' + valid.join(', ') });
        }
        if (isMockMode()) {
            let profile = (mockStore.landlordProfiles || new Map()).get(id);
            if (!profile) {
                profile = [...(mockStore.landlordProfiles || new Map()).values()].find((p) => {
                    const accId = p.accountId && typeof p.accountId === 'object' ? p.accountId._id : p.accountId;
                    return accId === id || p._id === id;
                });
            }
            if (!profile) return res.status(404).json({ message: 'Landlord profile not found' });
            const from = profile.verificationStatus;
            profile.verificationStatus = status;
            if (status === 'rejected' || status === 'suspended') {
                profile.rejectionReason = rejectionReason || reviewNotes;
            } else {
                profile.rejectionReason = undefined;
            }
            const adminName = ((req.user && req.user.firstName) || 'Admin') + ' ' + ((req.user && req.user.lastName) || '');
            (profile.auditTrail = profile.auditTrail || []).push({
                action: 'LANDLORD_' + status.toUpperCase(),
                performedByName: adminName.trim(),
                notes: reviewNotes || rejectionReason || ('Admin ' + status + ' the landlord'),
                timestamp: new Date().toISOString(),
            });
            pushMockAudit(req, 'landlord.' + status, 'landlord', (profile.legalName || id) + (profile.accountId && profile.accountId.email ? ' (' + profile.accountId.email + ')' : ''), from, status, rejectionReason || reviewNotes || '');
            return res.status(200).json({ message: 'Landlord verification ' + status + ' successfully', data: { id: profile._id, status: profile.verificationStatus } });
        }
        let profile = await LandlordProfile.findById(id);
        if (!profile) {
            profile = await LandlordProfile.findOne({ accountId: id });
        }
        if (!profile) return res.status(404).json({ message: 'Landlord profile not found' });
        const from = profile.verificationStatus;
        profile.verificationStatus = status;
        if (status === 'rejected' || status === 'suspended') {
            profile.rejectionReason = rejectionReason || reviewNotes;
        } else {
            profile.rejectionReason = undefined;
        }
        profile.auditTrail = profile.auditTrail || [];
        const adminName = ((req.user && req.user.firstName) || 'Admin') + ' ' + ((req.user && req.user.lastName) || '');
        profile.auditTrail.push({
            action: 'LANDLORD_' + status.toUpperCase(),
            performedByName: adminName.trim(),
            notes: reviewNotes || rejectionReason || ('Admin ' + status + ' the landlord'),
            timestamp: new Date()
        });
        await profile.save();
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            performedBy: req.user.id,
            action: 'landlord.' + status,
            targetEntity: { entityType: 'LandlordProfile', entityId: profile._id },
            ipAddress: req.ip,
            before: { verificationStatus: from },
            after: { verificationStatus: status },
            metadata: { reason: rejectionReason || reviewNotes || '', targetLabel: profile.legalName },
        }).catch(() => {});
        return res.status(200).json({ message: 'Landlord verification ' + status + ' successfully', data: { id: profile._id, status: profile.verificationStatus } });
    } catch (error) {
        console.error('Review landlord verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const resetIdentityVerification = async (req, res) => {
    try {
        const userId = req.user.id;
        if (isMockMode()) {
            let profile = (mockStore.landlordProfiles || new Map()).get(userId);
            if (!profile) {
                profile = [...(mockStore.landlordProfiles || new Map()).values()].find((p) => {
                    const accId = p.accountId && typeof p.accountId === 'object' ? p.accountId._id : p.accountId;
                    return accId === userId || p._id === userId;
                });
            }
            if (!profile) {
                profile = {
                    _id: 'mock-landlord-' + userId,
                    accountId: { _id: userId, email: req.user.email, phone: req.user.phone },
                    legalName: ((req.user.firstName || '') + ' ' + (req.user.lastName || '')).trim() || 'HomeLink Landlord',
                    verificationStatus: 'unverified',
                    submittedDocuments: [],
                    auditTrail: []
                };
                mockStore.landlordProfiles.set(userId, profile);
            }
            profile.verificationStatus = 'unverified';
            profile.submittedDocuments = [];
            profile.rejectionReason = undefined;
            return res.status(200).json({ message: 'Identity verification reset to unverified', data: { profile } });
        }
        const profile = await LandlordProfile.findOneAndUpdate(
            { accountId: userId },
            { verificationStatus: 'unverified', submittedDocuments: [], rejectionReason: null },
            { new: true }
        );
        res.status(200).json({ message: 'Identity verification reset to unverified', data: { profile } });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    submitIdentityVerification,
    submitVerification,
    getVerificationStatus,
    getPendingVerifications,
    reviewVerification,
    getVerificationDetails,
    reviewLandlordVerification,
    resetIdentityVerification
};
