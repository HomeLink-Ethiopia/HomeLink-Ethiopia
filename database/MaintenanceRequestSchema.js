// ============================================================
// 10. MAINTENANCE REQUESTS (FR-09)
// Manages repair and maintenance tickets submitted by tenants.
// Connects tenants, landlords, and external service providers.
// ============================================================
const MaintenanceRequestSchema = {
  // Unique MongoDB identifier for the ticket
  _id: ObjectId,
  
  // ─────────────────────────────────────────────────────────────
  // CORE RELATIONSHIPS
  // ─────────────────────────────────────────────────────────────
  agreementId: { type: ObjectId, ref: "RentalAgreement" },
  propertyId:  { type: ObjectId, ref: "Property", required: true },
  tenantId:    { type: ObjectId, ref: "TenantProfile", required: true },
  landlordId:  { type: ObjectId, ref: "LandlordProfile", required: true },
  
  // Optional link to an external contractor (e.g., plumber, electrician) 
  // invited to the platform to handle the repair.
  assignedTo:  { type: ObjectId, ref: "Account" }, 

  // ─────────────────────────────────────────────────────────────
  // TICKET DETAILS
  // ─────────────────────────────────────────────────────────────
  title:       { type: String, required: true },
  description: String,
  
  category: {
    type: String,
    enum: ["plumbing", "electrical", "structural", "appliance", "cleaning", "pest", "security", "other"],
  },
  
  // Helps landlords triage emergencies vs. standard repairs
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
  
  // Secure object-storage keys for photos/videos of the damage
  mediaKeys:  [String], 

  // ─────────────────────────────────────────────────────────────
  // WORKFLOW & LIFECYCLE
  // ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      "submitted",     // Tenant opened the ticket
      "acknowledged",  // Landlord saw it
      "assigned",      // Contractor or handyman assigned
      "in_progress",   // Work is currently happening
      "resolved",      // Landlord/Contractor marks it as finished
      "closed",        // Officially closed out
      "rejected"       // Landlord disputes the request (e.g., tenant's fault)
    ],
    default: "submitted",
  },

  // When the repair person is scheduled to arrive
  scheduledDate: Date,
  
  // When the physical work was finished
  resolvedAt: Date,
  
  // When the ticket was officially archived
  closedAt: Date,
  
  resolutionNote: String,
  
  // Critical for accountability: ensures the landlord cannot unilaterally close 
  // a ticket if the tenant claims the issue is still broken.
  tenantConfirmedResolution: Boolean,

  // ─────────────────────────────────────────────────────────────
  // TICKET HISTORY (Event Sourcing)
  // ─────────────────────────────────────────────────────────────
  // Embedded update log tracking every status change and comment.
  // Note: If updates exceed 50 items, older records should be moved to a 
  // separate "MaintenanceArchives" collection to prevent hitting MongoDB document size limits.
  updates: [{
    status:    String,
    note:      String,
    updatedBy: { type: ObjectId, ref: "Account" },
    timestamp: { type: Date, default: Date.now },
  }],

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - propertyId: 1
// - tenantId: 1, status: 1 (For tenant dashboard to track active repairs)
// - landlordId: 1, priority: -1, status: 1 (For landlord to triage urgent tickets first)
// - assignedTo: 1, status: 1 (For service providers to see their assigned jobs)
// ============================================================