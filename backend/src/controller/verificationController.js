const PropertyVerification = require('../models/PropertyVerification');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Account = require('../models/Account');
const User = require('../models/User');
const { isMockMode, mockStore, persistMockData, persistMockUsers, mockCreateNotification } = require('../config/db');

// Landlord submits Kebele ID, passport, or power of attorney
const submitIdentityVerification = async (req, res) => {
    try {
        const userId = req.user.id;
        const { docTypes } = req.body;
        const files = req.files || [];

        let parsedDocTypes = [];
        if (typeof docTypes === 'string') {
            try {
                parsedDocTypes = JSON.parse(docTypes);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid docTypes format' });
            }
        } else {
            parsedDocTypes = docTypes || [];
        }

        const submittedDocuments = files.map((file, index) => ({
            docType: parsedDocTypes[index] || 'national_id',
            fileKey: '/uploads/' + file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString()
        }));

        if (isMockMode()) {
            let mockProfile = (mockStore.landlordProfiles && mockStore.landlordProfiles.get(userId)) || {
                _id: userId,
                accountId: userId,
                legalName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'HomeLink Landlord',
                phone: req.user?.phone || '0911223344',
                submittedDocuments: [],
                verificationStatus: 'pending',
                auditTrail: []
            };

            mockProfile.submittedDocuments = [
                ...(mockProfile.submittedDocuments || []),
                ...submittedDocuments
            ];
            mockProfile.verificationStatus = 'pending';
            mockProfile.updatedAt = new Date().toISOString();
            if (!mockProfile.auditTrail) mockProfile.auditTrail = [];
            mockProfile.auditTrail.push({
                action: 'IDENTITY_SUBMITTED',
                performedByName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'Landlord',
                notes: 'Landlord submitted identity documents for verification',
                timestamp: new Date().toISOString()
            });

            if (mockStore.landlordProfiles) {
                mockStore.landlordProfiles.set(userId, mockProfile);
            }
            persistMockData();

            return res.status(200).json({
                message: 'Identity documents submitted successfully. Awaiting admin review.',
                data: {
                    status: 'pending',
                    submittedAt: new Date()
                }
            });
        }

        let landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            landlordProfile = new LandlordProfile({
                accountId: userId,
                legalName: req.body.legalName || req.user?.name || req.user?.email || 'HomeLink Landlord',
                submittedDocuments: [],
                verificationStatus: 'pending',
                auditTrail: []
            });
        }

        landlordProfile.submittedDocuments = [...landlordProfile.submittedDocuments, ...submittedDocuments];
        landlordProfile.verificationStatus = 'pending';
        landlordProfile.auditTrail.push({
            action: 'IDENTITY_SUBMITTED',
            performedBy: userId,
            notes: 'Landlord submitted identity documents for verification'
        });

        await landlordProfile.save();

        res.status(200).json({
            message: 'Identity documents submitted successfully. Awaiting admin review.',
            data: {
                status: landlordProfile.verificationStatus,
                submittedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Submit identity verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Landlord submits property ownership documents (Title deed / Lease)
const submitVerification = async (req, res) => {
    try {
        const userId = req.user.id;
        const { propertyId } = req.body;

        let parsedDocTypes = [];
        if (typeof req.body.docTypes === 'string') {
            try {
                parsedDocTypes = JSON.parse(req.body.docTypes);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid docTypes format' });
            }
        } else {
            parsedDocTypes = req.body.docTypes || [];
        }

        const files = req.files || [];

        if (isMockMode()) {
            const property = (mockStore.properties || []).find(p => String(p._id) === String(propertyId));
            if (!property) {
                return res.status(404).json({ message: 'Property not found' });
            }

            const landlordProfile = (mockStore.landlordProfiles && mockStore.landlordProfiles.get(userId)) || {
                _id: userId,
                legalName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'HomeLink Landlord',
                phone: req.user?.phone || '0911223344'
            };

            const newVer = {
                _id: 'mock-propver-' + Date.now(),
                propertyId: {
                    _id: property._id,
                    title: property.title,
                    address: property.location ? `${property.location.neighborhood || ''}, ${property.location.subCity || ''}, ${property.location.city || ''}` : property.title,
                    price: property.rentAmount,
                    images: property.images || []
                },
                landlordProfileId: {
                    _id: landlordProfile._id || userId,
                    legalName: landlordProfile.legalName || 'Landlord',
                    phone: landlordProfile.phone || '0911223344'
                },
                status: 'submitted',
                submittedDocuments: files.map((file, idx) => ({
                    docType: parsedDocTypes[idx] || 'title_deed',
                    fileKey: '/uploads/' + file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    uploadedAt: new Date().toISOString()
                })),
                reviewNotes: '',
                rejectionReason: '',
                auditTrail: [{
                    action: 'SUBMITTED',
                    performedByName: landlordProfile.legalName || 'Landlord',
                    notes: 'Landlord submitted property for ownership verification',
                    timestamp: new Date().toISOString()
                }],
                createdAt: new Date().toISOString()
            };

            if (!mockStore.propertyVerifications) mockStore.propertyVerifications = [];
            mockStore.propertyVerifications.unshift(newVer);
            property.verificationStatus = 'pending';
            persistMockData();

            return res.status(201).json({
                message: 'Property verification submitted successfully. Awaiting admin review.',
                data: {
                    id: newVer._id,
                    status: newVer.status,
                    propertyId: newVer.propertyId._id,
                    submittedAt: newVer.createdAt
                }
            });
        }

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
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

        const verification = await PropertyVerification.create({
            propertyId,
            landlordProfileId: landlordProfile._id,
            status: 'submitted',
            submittedDocuments: files.map((file, index) => ({
                docType: parsedDocTypes[index] || 'unknown',
                fileKey: '/uploads/' + file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
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

// Check landlord's verification status
const getVerificationStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        if (isMockMode()) {
            let landlordProfile = (mockStore.landlordProfiles && mockStore.landlordProfiles.get(userId));
            if (!landlordProfile && mockStore.landlordProfiles) {
                for (const p of mockStore.landlordProfiles.values()) {
                    if (String(p._id) === String(userId) || String(p.accountId?._id || p.accountId) === String(userId)) {
                        landlordProfile = p;
                        break;
                    }
                }
            }

            const user = Array.from(mockStore.users.values()).find(u => 
                String(u._id) === String(userId) || 
                String(u.email).toLowerCase() === String(req.user?.email || '').toLowerCase()
            );

            if (!landlordProfile) {
                landlordProfile = {
                    _id: userId,
                    accountId: userId,
                    legalName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'HomeLink Landlord'),
                    phone: user?.phone || req.user?.phone || '0911223344',
                    verificationStatus: user?.identityStatus === 'verified' || user?.verificationStatus === 'verified' ? 'verified' : (user?.verificationStatus || 'unverified'),
                    submittedDocuments: [],
                    auditTrail: []
                };
                if (mockStore.landlordProfiles) mockStore.landlordProfiles.set(userId, landlordProfile);
            }

            // Real-life logic: If user account is verified, landlordProfile is verified
            if (user && (user.identityStatus === 'verified' || user.verificationStatus === 'verified') && landlordProfile.verificationStatus === 'unverified') {
                landlordProfile.verificationStatus = 'verified';
                landlordProfile.verifiedAt = landlordProfile.verifiedAt || new Date().toISOString();
            }

            const propVers = (mockStore.propertyVerifications || []).filter(v => 
                String(v.landlordProfileId?._id || v.landlordProfileId) === String(userId) ||
                String(v.landlordProfileId?._id || v.landlordProfileId) === String(landlordProfile._id)
            );

            const mappedVers = propVers.map(v => ({
                id: v._id,
                _id: v._id,
                property: v.propertyId,
                propertyId: v.propertyId,
                status: v.status,
                submittedDocuments: v.submittedDocuments || [],
                submittedAt: v.createdAt,
                reviewedAt: v.verifiedAt,
                rejectionReason: v.rejectionReason,
                reviewNotes: v.reviewNotes,
                auditTrail: v.auditTrail || []
            }));

            return res.status(200).json({
                identityStatus: landlordProfile.verificationStatus || 'unverified',
                data: {
                    profile: landlordProfile,
                    verifications: mappedVers
                }
            });
        }

        let landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        const user = await User.findById(userId);
        if (!landlordProfile && user && user.role === 'landlord') {
            landlordProfile = await LandlordProfile.create({
                accountId: userId,
                legalName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'HomeLink Landlord',
                verificationStatus: user.identityStatus === 'verified' ? 'verified' : 'unverified',
                submittedDocuments: []
            });
        }
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        const verifications = await PropertyVerification.find({
            landlordProfileId: landlordProfile._id
        }).populate('propertyId', 'title address price');

        const mappedVers = verifications.map(v => ({
            id: v._id,
            _id: v._id,
            property: v.propertyId,
            propertyId: v.propertyId,
            status: v.status,
            submittedDocuments: v.submittedDocuments || [],
            submittedAt: v.createdAt,
            reviewedAt: v.verifiedAt,
            rejectionReason: v.rejectionReason,
            reviewNotes: v.reviewNotes,
            auditTrail: v.auditTrail || []
        }));

        res.status(200).json({
            identityStatus: landlordProfile.verificationStatus,
            data: {
                profile: landlordProfile,
                verifications: mappedVers
            }
        });

    } catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin queue: Returns both Landlords and Properties pending/submitted for verification
const getPendingVerifications = async (req, res) => {
    try {
        if (isMockMode()) {
            // Build landlord identity list
            const rawProfiles = Array.from((mockStore.landlordProfiles || new Map()).values());
            const landlords = rawProfiles.map(lp => {
                const user = Array.from(mockStore.users.values()).find(u => 
                    String(u._id) === String(lp.accountId?._id || lp.accountId) ||
                    String(u.email) === String(lp.accountId?.email)
                );

                const docs = (lp.submittedDocuments && lp.submittedDocuments.length > 0)
                    ? lp.submittedDocuments.map(d => ({
                        docType: d.docType || (d.name?.includes('id') ? 'national_id' : 'ownership_lease'),
                        fileKey: d.fileKey || '/uploads/id-sample.jpg',
                        originalName: d.name || d.originalName || 'identity-document.pdf',
                        uploadedAt: d.uploadedAt || lp.createdAt || new Date().toISOString()
                    }))
                    : [
                        { docType: 'national_id', fileKey: '/uploads/id-sample.jpg', originalName: 'kebele-id.jpg', uploadedAt: lp.createdAt || new Date().toISOString() },
                        { docType: 'power_of_attorney', fileKey: '/uploads/lease-sample.pdf', originalName: 'tax-id-tin.pdf', uploadedAt: lp.createdAt || new Date().toISOString() }
                    ];

                return {
                    _id: lp._id || (user ? user._id : 'landlord-profile-id'),
                    accountId: user ? { email: user.email, phone: user.phone } : (typeof lp.accountId === 'object' ? lp.accountId : { email: 'dev.landlord@homelink.test', phone: lp.phone || '0911223344' }),
                    legalName: lp.legalName || (user ? `${user.firstName} ${user.lastName}` : 'HomeLink Landlord'),
                    phone: lp.phone || user?.phone || '0911223344',
                    verificationStatus: lp.verificationStatus || 'pending',
                    submittedDocuments: docs,
                    rejectionReason: lp.rejectionReason || '',
                    createdAt: lp.createdAt || new Date().toISOString(),
                    updatedAt: lp.updatedAt || new Date().toISOString(),
                    auditTrail: lp.auditTrail || [
                        { action: 'SUBMITTED', performedByName: lp.legalName || 'Landlord', notes: 'Uploaded national Kebele ID and TIN certificates', timestamp: lp.createdAt || new Date().toISOString() }
                    ]
                };
            });

            // Build property verifications list
            const properties = (mockStore.propertyVerifications || []).map(pv => {
                const prop = typeof pv.propertyId === 'object' ? pv.propertyId : (mockStore.properties || []).find(p => String(p._id) === String(pv.propertyId));
                const landlord = typeof pv.landlordProfileId === 'object' ? pv.landlordProfileId : (mockStore.landlordProfiles && mockStore.landlordProfiles.get(pv.landlordProfileId));

                const docs = (pv.submittedDocuments && pv.submittedDocuments.length > 0)
                    ? pv.submittedDocuments.map(d => ({
                        docType: d.docType || (d.name?.includes('deed') ? 'title_deed' : 'ownership_lease'),
                        fileKey: d.fileKey || '/uploads/lease-sample.pdf',
                        originalName: d.name || d.originalName || 'title-deed-certificate.pdf',
                        uploadedAt: d.uploadedAt || pv.createdAt || new Date().toISOString()
                    }))
                    : [
                        { docType: 'title_deed', fileKey: '/uploads/lease-sample.pdf', originalName: 'title-deed-addis-ababa.pdf', uploadedAt: pv.createdAt || new Date().toISOString() }
                    ];

                return {
                    _id: pv._id,
                    propertyId: prop ? {
                        _id: prop._id,
                        title: prop.title,
                        address: prop.location ? `${prop.location.neighborhood || ''}, ${prop.location.subCity || ''}, ${prop.location.city || ''}` : prop.address || prop.title,
                        price: prop.rentAmount || prop.price || 45000
                    } : { _id: 'prop-1', title: 'Residence in Addis Ababa', price: 45000 },
                    landlordProfileId: landlord ? {
                        _id: landlord._id,
                        legalName: landlord.legalName || 'Verified Landlord',
                        phone: landlord.phone || '0911223344'
                    } : { _id: 'mock-landlord-1', legalName: 'Dev Landlord', phone: '0911223344' },
                    status: pv.status || 'submitted',
                    submittedDocuments: docs,
                    reviewNotes: pv.reviewNotes || '',
                    rejectionReason: pv.rejectionReason || '',
                    createdAt: pv.createdAt || new Date().toISOString(),
                    verifiedAt: pv.verifiedAt,
                    auditTrail: pv.auditTrail || []
                };
            });

            return res.status(200).json({
                data: {
                    landlords,
                    properties
                }
            });
        }

        // Database mode
        const [landlordProfiles, propertyVerifications] = await Promise.all([
            LandlordProfile.find().populate('accountId', 'firstName lastName email phone').sort({ createdAt: -1 }),
            PropertyVerification.find()
                .populate('propertyId', 'title address price images')
                .populate('landlordProfileId', 'legalName phone address')
                .sort({ createdAt: -1 })
        ]);

        res.status(200).json({
            data: {
                landlords: landlordProfiles,
                properties: propertyVerifications
            }
        });

    } catch (error) {
        console.error('Get pending verifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin reviews Landlord Identity Verification (Approve / Reject)
const reviewLandlordVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewNotes, rejectionReason } = req.body;
        const adminId = req.user.id;

        const validStatuses = ['verified', 'rejected', 'suspended', 'pending'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        if (isMockMode()) {
            let profile = null;
            if (mockStore.landlordProfiles) {
                profile = mockStore.landlordProfiles.get(id);
                if (!profile) {
                    for (const [k, v] of mockStore.landlordProfiles.entries()) {
                        if (String(v._id) === String(id) || String(k) === String(id)) {
                            profile = v;
                            break;
                        }
                    }
                }
            }

            if (!profile) {
                // Check if user exists
                const user = Array.from(mockStore.users.values()).find(u => String(u._id) === String(id));
                if (user) {
                    profile = {
                        _id: user._id,
                        accountId: user._id,
                        legalName: `${user.firstName} ${user.lastName}`,
                        phone: user.phone,
                        verificationStatus: 'pending'
                    };
                    mockStore.landlordProfiles.set(user._id, profile);
                }
            }

            if (!profile) {
                return res.status(404).json({ message: 'Landlord profile not found' });
            }

            profile.verificationStatus = status;
            if (status === 'rejected' && rejectionReason) {
                profile.rejectionReason = rejectionReason;
            }
            if (reviewNotes) {
                profile.reviewNotes = reviewNotes;
            }
            profile.verifiedAt = status === 'verified' ? new Date().toISOString() : undefined;
            if (!profile.auditTrail) profile.auditTrail = [];
            profile.auditTrail.push({
                action: `LANDLORD_${status.toUpperCase()}`,
                performedByName: req.user?.firstName ? `${req.user.firstName} (Admin)` : 'Admin Reviewer',
                notes: reviewNotes || (rejectionReason ? `Reason: ${rejectionReason}` : `Landlord marked ${status}`),
                timestamp: new Date().toISOString()
            });

            // Also update user account status if verified
            for (const user of mockStore.users.values()) {
                if (String(user._id) === String(profile.accountId?._id || profile.accountId || profile._id)) {
                    user.identityStatus = status === 'verified' ? 'verified' : (status === 'rejected' ? 'rejected' : 'unverified');
                    user.verificationStatus = user.identityStatus;
                    break;
                }
            }

            persistMockData();
            persistMockUsers();

            // Notify landlord
            mockCreateNotification(
                profile.accountId?._id || profile.accountId || profile._id,
                'application_accepted',
                status === 'verified' ? 'Identity Verification Approved!' : 'Identity Verification Update',
                status === 'verified'
                    ? 'Congratulations! Your landlord identity documents have been verified by HomeLink Admin. You can now publish rental listings.'
                    : `Your verification was marked as ${status}. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`
            );

            return res.status(200).json({
                message: `Landlord verification ${status} successfully`,
                data: {
                    id: profile._id,
                    status: profile.verificationStatus
                }
            });
        }

        const profile = await LandlordProfile.findById(id);
        if (!profile) return res.status(404).json({ message: 'Landlord profile not found' });

        profile.verificationStatus = status;
        if (status === 'rejected' && rejectionReason) profile.rejectionReason = rejectionReason;
        profile.auditTrail.push({
            action: `STATUS_CHANGED_TO_${status.toUpperCase()}`,
            performedBy: adminId,
            notes: reviewNotes || rejectionReason || `Admin marked as ${status}`
        });

        await profile.save();

        if (status === 'verified') {
            await User.findByIdAndUpdate(profile.accountId, { identityStatus: 'verified' });
        }

        res.status(200).json({
            message: `Landlord verification ${status} successfully`,
            data: { id: profile._id, status: profile.verificationStatus }
        });

    } catch (error) {
        console.error('Review landlord verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin reviews Property Verification (Approve / Reject)
const reviewVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewNotes, rejectionReason } = req.body;
        const adminId = req.user.id;

        const validStatuses = ['verified', 'rejected', 'more_info_needed', 'suspended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        if (isMockMode()) {
            const pv = (mockStore.propertyVerifications || []).find(v => String(v._id) === String(id));
            if (!pv) {
                return res.status(404).json({ message: 'Verification request not found' });
            }

            pv.status = status;
            pv.reviewNotes = reviewNotes || '';
            if (status === 'verified') {
                pv.verifiedAt = new Date().toISOString();
            }
            if (status === 'rejected' && rejectionReason) {
                pv.rejectionReason = rejectionReason;
            }

            if (!pv.auditTrail) pv.auditTrail = [];
            pv.auditTrail.push({
                action: `PROPERTY_${status.toUpperCase()}`,
                performedByName: req.user?.firstName ? `${req.user.firstName} (Admin)` : 'Admin Reviewer',
                notes: reviewNotes || (rejectionReason ? `Reason: ${rejectionReason}` : `Property marked ${status}`),
                timestamp: new Date().toISOString()
            });

            // Update property in mockStore
            const propId = pv.propertyId?._id || pv.propertyId;
            const property = (mockStore.properties || []).find(p => String(p._id) === String(propId));
            if (property) {
                property.verificationStatus = status === 'verified' ? 'verified' : (status === 'rejected' ? 'rejected' : 'pending');
                if (status === 'verified') {
                    property.listingStatus = 'active';
                }
            }

            persistMockData();

            // Notify Landlord
            const landlordId = pv.landlordProfileId?._id || pv.landlordProfileId || property?.landlordId;
            if (landlordId) {
                mockCreateNotification(
                    landlordId,
                    'application_accepted',
                    status === 'verified' ? 'Property Approved & Verified!' : 'Property Review Update',
                    status === 'verified'
                        ? `Your property "${property?.title || 'Listing'}" has been verified by HomeLink Admin and is now publicly active.`
                        : `Your property verification was marked as ${status}. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`
                );
            }

            return res.status(200).json({
                message: `Verification ${status} successfully`,
                data: {
                    id: pv._id,
                    status: pv.status
                }
            });
        }

        const verification = await PropertyVerification.findById(id);
        if (!verification) {
            return res.status(404).json({ message: 'Verification request not found' });
        }

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
            verificationStatus: propertyStatus,
            ...(status === 'verified' ? { listingStatus: 'active' } : {})
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

        if (isMockMode()) {
            const pv = (mockStore.propertyVerifications || []).find(v => String(v._id) === String(id));
            if (!pv) return res.status(404).json({ message: 'Verification request not found' });
            return res.status(200).json({ data: pv });
        }

        const verification = await PropertyVerification.findById(id)
            .populate('propertyId', 'title address price images description')
            .populate('landlordProfileId', 'legalName phone address')
            .populate('reviewedBy', 'userId');

        if (!verification) {
            return res.status(404).json({ message: 'Verification request not found' });
        }

        res.status(200).json({ data: verification });

    } catch (error) {
        console.error('Get verification details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    submitVerification,
    submitIdentityVerification,
    getVerificationStatus,
    getPendingVerifications,
    reviewVerification,
    reviewLandlordVerification,
    getVerificationDetails
};
