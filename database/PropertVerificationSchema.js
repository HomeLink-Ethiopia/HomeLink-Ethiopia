// ============================================================
// 5. PROPERTY VERIFICATION (FR-02)
// Handles the strict, manual triangulation process to prevent fraud.
// Keeps sensitive legal/identity documents separate from the public Property schema[cite: 1].
// ============================================================
const PropertyVerificationSchema = {
  // Unique MongoDB identifier
  _id: ObjectId,
  
  // The listing being verified
  propertyId: { type: ObjectId, ref: "Property", required: true },
  
  // The owner submitting the verification
  landlordProfileId: { type: ObjectId, ref: "LandlordProfile", required: true },
  
  // Audit field: The platform administrator handling the case
  reviewedBy: { type: ObjectId, ref: "Account" }, 

  // ─────────────────────────────────────────────────────────────
  // WORKFLOW STATE
  // ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ["submitted", "under_review", "verified", "rejected", "more_info_needed", "suspended"],
    default: "submitted",
  },

  // ─────────────────────────────────────────────────────────────
  // EVIDENCE (Ethiopian Document Triangulation)
  // ─────────────────────────────────────────────────────────────
  submittedDocuments: [{
    docType: {
      type: String,
      enum: [
        "title_deed",           // ካርታ — Primary proof of ownership
        "kebele_id",            // መታወቂያ — Landlord identity document
        "utility_bill",         // መብራት/ውሃ ደረሰኝ — Location & name matching
        "tax_receipt",          // የግብር ደረሰኝ — TIN & property matching
        "power_of_attorney",    // ውክልና — Required if ID name ≠ Title Deed name
        "agency_authorization", // ለድርጅቶች — Property management authorization
        "property_photos",      // የቤቱ ፎቶ — Physical proof
      ],
      required: true,
    },
    // The secure object-storage key (not a public URL) to protect PII
    fileKey: String,                                      
    uploadedAt: { type: Date, default: Date.now },
  }],

  // ─────────────────────────────────────────────────────────────
  // ADMIN REVIEW & AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────
  
  // Internal notes only visible to other admins
  reviewNotes: String,
  
  // Public reason sent back to the landlord if rejected or if more info is needed
  rejectionReason: String,
  
  // Timestamp of final approval
  verifiedAt: Date,

  // Immutable ledger of every action taken on this verification request.
  // Crucial for accountability and resolving disputes.
  auditTrail: [{
    action: String, // e.g., "STATUS_CHANGED_TO_UNDER_REVIEW", "DOCUMENT_ADDED"
    performedBy: { type: ObjectId, ref: "Account" },
    notes: String,
    timestamp: { type: Date, default: Date.now },
  }],

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - propertyId: 1
// - landlordProfileId: 1
// - status: 1 (Allows the admin dashboard to quickly filter "submitted" or "under_review" cases)
// ============================================================