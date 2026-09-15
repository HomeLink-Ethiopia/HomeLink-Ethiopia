// ============================================================
// 8. RENTAL AGREEMENTS (FR-07)
// The legally binding digital contract between Landlord and Tenant.
// Acts as the source of truth for all rent payments and dispute resolutions.
// ============================================================
const RentalAgreementSchema = {
  // Unique MongoDB identifier
  _id: ObjectId,
  
  // Optional link back to the original application that spawned this agreement
  applicationId: { type: ObjectId, ref: "Application" },
  
  // ─────────────────────────────────────────────────────────────
  // CORE RELATIONSHIPS
  // ─────────────────────────────────────────────────────────────
  propertyId: { type: ObjectId, ref: "Property", required: true },
  tenantId: { type: ObjectId, ref: "TenantProfile", required: true },
  landlordId: { type: ObjectId, ref: "LandlordProfile", required: true },

  // ─────────────────────────────────────────────────────────────
  // FINANCIAL & LEASE TERMS
  // ─────────────────────────────────────────────────────────────
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Locked-in rent price for the duration of this specific agreement period
  rentAmount: { type: Number, required: true },
  depositAmount: Number,
  currency: { type: String, default: "ETB" },
  
  // Integer (1-31) indicating the day of the month rent is due.
  // Useful for the backend to run automated cron jobs for payment reminders.
  paymentDueDay: { type: Number, min: 1, max: 31 },
  
  paymentFrequency: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
  
  // Legally required notice period (in days) before either party can terminate the lease
  noticePeriodDays: Number, 
  
  // E.g., ["water", "electricity", "internet"]
  utilitiesIncluded: [String],
  
  // Custom clauses added by the landlord (e.g., "No loud music after 10 PM")
  specialConditions: String,

  // ─────────────────────────────────────────────────────────────
  // DIGITAL DOCUMENTATION
  // ─────────────────────────────────────────────────────────────
  
  // Secure object-storage key pointing to the generated PDF of the signed contract
  agreementDocumentKey: String, 
  
  // Tracks which version of the HomeLink legal template was used to generate the PDF
  templateVersion: String,

  // ─────────────────────────────────────────────────────────────
  // SIGNING & LIFECYCLE WORKFLOW
  // ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      "draft",                // Still negotiating terms
      "pending_signatures",   // Terms locked, waiting for tenant/landlord to digitally sign
      "active",               // Signed and currently in effect
      "expired",              // End date passed without renewal
      "terminated",           // Cut short before the end date
      "disputed"              // Suspended due to a legal or platform dispute
    ],
    default: "draft",
  },
  
  // Audit timestamps for digital signatures (binding agreement)
  tenantSignedAt: Date,
  landlordSignedAt: Date,
  
  // ─────────────────────────────────────────────────────────────
  // TERMINATION & RENEWALS
  // ─────────────────────────────────────────────────────────────
  
  // Populated only if the lease is cut short
  terminationDate: Date,
  terminationReason: String,
  terminatedBy: { type: String, enum: ["tenant", "landlord", "admin"] },

  // Handles lease extensions without needing to create a brand new document.
  // Keeps the history of the tenancy clean and easy to query.
  renewals: [{
    newEndDate: Date,
    newRentAmount: Number,
    agreedAt: Date,
  }],

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - propertyId: 1
// - tenantId: 1, status: 1 (Allows tenant to quickly find their active lease)
// - landlordId: 1, status: 1 (Allows landlord to manage active leases)
// - status: 1, endDate: 1 (For backend cron jobs checking for soon-to-expire leases)
// ============================================================