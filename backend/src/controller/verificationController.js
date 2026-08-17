const PropertyVerification = require('../models/PropertyVerification');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Account = require('../models/Account');

const submitVerification = async (req, res) => {
    try {
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

        const existing = await PropertyVerification.findOne({
            propertyId,
            status: { $in: ['submitted', 'under_review'] }
        });

        if (existing) {
            return res.status(400).json({
                message: 'This property already has a pending verification request'
            });
        }

        let parsedDocuments = documents;
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
        const userId = req.user.id;

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        const verifications = await PropertyVerification.find({
            landlordProfileId: landlordProfile._id
        }).populate('propertyId', 'title address price');

        if (!verifications || verifications.length === 0) {
            return res.status(200).json({
                data: [],
                message: 'No verification requests found'
            });
        }

        res.status(200).json({
            data: verifications.map(v => ({
                id: v._id,
                property: v.propertyId,
                status: v.status,
                submittedAt: v.createdAt,
                reviewedAt: v.verifiedAt,
                rejectionReason: v.rejectionReason
            }))
        });

    } catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPendingVerifications = async (req, res) => {
    try {
        const { status } = req.query;

        const query = status
            ? { status }
            : { status: { $in: ['submitted', 'under_review'] } };

        const verifications = await PropertyVerification.find(query)
            .populate('propertyId', 'title address price images')
            .populate('landlordProfileId', 'legalName phone address')
            .populate('reviewedBy', 'userId')
            .sort({ createdAt: -1 });

        res.status(200).json({
            data: verifications
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

module.exports = {
    submitVerification,
    getVerificationStatus,
    getPendingVerifications,
    reviewVerification,
    getVerificationDetails
};
