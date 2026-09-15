const Review = require('../models/Review');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');

const createReview = async (req, res) => {
    try {
        const reviewerId = req.user.id;
        const { agreementId, revieweeId, propertyId, reviewType, ratings, comment } = req.body;

        // 1. Enforce verified stays: Check if the agreement exists and involves this user
        const agreement = await RentalAgreement.findById(agreementId);
        if (!agreement) {
            return res.status(404).json({ message: "Rental agreement not found." });
        }

        // Validate user is part of the agreement
        const isTenant = agreement.tenantId.toString() === reviewerId;
        const isLandlord = agreement.landlordId.toString() === reviewerId;

        if (!isTenant && !isLandlord) {
            return res.status(403).json({ message: "Unauthorized: You are not part of this rental agreement." });
        }

        // Validate review type makes sense
        if (reviewType === 'tenant_to_landlord' || reviewType === 'tenant_to_property') {
            if (!isTenant) return res.status(400).json({ message: "Only tenants can leave this type of review." });
        }
        if (reviewType === 'landlord_to_tenant') {
            if (!isLandlord) return res.status(400).json({ message: "Only landlords can leave this type of review." });
        }

        // 2. Prevent self-review
        if (revieweeId === reviewerId) {
            return res.status(400).json({ message: "You cannot review yourself." });
        }

        // 3. Prevent duplicate reviews (handled by DB index as well, but good to check here)
        const existingReview = await Review.findOne({ agreementId, reviewType, reviewerId });
        if (existingReview) {
            return res.status(400).json({ message: "You have already submitted this type of review for this agreement." });
        }

        const review = await Review.create({
            reviewerId,
            revieweeId,
            propertyId,
            agreementId,
            reviewType,
            ratings,
            comment
        });

        // Notify the reviewee
        if (revieweeId) {
            await Notification.create({
                userId: revieweeId,
                type: 'system',
                title: 'New Review Received',
                body: `You received a new ${ratings.overall}-star review.`,
                relatedEntity: { entityType: 'Review', entityId: review._id },
                channels: ['in_app']
            });
        }

        res.status(201).json({ message: "Review submitted successfully", review });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "Duplicate review detected." });
        }
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getPropertyReviews = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const reviews = await Review.find({ propertyId, status: 'published', reviewType: 'tenant_to_property' })
            .populate('reviewerId', 'firstName lastName profileImage')
            .sort({ createdAt: -1 });

        // Calculate average rating
        const avgRating = reviews.reduce((acc, curr) => acc + curr.ratings.overall, 0) / (reviews.length || 1);

        res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await Review.find({ revieweeId: userId, status: 'published' })
            .populate('reviewerId', 'firstName lastName profileImage')
            .sort({ createdAt: -1 });

        const avgRating = reviews.reduce((acc, curr) => acc + curr.ratings.overall, 0) / (reviews.length || 1);

        res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createReview,
    getPropertyReviews,
    getUserReviews
};
