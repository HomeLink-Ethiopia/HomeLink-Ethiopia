const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const {
    getMyNotifications,
    markAsRead,
    markAllAsRead
} = require('../controller/notificationController');

// All notification routes require the user to be logged in
router.use(authMiddleware);

router.get('/', getMyNotifications);
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
