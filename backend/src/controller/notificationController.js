const Notification = require('../models/Notification');

// Fetch all notifications for the logged-in user
const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50); // Pagination could be added here
            
        // Count unread
        const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });

        res.status(200).json({ unreadCount, notifications });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// Mark a single notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        
        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.status(200).json({ message: "Marked as read", notification });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// Mark all notifications as read (useful for a "Clear All" button)
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead
};
