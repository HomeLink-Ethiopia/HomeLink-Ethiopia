const Review = require('../models/Review');
const RentalAgreement = require('../models/RentalAgreement');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData, mockCreateNotification } = require('../config/db');

/**
 * Enriches a review object with formatted author/property metadata and guaranteed numerical rating
 */
function enrichReview(rev) {
    if (!rev) return rev;
    const r = { ...rev };
    r.rating = Number(r.rating || r.ratings?.overall || 5);
    r.ratings = r.ratings || { overall: r.rating };
    r.ratings.overall = r.rating;

    // Enrich author / reviewer
    if (!r.reviewerName || !r.authorId) {
        const revUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === String(r.reviewerId));
        if (revUser) {
            r.reviewerName = r.reviewerName || `${revUser.firstName || ''} ${revUser.lastName || ''}`.trim();
            r.authorId = r.authorId || {
                _id: revUser._id,
                firstName: revUser.firstName,
                lastName: revUser.lastName,
                profileImage: revUser.profileImage || null
            };
        }
    }
    // Enrich reviewee
    if (!r.revieweeName && r.revieweeId) {
        const eeUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === String(r.revieweeId));
        if (eeUser) {
            r.revieweeName = `${eeUser.firstName || ''} ${eeUser.lastName || ''}`.trim();
        }
    }
    // Enrich property title
    if (!r.propertyTitle && r.propertyId) {
        const prop = (mockStore.properties || []).find(p => String(p._id) === String(r.propertyId));
        if (prop) {
            r.propertyTitle = prop.title;
            if (typeof r.propertyId !== 'object') {
                r.propertyId = { _id: prop._id, title: prop.title };
            }
        }
    }
    return r;
}

const createReview = async (req, res) => {
    try {
        const reviewerId = String(req.user.id || '');
        const { agreementId, revieweeId, propertyId, reviewType, ratings, rating, comment } = req.body;
        const score = Number(ratings?.overall || rating || 5);

        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            mockStore.agreements = mockStore.agreements || [];
            const agr = mockStore.agreements.find(a => String(a._id) === String(agreementId));

            const resolvedPropertyId = String(
                (propertyId && (propertyId._id || propertyId)) ||
                (agr && agr.propertyId && (agr.propertyId._id || agr.propertyId)) ||
                ''
            );
            const resolvedRevieweeId = String(
                (revieweeId && (revieweeId._id || revieweeId)) ||
                (agr && agr.landlordId && (agr.landlordId._id || agr.landlordId)) ||
                ''
            );

            const revUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === reviewerId) || req.user;
            const reviewerName = revUser ? `${revUser.firstName || ''} ${revUser.lastName || ''}`.trim() : 'Tenant';

            const prop = (mockStore.properties || []).find(p => String(p._id) === resolvedPropertyId);
            const propertyTitle = prop?.title || (agr?.propertyId?.title) || 'Property';

            const rType = reviewType || 'tenant_to_property';

            const newRev = {
                _id: 'mock-rev-' + Date.now(),
                reviewerId,
                reviewerName,
                authorId: {
                    _id: reviewerId,
                    firstName: revUser?.firstName || 'Tenant',
                    lastName: revUser?.lastName || 'User',
                },
                revieweeId: resolvedRevieweeId,
                propertyId: resolvedPropertyId,
                propertyTitle,
                agreementId: String(agreementId || ''),
                reviewType: rType,
                rating: score,
                ratings: {
                    overall: score,
                    maintenance: Number(ratings?.maintenance) || score,
                    leaseFairness: Number(ratings?.leaseFairness) || score,
                    propertyAccuracy: Number(ratings?.propertyAccuracy) || score,
                    communication: Number(ratings?.communication) || score,
                    moveInHandover: Number(ratings?.moveInHandover) || score,
                    depositFairness: Number(ratings?.depositFairness) || score,
                    tenancyStage: ratings?.tenancyStage || 'move_in',
                    wouldRecommend: ratings?.wouldRecommend || 'yes',
                    paymentReliability: Number(ratings?.paymentReliability) || score,
                    propertyCare: Number(ratings?.propertyCare) || score,
                    conductAndRules: Number(ratings?.conductAndRules) || score,
                    wouldRentAgain: ratings?.wouldRentAgain || 'yes',
                },
                comment: comment || '',
                status: 'published',
                createdAt: new Date().toISOString()
            };

            // Prevent duplicate review for same agreement & type & reviewer
            const existingIdx = mockStore.reviews.findIndex(r => 
                String(r.agreementId) === String(agreementId) && 
                r.reviewType === rType && 
                String(r.reviewerId) === reviewerId
            );
            if (existingIdx !== -1) {
                newRev._id = mockStore.reviews[existingIdx]._id;
                mockStore.reviews[existingIdx] = newRev;
            } else {
                mockStore.reviews.push(newRev);
            }
            persistMockData();

            if (resolvedRevieweeId) {
                mockCreateNotification(
                    resolvedRevieweeId,
                    'system',
                    'New Review Received',
                    `You received a new ${score}-star review from your tenant.`
                );
            }

            return res.status(201).json({ message: "Review submitted successfully", review: newRev });
        }

        // Real MongoDB mode
        const agreement = await RentalAgreement.findById(agreementId);
        if (!agreement) {
            return res.status(404).json({ message: "Rental agreement not found." });
        }

        const isTenant = agreement.tenantId.toString() === reviewerId;
        const isLandlord = agreement.landlordId.toString() === reviewerId;

        if (!isTenant && !isLandlord) {
            return res.status(403).json({ message: "Unauthorized: You are not part of this rental agreement." });
        }

        if (reviewType === 'tenant_to_landlord' || reviewType === 'tenant_to_property') {
            if (!isTenant) return res.status(400).json({ message: "Only tenants can leave this type of review." });
        }
        if (reviewType === 'landlord_to_tenant') {
            if (!isLandlord) return res.status(400).json({ message: "Only landlords can leave this type of review." });
        }

        if (revieweeId === reviewerId) {
            return res.status(400).json({ message: "You cannot review yourself." });
        }

        const existingReview = await Review.findOne({ agreementId, reviewType, reviewerId });
        if (existingReview) {
            return res.status(400).json({ message: "You have already submitted this type of review for this agreement." });
        }

        const review = await Review.create({
            reviewerId,
            revieweeId: revieweeId || (isTenant ? agreement.landlordId : agreement.tenantId),
            propertyId: propertyId || agreement.propertyId,
            agreementId,
            reviewType,
            ratings: {
                overall: score,
                ...ratings
            },
            comment
        });

        if (review.revieweeId) {
            await Notification.create({
                userId: review.revieweeId,
                type: 'system',
                title: 'New Review Received',
                body: `You received a new ${score}-star review.`,
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
            const reviews = mockStore.reviews
                .filter(r => String(r.propertyId) === String(propertyId) && r.status !== 'removed')
                .map(enrichReview);

            const avgRating = reviews.length > 0
                ? reviews.reduce((acc, curr) => acc + (curr.rating || curr.ratings?.overall || 5), 0) / reviews.length
                : 0;

            return res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews, data: reviews });
        }
        const reviews = await Review.find({ propertyId, status: 'published', reviewType: 'tenant_to_property' })
            .populate('reviewerId', 'firstName lastName profileImage')
            .sort({ createdAt: -1 });

        const mapped = reviews.map(r => ({
            ...r.toObject(),
            rating: r.ratings?.overall || 5,
        }));
        const avgRating = mapped.length > 0 ? mapped.reduce((acc, curr) => acc + curr.rating, 0) / mapped.length : 0;

        res.status(200).json({ average: avgRating.toFixed(1), count: mapped.length, reviews: mapped, data: mapped });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const reviews = mockStore.reviews
                .filter(r => String(r.revieweeId) === String(userId))
                .map(enrichReview);

            const avgRating = reviews.length > 0
                ? reviews.reduce((acc, curr) => acc + (curr.rating || curr.ratings?.overall || 5), 0) / reviews.length
                : 0;

            return res.status(200).json({ average: avgRating.toFixed(1), count: reviews.length, reviews, data: reviews });
        }
        const reviews = await Review.find({ revieweeId: userId, status: 'published' })
            .populate('reviewerId', 'firstName lastName profileImage')
            .sort({ createdAt: -1 });

        const mapped = reviews.map(r => ({
            ...r.toObject(),
            rating: r.ratings?.overall || 5,
        }));
        const avgRating = mapped.length > 0 ? mapped.reduce((acc, curr) => acc + curr.rating, 0) / mapped.length : 0;

        res.status(200).json({ average: avgRating.toFixed(1), count: mapped.length, reviews: mapped, data: mapped });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const rateTenant = async (req, res) => {
    try {
        const reviewerId = String(req.user.id || req.user.userId || '');
        const { agreementId, rating, comment, paymentScore, careScore, conductScore, commScore, wouldRentAgain } = req.body;

        if (!agreementId) {
            return res.status(400).json({ message: "Agreement ID is required" });
        }

        const score = Number(rating) || 5;

        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            mockStore.agreements = mockStore.agreements || [];
            const agr = mockStore.agreements.find(a => String(a._id) === String(agreementId));

            const tenantId = agr && typeof agr.tenantId === 'object' ? agr.tenantId._id : (agr ? agr.tenantId : 'mock-user-1793083864425');
            const propertyId = agr && typeof agr.propertyId === 'object' ? agr.propertyId._id : (agr ? agr.propertyId : '');

            const tenantUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === String(tenantId));
            const tenantName = (agr && agr.tenantId && typeof agr.tenantId === 'object')
                ? `${agr.tenantId.firstName || ''} ${agr.tenantId.lastName || ''}`.trim()
                : (tenantUser ? `${tenantUser.firstName || ''} ${tenantUser.lastName || ''}`.trim() : 'Tenant');

            const prop = (mockStore.properties || []).find(p => String(p._id) === String(propertyId));
            const propertyTitle = prop?.title || (agr?.propertyId?.title) || 'Property';

            const revUser = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === reviewerId) || req.user;
            const reviewerName = revUser ? `${revUser.firstName || ''} ${revUser.lastName || ''}`.trim() : 'Landlord';

            const review = {
                _id: 'mock-rev-' + Date.now(),
                agreementId: String(agreementId),
                reviewerId,
                reviewerName,
                authorId: {
                    _id: reviewerId,
                    firstName: revUser?.firstName || 'Landlord',
                    lastName: revUser?.lastName || 'User',
                },
                revieweeId: String(tenantId),
                revieweeName: tenantName,
                propertyId: String(propertyId),
                propertyTitle,
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

            const existingIdx = mockStore.reviews.findIndex(r => String(r.agreementId) === String(agreementId) && r.reviewType === 'landlord_to_tenant');
            if (existingIdx !== -1) {
                review._id = mockStore.reviews[existingIdx]._id;
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
        const userEmail = (req.user?.email || '').toLowerCase().trim();

        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const myReviews = mockStore.reviews
                .filter(r => {
                    if (String(r.reviewerId) === userId || String(r.revieweeId) === userId) return true;
                    const reviewer = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === String(r.reviewerId));
                    const reviewee = [...(mockStore.users ? mockStore.users.values() : [])].find(u => String(u._id) === String(r.revieweeId));
                    return (reviewer && reviewer.email === userEmail) || (reviewee && reviewee.email === userEmail);
                })
                .map(enrichReview);

            return res.status(200).json({ success: true, count: myReviews.length, data: myReviews });
        }
        const reviews = await Review.find({
            $or: [{ reviewerId: userId }, { revieweeId: userId }]
        }).populate('reviewerId', 'firstName lastName profileImage')
          .populate('revieweeId', 'firstName lastName profileImage')
          .populate('propertyId', 'title')
          .sort({ createdAt: -1 });

        const mapped = reviews.map(r => ({
            ...r.toObject(),
            rating: r.ratings?.overall || 5,
        }));
        res.status(200).json({ success: true, count: mapped.length, data: mapped });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getMyPropertiesReviews = async (req, res) => {
    try {
        const userId = String(req.user.id || req.user.userId || '');
        const userEmail = (req.user?.email || '').toLowerCase().trim();

        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const myPropIds = new Set(
                (mockStore.properties || [])
                    .filter(p => String(p.landlordId?._id || p.landlordId) === userId || (p.landlordId?.email === userEmail))
                    .map(p => String(p._id))
            );
            const myAgrIds = new Set(
                (mockStore.agreements || [])
                    .filter(a => String(a.landlordId?._id || a.landlordId) === userId || (a.landlordId?.email === userEmail))
                    .map(a => String(a._id))
            );

            const reviews = mockStore.reviews
                .filter(r => {
                    const isPropReview = r.reviewType === 'tenant_to_property' || r.reviewType === 'tenant_to_landlord';
                    if (!isPropReview) return false;
                    return String(r.revieweeId) === userId ||
                           myPropIds.has(String(r.propertyId)) ||
                           myAgrIds.has(String(r.agreementId));
                })
                .map(enrichReview);

            return res.status(200).json({ success: true, count: reviews.length, data: reviews, reviews });
        }

        const myProperties = await Property.find({ landlordId: req.user.id }).select('_id');
        const propertyIds = myProperties.map(p => p._id);

        const reviews = await Review.find({
            $or: [
                { propertyId: { $in: propertyIds } },
                { revieweeId: req.user.id }
            ],
            reviewType: { $in: ['tenant_to_property', 'tenant_to_landlord'] }
        })
        .populate('reviewerId', 'firstName lastName profileImage')
        .populate('propertyId', 'title')
        .sort({ createdAt: -1 });

        const mapped = reviews.map(r => ({
            ...r.toObject(),
            rating: r.ratings?.overall || 5,
        }));
        res.status(200).json({ success: true, count: mapped.length, data: mapped, reviews: mapped });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const replyReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;
        if (!reply || !reply.trim()) {
            return res.status(400).json({ message: "Reply text is required" });
        }
        if (isMockMode()) {
            mockStore.reviews = mockStore.reviews || [];
            const rev = mockStore.reviews.find(r => String(r._id) === String(id));
            if (!rev) {
                return res.status(404).json({ message: "Review not found" });
            }
            rev.landlordReply = reply.trim();
            rev.landlordRepliedAt = new Date().toISOString();
            persistMockData();

            if (rev.reviewerId) {
                mockCreateNotification(
                    rev.reviewerId,
                    'system',
                    'Landlord Replied to Your Review',
                    `Your landlord responded: "${reply.trim().slice(0, 80)}..."`
                );
            }

            return res.status(200).json({ success: true, message: "Reply posted successfully", data: rev });
        }

        const rev = await Review.findByIdAndUpdate(id, {
            response: { body: reply.trim(), respondedAt: new Date() }
        }, { new: true });

        if (!rev) {
            return res.status(404).json({ message: "Review not found" });
        }

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
