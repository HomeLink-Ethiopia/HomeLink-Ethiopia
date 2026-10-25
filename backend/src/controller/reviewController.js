const Review = require('../models/Review');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData, mockCreateNotification } = require('../config/db');

const createReview = async (req, res) => {
    try {
        const reviewerId = String(req.user.id || '');
        const { agreementId, revieweeId, propertyId, reviewType, ratings, comment } = req.body;

        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const newRev = {
                _id: 'mock-rev-' + Date.now(),
                reviewerId,
                revieweeId: String(revieweeId || ''),
                propertyId: String(propertyId || ''),
                agreementId: String(agreementId || ''),
                reviewType: reviewType || 'landlord_to_tenant',
                ratings: ratings || { overall: 5 },
                comment: comment || '',
                status: 'published',
                createdAt: new Date().toISOString()
            };
            mockStore.reviews.push(newRev);
            persistMockData();

            if (revieweeId) {
                mockCreateNotification(
                    revieweeId,
                    'system',
                    'New Review Received',
                    `You received a new ${ratings?.overall || 5}-star review from your landlord.`
                );
            }

            return res.status(201).json({ message: "Review submitted successfully", review: newRev });
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
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const reviews = mockStore.reviews.filter(r => String(r.propertyId) === String(propertyId));
            const avgRating = reviews.length > 0 ? reviews.reduce((acc, curr) => acc + (curr.ratings?.overall || 5), 0) / reviews.length : 5;
            return res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews });
        }
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
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const reviews = mockStore.reviews.filter(r => String(r.revieweeId) === String(userId));
            const avgRating = reviews.length > 0 ? reviews.reduce((acc, curr) => acc + (curr.ratings?.overall || 5), 0) / reviews.length : 5;
            return res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews });
        }
        const reviews = await Review.find({ revieweeId: userId, status: 'published' })
            .populate('reviewerId', 'firstName lastName profileImage')
            .sort({ createdAt: -1 });

        const avgRating = reviews.reduce((acc, curr) => acc + curr.ratings.overall, 0) / (reviews.length || 1);

        res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rateTenant = async (req, res) => {
    try {
        const reviewerId = String(req.user.id || req.user.userId || 'mock-landlord-1');
        const { agreementId, rating, comment, paymentScore, careScore, conductScore, commScore, wouldRentAgain } = req.body;

        if (!agreementId) {
            return res.status(400).json({ message: "Agreement ID is required" });
        }

        const score = Number(rating) || 5;

        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            mockStore.agreements = mockStore.agreements || [];
            const agr = mockStore.agreements.find(a => String(a._id) === String(agreementId));

            const tenantId = agr && typeof agr.tenantId === 'object' ? agr.tenantId._id : (agr ? agr.tenantId : 'mock-user-seed-1');
            const propertyId = agr && typeof agr.propertyId === 'object' ? agr.propertyId._id : (agr ? agr.propertyId : '');

            const review = {
                _id: 'mock-rev-' + Date.now(),
                agreementId: String(agreementId),
                reviewerId,
                revieweeId: String(tenantId || 'mock-user-seed-1'),
                propertyId: String(propertyId || ''),
                reviewType: 'landlord_to_tenant',
                rating: score,
                ratings: {
                    overall: score,
                    paymentReliability: Number(paymentScore) || score,
                    propertyCare: Number(careScore) || score,
                    conductAndRules: Number(conductScore) || score,
                    communication: Number(commScore) || score,
                    wouldRentAgain: wouldRentAgain || 'yes'
                },
                comment: comment || '',
                status: 'published',
                createdAt: new Date().toISOString()
            };

            // Prevent duplicate review for same agreement
            const existingIdx = mockStore.reviews.findIndex(r => String(r.agreementId) === String(agreementId) && r.reviewType === 'landlord_to_tenant');
            if (existingIdx !== -1) {
                mockStore.reviews[existingIdx] = review;
            } else {
                mockStore.reviews.push(review);
            }
            persistMockData();

            mockCreateNotification(
                tenantId,
                'system',
                'New Landlord Evaluation Received',
                `Your previous landlord gave you a ${score}-star rating for your rental stay.`
            );

            return res.status(200).json({ success: true, message: "Tenant rating saved successfully", data: review });
        }

        const agreement = await RentalAgreement.findById(agreementId);
        if (!agreement) {
            return res.status(404).json({ message: "Rental agreement not found" });
        }

        const review = await Review.findOneAndUpdate(
            { agreementId, reviewType: 'landlord_to_tenant' },
            {
                reviewerId,
                revieweeId: agreement.tenantId,
                propertyId: agreement.propertyId,
                agreementId,
                reviewType: 'landlord_to_tenant',
                ratings: {
                    overall: score,
                    paymentReliability: Number(paymentScore) || score,
                    propertyCare: Number(careScore) || score,
                    conductAndRules: Number(conductScore) || score,
                    communication: Number(commScore) || score,
                    wouldRentAgain: wouldRentAgain || 'yes'
                },
                comment: comment || '',
                status: 'published'
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: "Tenant rating saved successfully", data: review });
    } catch (error) {
        console.error("rateTenant error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getMineReviews = async (req, res) => {
    try {
        const userId = String(req.user.id || req.user.userId || '');
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const myReviews = mockStore.reviews.filter(r => String(r.reviewerId) === userId || String(r.revieweeId) === userId);
            return res.status(200).json({ success: true, count: myReviews.length, data: myReviews });
        }
        const reviews = await Review.find({
            $or: [{ reviewerId: userId }, { revieweeId: userId }]
        }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getMyPropertiesReviews = async (req, res) => {
    try {
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const reviews = mockStore.reviews.filter(r => r.reviewType === 'tenant_to_property' || r.reviewType === 'tenant_to_landlord');
            return res.status(200).json({ success: true, count: reviews.length, data: reviews, reviews });
        }
        const reviews = await Review.find({ reviewType: 'tenant_to_property' }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: reviews.length, data: reviews, reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const replyReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const rev = mockStore.reviews.find(r => String(r._id) === String(id));
            if (rev) {
                rev.landlordReply = reply;
                rev.landlordRepliedAt = new Date().toISOString();
                persistMockData();
            }
            return res.status(200).json({ success: true, message: "Reply posted successfully" });
        }
        const rev = await Review.findByIdAndUpdate(id, {
            response: { body: reply, respondedAt: new Date() }
        }, { new: true });
        res.status(200).json({ success: true, message: "Reply posted successfully", data: rev });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createReview,
    rateTenant,
    getMyPropertiesReviews,
    getMineReviews,
    replyReview,
    getPropertyReviews,
    getUserReviews
};

