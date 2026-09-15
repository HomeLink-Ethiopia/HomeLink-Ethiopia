const { Conversation, Message } = require('../models/Conversation');
const Notification = require('../models/Notification');

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        await Notification.create({
            userId, type, title, body,
            relatedEntity: { entityType, entityId },
            channels: ['in_app']
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiverId, body, propertyId, contextType, contextId } = req.body;
        
        const mediaKeys = req.files ? req.files.map(file => file.path) : [];

        if (!body && mediaKeys.length === 0) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        // Deduce tenant and landlord based on sender's role
        let tenantId, landlordId;
        if (req.user.role === 'tenant') {
            tenantId = senderId;
            landlordId = receiverId;
        } else {
            landlordId = senderId;
            tenantId = receiverId;
        }

        // Find existing conversation or create a new one
        let conversation = await Conversation.findOne({
            tenantId,
            landlordId,
            contextType: contextType || 'general',
            contextId: contextId || null
        });

        if (!conversation) {
            conversation = await Conversation.create({
                tenantId,
                landlordId,
                propertyId,
                contextType: contextType || 'general',
                contextId
            });
        }

        // Create the message
        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            receiverId,
            body,
            mediaKeys
        });

        // Update the conversation's denormalized fields
        conversation.lastMessage = body ? body.substring(0, 50) : "Sent an attachment";
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Notify the receiver
        await createNotification(
            receiverId, 'new_message', 'New Message',
            `You received a new message.`,
            'Conversation', conversation._id
        );

        res.status(201).json({ message: "Message sent", data: message });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const conversations = await Conversation.find({ 
            $or: [{ tenantId: userId }, { landlordId: userId }] 
        })
            .populate('tenantId', 'firstName lastName profileImage')
            .populate('landlordId', 'firstName lastName profileImage')
            .populate('propertyId', 'title')
            .sort({ lastMessageAt: -1 });

        // Format for the frontend to easily show the "other user"
        const formattedConversations = conversations.map(conv => {
            const doc = conv.toObject();
            
            // If I am the tenant, the other user is the landlord (and vice versa)
            if (doc.tenantId && doc.tenantId._id.toString() === userId) {
                doc.otherUser = doc.landlordId;
            } else {
                doc.otherUser = doc.tenantId;
            }
            
            // Clean up the response payload
            delete doc.tenantId;
            delete doc.landlordId;
            
            return doc;
        });

        res.status(200).json(formattedConversations);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const isParticipant = conversation.tenantId.toString() === userId || conversation.landlordId.toString() === userId;
        if (!isParticipant) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const messages = await Message.find({ conversationId })
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        // Mark all messages where I am the receiver as read
        await Message.updateMany(
            { conversationId, receiverId: userId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await Message.countDocuments({
            receiverId: userId,
            isRead: false
        });

        res.status(200).json({ unreadCount: count });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    sendMessage,
    getConversations,
    getMessages,
    markAsRead,
    getUnreadCount
};
