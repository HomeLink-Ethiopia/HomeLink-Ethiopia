const RentalAgreement = require('../models/RentalAgreement');
const Property = require('../models/Property');
const Notification = require('../models/Notification');

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        await Notification.create({
            userId, type, title, body,
            relatedEntity: { entityType, entityId },
            channels: ['in_app']
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const createAgreement = async (req, res) => {
    try {
        const landlordId = req.user.id;
        const {
            applicationId, propertyId, tenantId, startDate, endDate,
            rentAmount, depositAmount, paymentDueDay, paymentFrequency,
            noticePeriodDays, utilitiesIncluded, specialConditions
        } = req.body;

        const property = await Property.findById(propertyId);
        if (!property) return res.status(404).json({ message: "Property not found" });

        const agreement = await RentalAgreement.create({
            applicationId, propertyId, tenantId, landlordId,
            startDate, endDate, rentAmount, depositAmount,
            paymentDueDay, paymentFrequency, noticePeriodDays,
            utilitiesIncluded, specialConditions,
            status: "pending_signatures"
        });

        // Notify tenant
        await createNotification(
            tenantId, 'agreement_ready', 'New Rental Agreement',
            `A new rental agreement for ${property.title} is ready for your signature.`,
            'RentalAgreement', agreement._id
        );

        res.status(201).json({ message: "Agreement created and sent to tenant", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const signAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        if (role === 'tenant' && agreement.tenantId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        if (role === 'landlord' && agreement.landlordId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (agreement.status !== 'pending_signatures' && agreement.status !== 'draft') {
            return res.status(400).json({ message: "This agreement is not pending signatures" });
        }

        if (role === 'tenant') agreement.tenantSignedAt = new Date();
        if (role === 'landlord') agreement.landlordSignedAt = new Date();

        if (agreement.tenantSignedAt && agreement.landlordSignedAt) {
            agreement.status = "active";
            // Notify both parties
            await createNotification(agreement.tenantId, 'agreement_signed', 'Agreement Fully Signed', `The agreement for ${agreement.propertyId.title} is now active!`, 'RentalAgreement', agreement._id);
            await createNotification(agreement.landlordId, 'agreement_signed', 'Agreement Fully Signed', `The agreement for ${agreement.propertyId.title} is now active!`, 'RentalAgreement', agreement._id);
        }

        await agreement.save();
        res.status(200).json({ message: "Agreement signed successfully", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getAgreements = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        
        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };
        const agreements = await RentalAgreement.find(filter)
            .populate('propertyId', 'title location')
            .populate(role === 'tenant' ? 'landlordId' : 'tenantId', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        res.status(200).json(agreements);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getAgreementById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const agreement = await RentalAgreement.findById(id)
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .populate('applicationId');

        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        // Ensure user is authorized to view this agreement
        if (role === 'tenant' && agreement.tenantId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && agreement.landlordId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        res.status(200).json(agreement);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const terminateAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const { terminationReason } = req.body;
        const role = req.user.role;
        const userId = req.user.id;

        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        // Ensure user is part of the agreement
        if (role === 'tenant' && agreement.tenantId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && agreement.landlordId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        agreement.status = "terminated";
        agreement.terminationDate = new Date();
        agreement.terminationReason = terminationReason;
        agreement.terminatedBy = role; // "tenant" or "landlord"

        await agreement.save();

        // Notify the other party
        const notifyUserId = role === 'tenant' ? agreement.landlordId : agreement.tenantId;
        await createNotification(
            notifyUserId, 'agreement_terminated', 'Agreement Terminated',
            `The rental agreement for ${agreement.propertyId.title} has been terminated by the ${role}.`,
            'RentalAgreement', agreement._id
        );

        res.status(200).json({ message: "Agreement terminated successfully", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const renewAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const { newEndDate, newRentAmount } = req.body;

        // Only landlords can renew/update the agreement terms
        const agreement = await RentalAgreement.findOneAndUpdate(
            { _id: id, landlordId: req.user.id, status: "active" },
            { 
                endDate: newEndDate,
                rentAmount: newRentAmount,
                $push: {
                    renewals: {
                        newEndDate,
                        newRentAmount,
                        agreedAt: new Date()
                    }
                }
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!agreement) return res.status(404).json({ message: "Active agreement not found or unauthorized" });

        // Notify tenant
        await createNotification(
            agreement.tenantId, 'agreement_renewed', 'Agreement Renewed',
            `Your rental agreement for ${agreement.propertyId.title} has been renewed until ${new Date(newEndDate).toLocaleDateString()}.`,
            'RentalAgreement', agreement._id
        );

        res.status(200).json({ message: "Agreement renewed successfully", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    createAgreement,
    signAgreement,
    getAgreements,
    getAgreementById,
    terminateAgreement,
    renewAgreement
};
