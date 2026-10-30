const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    sendMessage,
    getConversations,
    getMessages,
    markAsRead,
    getUnreadCount
} = require('../controller/communicationController');

// Send a message (can include file attachments)
router.post('/', authMiddleware, documentUpload.array('media', 3), sendMessage);

// Get the user's conversation inbox
router.get('/', authMiddleware, getConversations);
router.get('/conversations', authMiddleware, getConversations);

// Get global unread message count
router.get('/unread/count', authMiddleware, getUnreadCount);

// Get the message history for a specific conversation
router.get('/:conversationId/messages', authMiddleware, getMessages);
router.get('/:conversationId', authMiddleware, getMessages);

// Mark a conversation's messages as read
router.put('/:conversationId/read', authMiddleware, markAsRead);
router.patch('/:conversationId/read', authMiddleware, markAsRead);

module.exports = router;
