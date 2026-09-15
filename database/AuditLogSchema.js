// ============================================================
// 16. AUDIT LOGS
// Security and compliance ledger. Tracks every critical action 
// taken on the platform with exact before/after state snapshots.
// ============================================================
const AuditLogSchema = {
  // Unique database identifier
  _id: ObjectId,
  
  // The user (or admin) who performed the action
  performedBy: { type: ObjectId, ref: "Account" },
  
  // Categorized action string (e.g., "property.verify", "user.suspend", "lease.terminate")
  action: { type: String, required: true }, 
  
  // Polymorphic reference to the exact document that was changed
  targetEntity: {
    entityType: String, // e.g., "Property", "Account", "RentalAgreement"
    entityId:   ObjectId,
  },
  
  // Security tracking
  ipAddress: String,
  userAgent: String, // Browser or mobile app version

  // ─────────────────────────────────────────────────────────────
  // STATE SNAPSHOTS (Diffing)
  // ─────────────────────────────────────────────────────────────
  
  // The complete JSON state of the document BEFORE the edit
  before: Object, 
  
  // The complete JSON state of the document AFTER the edit
  after: Object,  
  
  // Extra context (e.g., { reason: "Requested by user via email" })
  metadata: Object, 

  // Standard timestamp
  createdAt: { type: Date, default: Date.now },
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - performedBy: 1 (To view all actions taken by a specific admin)
// - "targetEntity.entityType": 1, "targetEntity.entityId": 1 (To see the history of a specific document)
// - action: 1, createdAt: -1
// 
// PRO-TIP: Apply a TTL (Time-To-Live) index to 'createdAt' to automatically 
// delete logs older than your legal retention policy (e.g., 2 years) to save DB storage.
// ============================================================

// ─────────────────────────────────────────────────────────────

// ============================================================
// 17. FAVOURITES
// Junction collection allowing tenants to save properties for later.
// Triggers a denormalized 'favouriteCount' update on the Property document.
// ============================================================
const FavouriteSchema = {
  // Unique database identifier
  _id: ObjectId,
  
  // The tenant saving the listing
  tenantId: { type: ObjectId, ref: "TenantProfile", required: true },
  
  // The listing being saved
  propertyId: { type: ObjectId, ref: "Property", required: true },
  
  createdAt: { type: Date, default: Date.now },
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - tenantId: 1, propertyId: 1 (Must be a UNIQUE compound index to prevent duplicate saves)
// - propertyId: 1 (Allows the backend to quickly count how many people favorited a property)
// ============================================================