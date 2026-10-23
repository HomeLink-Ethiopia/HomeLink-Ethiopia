const { isMockMode, mockStore } = require('../config/db');
const Review = require('../models/Review');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');

const createReview = async (req, res) => {
    try {
        // Mock DB: enforce Sprint 10 guards, then persist.
        if (isMockMode()) {
            const { agreementId, revieweeId, propertyId, reviewType, rating, comment } = req.body || {};
            if (!agreementId || !reviewType || !rating) return res.status(400).json({ message: "agreementId, reviewType and rating are required." });
            if (reviewType === "landlord_to_tenant" && req.user.role !== "landlord") return res.status(403).json({ message: "Only landlords can leave this type of review." });
            if (reviewType !== "landlord_to_tenant" && req.user.role !== "tenant") return res.status(403).json({ message: "Only tenants can leave this type of review." });
            // Sprint 10: the reviewer must be part of the agreement (blocks unauthorized reviews).
            const agreement = (mockStore.agreements || []).find((a) => a._id === agreementId);
            if (!agreement) return res.status(404).json({ message: "Rental agreement not found." });
            const tenantOnAgreement = String((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId);
            const landlordOnAgreement = String(agreement.landlordId);
            if (reviewType === "landlord_to_tenant" ? landlordOnAgreement !== String(req.user.id) : tenantOnAgreement !== String(req.user.id)) {
                return res.status(403).json({ message: "Unauthorized: You are not part of this rental agreement." });
            }
            // Self-review + duplicate guards (same rules as the real DB path).
            if (revieweeId && String(revieweeId) === String(req.user.id)) return res.status(400).json({ message: "You cannot review yourself." });
            const dupe = (mockStore.reviews || []).find((r) => r.agreementId === agreementId && r.reviewType === reviewType && (r.reviewerId === req.user.id || (r.reviewerId && r.reviewerId._id) === req.user.id));
            if (dupe) return res.status(400).json({ message: "You have already submitted this type of review for this agreement." });

            const reviewer = mockStore.users.get ? Array.from(mockStore.users.values()).find((u) => u._id === req.user.id) : null;
            const review = {
                _id: "mock-review-" + Date.now(),
                reviewerId: { _id: req.user.id, firstName: (reviewer && reviewer.firstName) || req.user.firstName || "User", lastName: (reviewer && reviewer.lastName) || req.user.lastName || "" },
                revieweeId: revieweeId || (reviewType === "landlord_to_tenant" ? tenantOnAgreement : landlordOnAgreement),
                propertyId: propertyId || (agreement.propertyId && (agreement.propertyId._id || agreement.propertyId)) || null,
                agreementId,
                reviewType,
                rating: Math.max(1, Math.min(5, Number(rating))),
                comment: comment || "",
                landlordReply: "",
                status: "visible",
                createdAt: new Date().toISOString(),
            };
            mockStore.reviews.push(review);
            return res.status(201).json({ message: "Review submitted", data: review });
        }
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
        if (isMockMode()) {
            const list = (mockStore.reviews || []).filter((r) => r.propertyId === req.params.propertyId && r.reviewType === 'tenant_to_property' && r.status !== 'hidden');
            const avg = list.reduce((a, c) => a + (c.rating || 0), 0) / (list.length || 1);
            return res.status(200).json({ average: avg.toFixed(1), count: list.length, reviews: list });
        }
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
        if (isMockMode()) {
            const list = (mockStore.reviews || []).filter((r) => String((r.revieweeId && r.revieweeId._id) || r.revieweeId) === String(req.params.userId) && r.status !== 'hidden');
            const avg = list.reduce((a, c) => a + (c.rating || 0), 0) / (list.length || 1);
            return res.status(200).json({ average: avg.toFixed(1), count: list.length, reviews: list });
        }
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
