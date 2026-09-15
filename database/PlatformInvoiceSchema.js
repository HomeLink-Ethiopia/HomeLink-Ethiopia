// ============================================================
// 9B. PLATFORM INVOICES (Landlord ➡️ HomeLink Admin)
// Tracks the platform's revenue (commissions, verification fees, boosts).
// ============================================================
const PlatformInvoiceSchema = {
  _id: ObjectId,
  
  // Core Relationships
  // The landlord paying the bill to HomeLink
  landlordId: { type: ObjectId, ref: "LandlordProfile", required: true },
  
  // Optional: If the fee is tied to a specific property (like a verification fee)
  propertyId: { type: ObjectId, ref: "Property" },
  
  // Optional: If the fee is a commission taken from a specific lease signing
  agreementId: { type: ObjectId, ref: "RentalAgreement" },

  // Revenue Details
  feeType: {
    type: String,
    enum: [
      "verification_fee",      // One-time fee to review Title Deed & ID
      "platform_commission",   // Percentage cut when a lease is signed
      "featured_listing_fee",  // Paid boost to appear at the top of search
      "subscription_fee"       // Monthly fee for property management companies
    ],
    required: true,
  },
  
  // Accounting
  amountDue:  { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balance:    Number, // Computed: amountDue - amountPaid
  currency:   { type: String, default: "ETB" },

  // Lifecycle
  status: {
    type: String,
    enum: ["pending", "paid", "overdue", "waived", "failed"],
    default: "pending",
  },

  // Proof of Transaction (Integration with Chapa, Telebirr, or CBE)
  paidAt:               Date,
  paymentMethod:        { type: String, enum: ["telebirr", "cbe_birr", "chapa", "bank_transfer"] },
  transactionReference: String, // The payment gateway reference ID

  // E.g., "Verification fee for property at Bole"
  description: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// Indexes: landlordId, status, feeType, createdAt