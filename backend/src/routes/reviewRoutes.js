const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const {
    createReview,
    getPropertyReviews,
    getUserReviews
} = require('../controller/reviewController');

// Submit a new review
router.post('/', authMiddleware, createReview);

// Get all published reviews for a specific property (Public)
router.get('/property/:propertyId', getPropertyReviews);

// Get all published reviews for a specific user (Public)
router.get('/user/:userId', getUserReviews);

module.exports = router;
