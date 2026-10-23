const Notification = require('../models/Notification');
const { isMockMode, mockStore } = require('../config/db'); // sprint89-notif-mock

// Fetch all notifications for the logged-in user
const getMyNotifications = async (req, res) => {
    try {
        if (isMockMode()) {
            // (sprint89-notif-mock) serve the centralized in-app feed from the mock store
            const rows = (mockStore.notifications || [])
                .filter((n) => String(n.userId) === String(req.user.id))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 50);
            const unread = rows.filter((n) => !n.isRead).length;
            return res.status(200).json({ unreadCount: unread, notifications: rows });
        }
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
        if (isMockMode()) { // sprint89-notif-read
            const n = (mockStore.notifications || []).find((x) => x._id === req.params.id && String(x.userId) === String(req.user.id));
            if (!n) return res.status(404).json({ message: "Notification not found" });
            n.isRead = true; n.readAt = new Date().toISOString();
            return res.status(200).json({ message: "Marked as read", notification: n });
        }
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
        if (isMockMode()) { // sprint89-notif-read
            (mockStore.notifications || []).forEach((n) => { if (String(n.userId) === String(req.user.id) && !n.isRead) { n.isRead = true; n.readAt = new Date().toISOString(); } });
            return res.status(200).json({ message: "All notifications marked as read" });
        }
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
