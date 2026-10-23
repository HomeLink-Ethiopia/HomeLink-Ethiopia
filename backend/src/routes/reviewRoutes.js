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

// Frontend alias: GET /my — reviews written by the logged-in user
router.get('/my', authMiddleware, async (req, res) => {
    req.params.userId = req.user.id;
    return getUserReviews(req, res);
});

module.exports = router;
