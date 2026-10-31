const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const {
    createReview,
    rateTenant,
    getMyPropertiesReviews,
    getMineReviews,
    replyReview,
    getPropertyReviews,
    getUserReviews
} = require('../controller/reviewController');

// Submit a new review (tenant to property/landlord, or landlord to tenant)
router.post('/', authMiddleware, createReview);

// Rate tenant specifically (used by landlord portal agreements/reviews)
router.post('/rate-tenant', authMiddleware, rateTenant);

// Landlord's properties reviews
router.get('/my-properties', authMiddleware, getMyPropertiesReviews);

// Current user's reviews (both given and received)
router.get('/mine', authMiddleware, getMineReviews);

// Landlord reply to a review
router.put('/:id/reply', authMiddleware, replyReview);

// Get all published reviews for a specific property (Public)
router.get('/property/:propertyId', getPropertyReviews);

// Get all published reviews for a specific user (Public)
router.get('/user/:userId', getUserReviews);

module.exports = router;
