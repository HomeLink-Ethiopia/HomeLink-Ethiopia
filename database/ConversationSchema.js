// ============================================================
// 11. CONVERSATIONS & MESSAGES
// Manages internal communications between users.
// Supports contextual chats (e.g., chatting specifically about a maintenance ticket).
// ============================================================

const ConversationSchema = {
  // Unique MongoDB identifier for the chat thread
  _id: ObjectId,
  
  // The two users in the chat. Array must contain exactly 2 ObjectIds.
  participants: [{ type: ObjectId, ref: "Account" }], 
  
  // Optional: The physical property they are discussing
  propertyId: { type: ObjectId, ref: "Property" },
  
  // ─────────────────────────────────────────────────────────────
  // CONTEXTUAL ROUTING
  // Allows the frontend to load specific widgets (like a lease summary) 
  // inside the chat UI based on what the conversation is about.
  // ─────────────────────────────────────────────────────────────
  contextType: { 
    type: String, 
    enum: ["application", "viewing", "maintenance", "agreement", "general"] 
  },
  
  // The specific ID of the application, viewing, or maintenance ticket
  contextId: ObjectId,

  // ─────────────────────────────────────────────────────────────
  // UI OPTIMIZATION
  // ─────────────────────────────────────────────────────────────
  
  // Denormalized snippet of the latest message for the inbox list view.
  // Prevents the backend from querying the Message collection just to load the inbox.
  lastMessage: String, 
  lastMessageAt: Date,
  
  createdAt: { type: Date, default: Date.now },
};

// ============================================================
// RECOMMENDED INDEXES FOR CONVERSATION
// - participants: 1 (Multikey index to quickly find a user's active chats)
// - propertyId: 1
// - lastMessageAt: -1 (To sort the inbox by most recently active)
// ============================================================

// ─────────────────────────────────────────────────────────────

const MessageSchema = {
  // Unique MongoDB identifier for the specific message bubble
  _id: ObjectId,
  
  // Links back to the parent conversation thread
  conversationId: { type: ObjectId, ref: "Conversation", required: true },
  
  senderId: { type: ObjectId, ref: "Account", required: true },
  receiverId: { type: ObjectId, ref: "Account", required: true },

  // ─────────────────────────────────────────────────────────────
  // MESSAGE CONTENT
  // ─────────────────────────────────────────────────────────────
  body: String,
  
  // Secure object-storage keys for shared images or documents
  mediaKeys: [String], 

  // ─────────────────────────────────────────────────────────────
  // READ RECEIPTS
  // ─────────────────────────────────────────────────────────────
  isRead: { type: Boolean, default: false },
  readAt: Date,

  // ─────────────────────────────────────────────────────────────
  // ASYMMETRIC DELETION (Soft Deletes)
  // ─────────────────────────────────────────────────────────────
  // If true, the message is hidden from that specific user's UI, 
  // but remains visible to the other user and in the database for audits.
  deletedBySender: { type: Boolean, default: false },
  deletedByReceiver: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
};

// ============================================================
// RECOMMENDED INDEXES FOR MESSAGE
// - conversationId: 1, createdAt: 1 (Crucial for loading chat history in chronological order)
// - senderId: 1, receiverId: 1
// - receiverId: 1, isRead: 1 (Fast lookup for calculating unread message badges/notifications)
// ============================================================