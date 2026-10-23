/**
 * Sprint 9 — Communication compat routes (/api/v1/messages).
 *
 * The frontend (tenant + landlord messages pages) calls:
 *   GET    /api/v1/messages/conversations            → list conversations
 *   GET    /api/v1/messages/:conversationId          → message history
 *   PATCH  /api/v1/messages/:conversationId/read     → mark read
 *   POST   /api/v1/messages                          → send { conversationId?, receiverId?, text, propertyId? }
 *
 * The team's controllers live under /api/v1/communication with slightly
 * different shapes, so this router adapts between the two contracts without
 * touching team code. Both roles can talk here — the conversation model is
 * symmetric (tenantId/landlordId), the sender's role decides which side they are.
 */
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
// ─── Sprint 8/9: mock-mode messaging so tenant ↔ landlord chat works offline ───
// (sprint89-mock-messaging) Mirrors the real-DB branches below using mockStore.
const mongoose = require('mongoose');
const { isMockMode, mockStore, mockCreateNotification } = require('../config/db');

const mockUser = (id) => {
  if (!id) return null;
  const map = mockStore.users;
  let u = map && map.get && map.get(String(id));
  if (!u && map && typeof map.values === 'function') {
    u = Array.from(map.values()).find((x) => x._id === id || x.email === id);
  }
  if (!u && (id === 'mock-landlord-1' || id === 'dev.landlord@homelink.test')) {
    u = map && map.get && map.get('dev.landlord@homelink.test');
  }
  if (!u && mockStore.landlordProfiles) {
    let lp = mockStore.landlordProfiles.get(id);
    if (!lp) {
      for (const p of mockStore.landlordProfiles.values()) {
        if (p._id === id || p.accountId === id) {
          lp = p;
          break;
        }
      }
    }
    if (lp) {
      const accId = lp.accountId || lp._id;
      u = map && map.get && map.get(String(accId));
      if (!u && map && typeof map.values === 'function') {
        u = Array.from(map.values()).find((x) => x._id === accId || x.email === accId);
      }
      if (!u && (accId === 'mock-landlord-1' || !accId)) {
        u = map && map.get && map.get('dev.landlord@homelink.test');
      }
      if (!u) {
        u = {
          _id: accId,
          firstName: lp.legalName ? lp.legalName.split(' ')[0] : 'Landlord',
          lastName: lp.legalName ? lp.legalName.split(' ').slice(1).join(' ') : '',
          role: 'landlord',
          email: 'landlord@homelink.test',
          phone: lp.phone || '',
        };
      }
    }
  }
  return u || null;
};

router.post('/sprint89-router-ready', (req, res) => res.json({ ok: true }));

const { Conversation, Message } = require('../models/Conversation');
const User = require('../models/User');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Notification = require('../models/Notification');

// POST /api/v1/messages — send a message. Accepts either an existing
// conversationId OR receiverId (+optional propertyId) to start a new thread,
// which is what the property-page "Message Landlord" modal sends.
router.post('/', authMiddleware, async (req, res) => {
  // (sprint89-mock-messaging) mock branch
  if (isMockMode()) {
    const senderId = req.user.id;
    const { conversationId, receiverId, text, body, propertyId } = req.body;
    const text_ = String(text || body || '').trim();
    if (!text_) return res.status(400).json({ message: 'Message cannot be empty' });

    let conv;
    if (conversationId) {
      conv = (mockStore.conversations || []).find((c) => c._id === conversationId);
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (conv.tenantId !== senderId && conv.landlordId !== senderId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    } else {
      let other = receiverId ? mockUser(receiverId) : null;
      // If other not found or not provided, try resolving from propertyId
      if (!other && propertyId) {
        const prop = (mockStore.properties || []).find((p) => p._id === propertyId);
        if (prop) {
          const lId = typeof prop.landlordId === 'object' ? (prop.landlordId.accountId || prop.landlordId._id) : prop.landlordId;
          other = mockUser(lId);
          if (!other && (lId === 'mock-landlord-1' || !lId)) {
            other = mockUser('mock-landlord-1') || mockUser('dev.landlord@homelink.test');
          }
        }
      }

      if (!other) return res.status(404).json({ message: 'Recipient not found' });
      const targetUserId = String(other._id);
      if (targetUserId === String(senderId)) return res.status(400).json({ message: 'You cannot message yourself' });

      const senderRole = req.user.role;
      let tenantId, landlordId;
      if (senderRole === 'tenant') {
        tenantId = senderId;
        landlordId = targetUserId;
      } else if (senderRole === 'landlord') {
        landlordId = senderId;
        tenantId = targetUserId;
      } else {
        if (other.role === 'landlord') {
          tenantId = senderId;
          landlordId = targetUserId;
        } else {
          tenantId = targetUserId;
          landlordId = senderId;
        }
      }

      conv = (mockStore.conversations || []).find((c) => c.tenantId === tenantId && c.landlordId === landlordId && (c.propertyId || null) === (propertyId || null));
      if (!conv) {
        conv = {
          _id: 'mock-conv-' + Date.now(),
          tenantId, landlordId,
          propertyId: propertyId || null,
          contextType: 'general',
          createdAt: new Date().toISOString(),
        };
        mockStore.conversations.push(conv);
      }
    }

    const receiverId_ = conv.tenantId === senderId ? conv.landlordId : conv.tenantId;
    const msg = {
      _id: 'mock-msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      conversationId: conv._id,
      senderId,
      receiverId: receiverId_,
      body: text_,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    mockStore.messages.push(msg);
    conv.lastMessage = text_;
    conv.lastMessageAt = msg.createdAt;
    mockCreateNotification(receiverId_, 'message_received', 'New Message', text_.slice(0, 120), 'Conversation', conv._id);

    return res.status(201).json({
      data: { _id: msg._id, conversationId: conv._id, senderId, text: msg.body, createdAt: msg.createdAt, isRead: false },
    });
  }

  try {
    const senderId = req.user.id;
    const senderRole = req.user.role;
    const { conversationId, receiverId, text, body, propertyId } = req.body;
    const text_ = (text || body || '').trim();

    if (!text_) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    let conversation = null;

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      const isParticipant =
        String(conversation.tenantId) === String(senderId) ||
        String(conversation.landlordId) === String(senderId);
      if (!isParticipant) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    } else {
      // Start (or reuse) a conversation with a specific user
      let other = null;
      if (receiverId) {
        try {
          other = await User.findById(receiverId);
        } catch {}
        if (!other) {
          try {
            const lp = await LandlordProfile.findById(receiverId);
            if (lp && lp.accountId) {
              other = await User.findById(lp.accountId);
            }
          } catch {}
        }
      }
      if (!other && propertyId) {
        try {
          const prop = await Property.findById(propertyId).populate('landlordId');
          if (prop && prop.landlordId) {
            const accId = prop.landlordId.accountId || prop.landlordId._id;
            if (accId) other = await User.findById(accId);
          }
        } catch {}
      }

      if (!other) {
        return res.status(404).json({ message: 'Recipient not found' });
      }
      const targetUserId = String(other._id);
      if (targetUserId === String(senderId)) {
        return res.status(400).json({ message: 'You cannot message yourself' });
      }

      // Determine tenant/landlord sides from roles
      let tenantId, landlordId;
      if (senderRole === 'landlord' || other.role === 'tenant') {
        landlordId = senderRole === 'landlord' ? senderId : targetUserId;
        tenantId = senderRole === 'tenant' ? senderId : targetUserId;
      } else {
        tenantId = senderRole === 'tenant' ? senderId : targetUserId;
        landlordId = senderRole === 'landlord' ? senderId : targetUserId;
      }
      if (!tenantId || !landlordId) {
        return res.status(400).json({ message: 'Conversations are between tenants and landlords' });
      }

      conversation = await Conversation.findOne({
        tenantId,
        landlordId,
        propertyId: propertyId || null,
      });
      if (!conversation) {
        conversation = await Conversation.create({
          tenantId,
          landlordId,
          propertyId: propertyId || null,
          contextType: 'general',
        });
      }
    }

    const receiverId_ =
      String(conversation.tenantId) === String(senderId)
        ? conversation.landlordId
        : conversation.tenantId;

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId: receiverId_,
      body: text_,
    });

    conversation.lastMessage = text_;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await Notification.create({
      userId: receiverId_,
      type: 'message_received',
      title: 'New Message',
      body: text_.slice(0, 120),
      relatedEntity: { entityType: 'Conversation', entityId: conversation._id },
      channels: ['in_app'],
    }).catch(() => {});

    res.status(201).json({
      data: {
        _id: message._id,
        conversationId: conversation._id,
        senderId: message.senderId,
        text: message.body,
        createdAt: message.createdAt,
        isRead: message.isRead,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/v1/messages/conversations — inbox for the logged-in user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    // (sprint89-mock-messaging) mock branch
    if (isMockMode()) {
      const userId = req.user.id;
      const rows = (mockStore.conversations || [])
        .filter((c) => c.tenantId === userId || c.landlordId === userId)
        .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
        .map((c) => {
          const meIsTenant = c.tenantId === userId;
          const otherId = meIsTenant ? c.landlordId : c.tenantId;
          const other = mockUser(otherId);
          const o = other
            ? { _id: other._id, firstName: other.firstName, lastName: other.lastName, email: other.email, role: other.role }
            : { _id: otherId, firstName: 'User', lastName: '', role: meIsTenant ? 'landlord' : 'tenant' };
          const me = { _id: userId };
          return {
            _id: c._id,
            participants: meIsTenant ? [me, o] : [o, me],
            otherUser: o,
            propertyId: c.propertyId || null,
            lastMessage: c.lastMessage || '',
            lastMessageAt: c.lastMessageAt || c.createdAt,
          };
        });
      return res.status(200).json({ data: rows });
    }

    const userId = req.user.id;
    const conversations = await Conversation.find({
      $or: [{ tenantId: userId }, { landlordId: userId }],
    })
      .populate('tenantId', 'firstName lastName email role')
      .populate('landlordId', 'firstName lastName email role')
      .populate('propertyId', 'title')
      .sort({ lastMessageAt: -1 })
      .lean();

    const formatted = conversations.map((conv) => {
      const meIsTenant = String(conv.tenantId?._id) === String(userId);
      const other = meIsTenant ? conv.landlordId : conv.tenantId;
      // Frontend renders conv.participants[] — me first, other second
      const participants = meIsTenant ? [conv.tenantId, conv.landlordId] : [conv.landlordId, conv.tenantId];
      return {
        _id: conv._id,
        participants,
        otherUser: other,
        propertyId: conv.propertyId || null,
        lastMessage: conv.lastMessage || '',
        lastMessageAt: conv.lastMessageAt || conv.createdAt,
      };
    });

    res.status(200).json({ data: formatted });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/v1/messages/:conversationId — full history (participant only)
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    // (sprint89-mock-messaging) mock branch
    if (isMockMode()) {
      const userId = req.user.id;
      const conv = (mockStore.conversations || []).find((c) => c._id === req.params.conversationId);
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (conv.tenantId !== userId && conv.landlordId !== userId) return res.status(403).json({ message: 'Unauthorized' });
      const msgs = (mockStore.messages || [])
        .filter((m) => m.conversationId === conv._id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((m) => ({ _id: m._id, senderId: m.senderId, text: m.body, createdAt: m.createdAt, readAt: m.readAt || null }));
      return res.status(200).json({ data: msgs });
    }

    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const isParticipant =
      String(conversation.tenantId) === String(userId) ||
      String(conversation.landlordId) === String(userId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

    res.status(200).json({
      data: messages.map((m) => ({
        _id: m._id,
        senderId: m.senderId,
        text: m.body,
        createdAt: m.createdAt,
        readAt: m.readAt || null,
      })),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/v1/messages/:conversationId/read — mark incoming as read
router.patch('/:conversationId/read', authMiddleware, async (req, res) => {
  try {
    // (sprint89-mock-messaging) mock branch
    if (isMockMode()) {
      const userId = req.user.id;
      (mockStore.messages || []).forEach((m) => {
        if (m.conversationId === req.params.conversationId && m.receiverId === userId && !m.isRead) {
          m.isRead = true;
          m.readAt = new Date().toISOString();
        }
      });
      return res.status(200).json({ message: 'Messages marked as read' });
    }

    const { conversationId } = req.params;
    const userId = req.user.id;
    await Message.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
