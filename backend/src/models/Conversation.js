const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  
  contextType: { 
    type: String, 
    enum: ["application", "viewing", "maintenance", "agreement", "general"] 
  },
  contextId: mongoose.Schema.Types.ObjectId,

  lastMessage: String, 
  lastMessageAt: Date,
  
}, { timestamps: true });

conversationSchema.index({ tenantId: 1, landlordId: 1 });
conversationSchema.index({ propertyId: 1 });
conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

// ─────────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  body: String,
  mediaKeys: [String], 

  isRead: { type: Boolean, default: false },
  readAt: Date,

  deletedBySender: { type: Boolean, default: false },
  deletedByReceiver: { type: Boolean, default: false },

}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ receiverId: 1, isRead: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = {
  Conversation,
  Message
};
