// ============================================================
// 12. RATINGS & REVIEWS (FR-10)
// Manages the platform's reputation system.
// Enforces "Verified Stays" by requiring an active or past RentalAgreement.
// ============================================================
const ReviewSchema = {
  // Unique MongoDB identifier
  _id: ObjectId,
  
  // ─────────────────────────────────────────────────────────────
  // CORE RELATIONSHIPS & VERIFICATION
  // ─────────────────────────────────────────────────────────────
  // The user writing the review
  reviewerId: { type: ObjectId, ref: "Account", required: true },
  
  // The user receiving the review (Can be null if the review is purely for the property)
  revieweeId: { type: ObjectId, ref: "Account" }, 
  
  // The physical property being reviewed
  propertyId: { type: ObjectId, ref: "Property" },
  
  // CRITICAL: Links the review to a verified transaction. 
  // Prevents fake reviews from users who never actually rented the unit.
  agreementId: { type: ObjectId, ref: "RentalAgreement", required: true }, 

  reviewType: {
    type: String,
    enum: ["tenant_to_landlord", "landlord_to_tenant", "tenant_to_property"],
    required: true,
  },

  // ─────────────────────────────────────────────────────────────
  // GRANULAR RATING SYSTEM
  // ─────────────────────────────────────────────────────────────
  ratings: {
    overall:       { type: Number, min: 1, max: 5, required: true },
    
    // Specific metrics to give users detailed insights
    communication: { type: Number, min: 1, max: 5 }, // For landlords/tenants
    accuracy:      { type: Number, min: 1, max: 5 }, // Did the listing match reality?
    maintenance:   { type: Number, min: 1, max: 5 }, // How fast were repairs handled?
    reliability:   { type: Number, min: 1, max: 5 }, // For tenant reviews (e.g., paid on time)
  },
  
  // Written feedback
  comment: String,

  // ─────────────────────────────────────────────────────────────
  // REBUTTAL & DISPUTE
  // ─────────────────────────────────────────────────────────────
  // Allows the reviewee (e.g., the landlord) to publicly reply to the comment.
  response: {
    body: String,
    respondedAt: Date,
  },

  // ─────────────────────────────────────────────────────────────
  // MODERATION & TRUST (FR-10)
  // ─────────────────────────────────────────────────────────────
  status: { 
    type: String, 
    enum: [
      "pending",   // Held for auto-filtering (e.g., profanity checks)
      "published", // Live and visible
      "flagged",   // Reported by a user for violating guidelines
      "removed"    // Taken down by an admin
    ], 
    default: "pending" 
  },
  
  // Internal notes for the admin dashboard
  moderationNote: String,
  moderatedBy:    { type: ObjectId, ref: "Account" },
  moderatedAt:    Date,

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - propertyId: 1, status: 1 (Fast loading for property detail pages)
// - revieweeId: 1, status: 1 (Fast loading for user profile pages)
// - agreementId: 1 (Crucial to ensure only one review is created per agreement)
// - status: 1 (For the admin moderation dashboard)
// ============================================================