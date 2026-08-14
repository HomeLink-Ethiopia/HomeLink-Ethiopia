// ============================================================
// 14. DISPUTES (FR-12)
// Manages formal conflicts between tenants and landlords.
// Acts as a centralized "Resolution Center" with bounded 
// communication threads and strict audit trails.
// ============================================================
const DisputeSchema = {
  // Unique database identifier
  _id: ObjectId,
  
  // ─────────────────────────────────────────────────────────────
  // CORE RELATIONSHIPS
  // ─────────────────────────────────────────────────────────────
  
  // The user who initiated the complaint
  raisedBy: { type: ObjectId, ref: "Account", required: true },
  
  // The user being complained about
  againstUserId: { type: ObjectId, ref: "Account", required: true },
  
  // Optional but recommended: The specific lease contract in dispute
  agreementId: { type: ObjectId, ref: "RentalAgreement" },
  
  // Optional: The physical property where the dispute occurred
  propertyId: { type: ObjectId, ref: "Property" },
  
  // Audit trail: The admin mediating the conflict
  handledBy: { type: ObjectId, ref: "Account" }, 

  // ─────────────────────────────────────────────────────────────
  // DISPUTE DETAILS
  // ─────────────────────────────────────────────────────────────
  category: {
    type: String,
    enum: [
      "unpaid_rent", 
      "deposit_dispute", 
      "property_damage", 
      "maintenance_neglect", 
      "eviction", 
      "other"
    ],
    required: true,
  },
  
  description: { type: String, required: true },
  
  // Secure object-storage keys for uploaded photos, receipts, or contracts
  evidenceKeys: [String],

  // ─────────────────────────────────────────────────────────────
  // MODERATION WORKFLOW
  // ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      "open",           // Newly submitted
      "under_review",   // Admin has started investigating
      "mediation",      // Admin is actively talking to both parties
      "resolved",       // Issue settled on the platform
      "closed",         // Ticket archived
      "escalated"       // Moved outside the platform (e.g., to local authorities/police)
    ],
    default: "open",
  },

  // ─────────────────────────────────────────────────────────────
  // COMMUNICATIONS (Resolution Center)
  // ─────────────────────────────────────────────────────────────
  // Bounded thread allowing users and admins to discuss the ticket directly.
  // PERFORMANCE NOTE: If this array grows beyond ~30 entries, older messages 
  // should be archived to a separate 'dispute_messages' collection.
  communications: [{
    fromUserId: { type: ObjectId, ref: "Account" },
    message: String,
    attachments: [String], // Keys for additional evidence uploaded during the chat
    
    // If true, this message is strictly an internal note for other admins 
    // and must be hidden from the tenant/landlord UI.
    isAdminNote: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  }],

  // ─────────────────────────────────────────────────────────────
  // RESOLUTION & AUDIT
  // ─────────────────────────────────────────────────────────────
  
  // The final verdict written by the admin (e.g., "Landlord must refund 50% of deposit")
  outcome: String,
  resolvedAt: Date,

  // Immutable ledger of every status change
  history: [{
    status: String,
    changedBy: { type: ObjectId, ref: "Account" },
    changedAt: Date,
    note: String,
  }],

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - raisedBy: 1 (Allows a user to quickly view their own submitted disputes)
// - againstUserId: 1 (Allows a user to see disputes filed against them)
// - agreementId: 1 (Crucial for linking disputes to specific lease contracts)
// - status: 1 (Allows the admin dashboard to filter open/urgent tickets)
// ============================================================