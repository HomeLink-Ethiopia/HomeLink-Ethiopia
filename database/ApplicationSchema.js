// ============================================================
// 7. RENTAL APPLICATIONS (FR-06)
// Manages the formal request from a tenant to rent a property[cite: 1].
// Tracks the application lifecycle, supporting documents, and decision history.
// ============================================================
const ApplicationSchema = {
  // Unique MongoDB identifier
  _id: ObjectId,
  
  // The property being applied for
  propertyId: { type: ObjectId, ref: "Property", required: true },
  
  // The tenant submitting the application
  tenantId: { type: ObjectId, ref: "TenantProfile", required: true },
  
  // The landlord receiving the application
  landlordId: { type: ObjectId, ref: "LandlordProfile", required: true },
  
  // Optional: Ties this application to a previous physical viewing 
  viewingAppointmentId: { type: ObjectId, ref: "ViewingAppointment" },

  // ─────────────────────────────────────────────────────────────
  // APPLICATION DETAILS
  // ─────────────────────────────────────────────────────────────
  
  // A personal note or cover letter from the tenant to the landlord
  message: String,
  
  // The requested start date for the tenancy
  moveInDate: Date,
  
  // Requested lease duration in months
  durationMonths: Number,
  
  // Total number of people who will live in the property
  numberOfOccupants: Number,
  hasPets: Boolean,

  // ─────────────────────────────────────────────────────────────
  // FINANCIAL SNAPSHOT
  // Captured at the time of application. Do NOT link to the TenantProfile 
  // for these fields to ensure historical accuracy if the profile changes later.
  // ─────────────────────────────────────────────────────────────
  monthlyIncome: Number,
  employmentStatus: String,

  // ─────────────────────────────────────────────────────────────
  // SUPPORTING DOCUMENTS
  // ─────────────────────────────────────────────────────────────
  supportingDocuments: [{
    type: String, // e.g., "employment_letter", "bank_statement", "reference"
    
    // Secure object-storage key (not a public URL) to protect tenant privacy
    fileKey: String,
    uploadedAt: Date,
  }],

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE & WORKFLOW
  // ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      "submitted", 
      "under_review", 
      "info_requested", 
      "approved", 
      "rejected", 
      "withdrawn", 
      "expired"
    ],
    default: "submitted",
  },

  // Feedback provided by the landlord (visible to tenant)
  landlordFeedback: String,
  
  // Specific requests for additional documents (e.g., "Please upload a guarantor letter")
  infoRequested: String,
  
  // Timestamp of final approval or rejection
  decidedAt: Date,
  
  // Optional expiration date to auto-cleanup stale applications
  expiresAt: Date,

  // ─────────────────────────────────────────────────────────────
  // AUDIT HISTORY
  // ─────────────────────────────────────────────────────────────
  
  // Immutable ledger of every status change. Useful for dispute resolution.
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
// - propertyId: 1
// - tenantId: 1, status: 1 (For tenant dashboard to track their active applications)
// - landlordId: 1, status: 1 (For landlord dashboard inbox)
// - createdAt: -1 (Sorting by newest applications first)
// ============================================================