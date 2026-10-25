const { Conversation, Message } = require('../models/Conversation');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

function ensureMockCommunications() {
    if (!mockStore.conversations) mockStore.conversations = [];
    if (!mockStore.messages) mockStore.messages = [];

    if (mockStore.conversations.length === 0) {
        const prop1 = (mockStore.properties || [])[0] || { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" };
        const conv1 = {
            _id: "conv-mock-1",
            tenantId: "mock-user-seed-1",
            landlordId: "mock-landlord-1",
            participants: [
                { _id: "mock-user-seed-1", firstName: "Abebe", lastName: "Kebede", email: "dev.tenant@homelink.test", role: "tenant" },
                { _id: "mock-landlord-1", firstName: "HomeLink", lastName: "Verified Landlord", email: "dev.landlord@homelink.test", role: "landlord" }
            ],
            propertyId: { _id: prop1._id, title: prop1.title },
            lastMessage: "The water tank pump inspection has been scheduled for tomorrow morning.",
            lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
            createdAt: new Date(Date.now() - 86400000).toISOString()
        };
        mockStore.conversations.push(conv1);

        mockStore.messages.push(
            {
                _id: "msg-seed-1",
                conversationId: "conv-mock-1",
                senderId: { _id: "mock-user-seed-1", firstName: "Abebe", lastName: "Kebede", role: "tenant" },
                text: "Selam! I submitted a maintenance request regarding the water pump pressure.",
                body: "Selam! I submitted a maintenance request regarding the water pump pressure.",
                isRead: true,
                createdAt: new Date(Date.now() - 7200000).toISOString()
            },
            {
                _id: "msg-seed-2",
                conversationId: "conv-mock-1",
                senderId: { _id: "mock-landlord-1", firstName: "HomeLink", lastName: "Verified Landlord", role: "landlord" },
                text: "The water tank pump inspection has been scheduled for tomorrow morning.",
                body: "The water tank pump inspection has been scheduled for tomorrow morning.",
                isRead: false,
                createdAt: new Date(Date.now() - 3600000).toISOString()
            }
        );
    }
}

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        const { mockCreateNotification } = require('../config/db');
        if (isMockMode() && typeof mockCreateNotification === 'function') {
            mockCreateNotification(userId, type, title, body, entityType, entityId);
            return;
        }
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
        const { conversationId, receiverId, body, text, propertyId, contextType, contextId } = req.body;
        const msgText = (text || body || "").trim();
        const mediaKeys = req.files ? req.files.map(file => file.path) : [];

        if (!msgText && mediaKeys.length === 0) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        if (isMockMode()) {
            ensureMockCommunications();
            let conv = mockStore.conversations.find(c => String(c._id) === String(conversationId));
            const targetRecv = receiverId || (req.user.role === 'tenant' ? 'mock-landlord-1' : 'mock-user-seed-1');

            if (!conv) {
                // Find existing conversation between the two users
                conv = mockStore.conversations.find(c => {
                    const hasSender = String(c.tenantId) === String(senderId) || String(c.landlordId) === String(senderId) ||
                        (c.participants || []).some(p => String(p._id || p.id) === String(senderId));
                    const hasReceiver = String(c.tenantId) === String(targetRecv) || String(c.landlordId) === String(targetRecv) ||
                        (c.participants || []).some(p => String(p._id || p.id) === String(targetRecv));
                    return hasSender && hasReceiver;
                });
            }

            // Lookup sender details
            let senderUser = null;
            if (mockStore.users) {
                if (mockStore.users instanceof Map) {
                    senderUser = mockStore.users.get(req.user.email) || null;
                    if (!senderUser) {
                        for (const u of mockStore.users.values()) {
                            if (String(u._id || u.id) === String(senderId)) {
                                senderUser = u;
                                break;
                            }
                        }
                    }
                } else if (Array.isArray(mockStore.users)) {
                    senderUser = mockStore.users.find(u => String(u._id || u.id) === String(senderId));
                }
            }
            if (!senderUser) {
                senderUser = {
                    _id: senderId,
                    firstName: req.user.firstName || (req.user.role === 'tenant' ? 'Tenant' : req.user.role === 'landlord' ? 'Landlord' : 'Support Admin'),
                    lastName: req.user.lastName || '',
                    email: req.user.email || '',
                    role: req.user.role || 'user'
                };
            }

            // Lookup receiver details
            let targetUser = null;
            if (mockStore.users) {
                if (mockStore.users instanceof Map) {
                    for (const u of mockStore.users.values()) {
                        if (String(u._id || u.id) === String(targetRecv)) {
                            targetUser = u;
                            break;
                        }
                    }
                } else if (Array.isArray(mockStore.users)) {
                    targetUser = mockStore.users.find(u => String(u._id || u.id) === String(targetRecv));
                }
            }

            if (!conv) {
                const prop = (mockStore.properties || []).find(p => String(p._id || p.id) === String(propertyId));
                conv = {
                    _id: "conv-mock-" + Date.now(),
                    tenantId: req.user.role === 'tenant' ? senderId : targetRecv,
                    landlordId: req.user.role === 'landlord' ? senderId : targetRecv,
                    adminId: req.user.role === 'admin' ? senderId : undefined,
                    participants: [
                        {
                            _id: senderId,
                            id: senderId,
                            firstName: senderUser.firstName,
                            lastName: senderUser.lastName,
                            email: senderUser.email,
                            role: senderUser.role
                        },
                        {
                            _id: targetRecv,
                            id: targetRecv,
                            firstName: targetUser ? targetUser.firstName : (req.user.role === 'tenant' ? 'HomeLink Landlord' : 'Tenant'),
                            lastName: targetUser ? targetUser.lastName : '',
                            email: targetUser ? targetUser.email : '',
                            role: targetUser ? targetUser.role : (req.user.role === 'tenant' ? 'landlord' : 'tenant')
                        }
                    ],
                    propertyId: { _id: propertyId || "prop-1", title: prop ? prop.title : "Rental Property" },
                    lastMessage: msgText,
                    lastMessageAt: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                };
                mockStore.conversations.unshift(conv);
            }

            const newMsg = {
                _id: "msg-" + Date.now(),
                conversationId: conv._id,
                senderId: senderUser,
                receiverId: targetRecv,
                text: msgText,
                body: msgText,
                mediaKeys,
                isRead: false,
                createdAt: new Date().toISOString()
            };

            mockStore.messages.push(newMsg);
            conv.lastMessage = msgText.substring(0, 80);
            conv.lastMessageAt = newMsg.createdAt;

            if (typeof persistMockData === 'function') persistMockData();
            return res.status(201).json({ message: "Message sent", data: newMsg, messageObj: newMsg });
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

        let conversation;
        if (conversationId) {
            conversation = await Conversation.findById(conversationId);
        }
        if (!conversation) {
            conversation = await Conversation.findOne({
                tenantId,
                landlordId,
                contextType: contextType || 'general',
                contextId: contextId || null
            });
        }

        if (!conversation) {
            conversation = await Conversation.create({
                tenantId,
                landlordId,
                propertyId,
                contextType: contextType || 'general',
                contextId
            });
        }

        const targetReceiver = receiverId || (conversation.tenantId.toString() === senderId ? conversation.landlordId : conversation.tenantId);

        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            receiverId: targetReceiver,
            body: msgText,
            mediaKeys
        });

        conversation.lastMessage = msgText ? msgText.substring(0, 50) : "Sent an attachment";
        conversation.lastMessageAt = new Date();
        await conversation.save();

        await createNotification(
            targetReceiver, 'new_message', 'New Message',
            `You received a new message.`,
            'Conversation', conversation._id
        );

        res.status(201).json({ message: "Message sent", data: message });
    } catch (error) {
        console.error("sendMessage error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getConversations = async (req, res) => {
    try {
        const userId = String(req.user.id || req.user.userId || '');
        const role = req.user.role;
        const userEmail = (req.user?.email || '').toLowerCase();
        const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userId === 'mock-user-seed-1';
        const isSeedLandlord = userEmail === 'dev.landlord@homelink.test' || userId === 'mock-landlord-1';
        const isAdmin = role === 'admin' || userEmail === 'dev.admin@homelink.test' || userId === 'mock-admin-1';

        if (isMockMode()) {
            ensureMockCommunications();
            const convs = (mockStore.conversations || []).filter(c => {
                if (isAdmin) {
                    return true;
                }
                const tId = String(c.tenantId || '');
                const lId = String(c.landlordId || '');
                const isParticipant = (c.participants || []).some(p => String(p._id || p.id) === userId);

                if (role === 'tenant') {
                    return tId === userId || isParticipant || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId));
                }
                if (role === 'landlord') {
                    return lId === userId || isParticipant || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId));
                }
                return isParticipant;
            });
            return res.status(200).json({ success: true, data: convs, conversations: convs });
        }
        
        let queryFilter = { $or: [{ tenantId: userId }, { landlordId: userId }] };
        if (role === 'admin') {
            queryFilter = {}; // Admin has platform-wide visibility
        }

        const conversations = await Conversation.find(queryFilter)
            .populate('tenantId', 'firstName lastName profileImage')
            .populate('landlordId', 'firstName lastName profileImage')
            .populate('propertyId', 'title')
            .sort({ lastMessageAt: -1 });

        const formattedConversations = conversations.map(conv => {
            const doc = conv.toObject();
            if (doc.tenantId && doc.tenantId._id.toString() === userId) {
                doc.otherUser = doc.landlordId;
            } else {
                doc.otherUser = doc.tenantId;
            }
            doc.participants = [doc.tenantId, doc.landlordId].filter(Boolean);
            return doc;
        });

        res.status(200).json({ success: true, data: formattedConversations, conversations: formattedConversations });
    } catch (error) {
        console.error("getConversations error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = String(req.user.id || req.user.userId || '');
        const isAdmin = req.user.role === 'admin' || req.user.email === 'dev.admin@homelink.test';

        if (isMockMode()) {
            ensureMockCommunications();
            const msgs = (mockStore.messages || []).filter(m => String(m.conversationId) === String(conversationId));
            return res.status(200).json({ success: true, data: msgs, messages: msgs });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const isParticipant = isAdmin || conversation.tenantId.toString() === userId || conversation.landlordId.toString() === userId;
        if (!isParticipant) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const messages = await Message.find({ conversationId })
            .populate('senderId', 'firstName lastName profileImage')
            .sort({ createdAt: 1 });

        res.status(200).json({ success: true, data: messages, messages: messages });
    } catch (error) {
        console.error("getMessages error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        if (isMockMode()) {
            ensureMockCommunications();
            (mockStore.messages || []).forEach(m => {
                if (String(m.conversationId) === String(conversationId)) {
                    m.isRead = true;
                    m.readAt = new Date().toISOString();
                }
            });
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Messages marked as read" });
        }

        await Message.updateMany(
            { conversationId, receiverId: userId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("markAsRead error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        if (isMockMode()) {
            return res.status(200).json({ unreadCount: 0 });
        }

        const count = await Message.countDocuments({
            receiverId: userId,
            isRead: false
        });

        res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error("getUnreadCount error:", error);
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
