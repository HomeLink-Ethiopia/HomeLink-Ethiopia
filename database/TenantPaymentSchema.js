// ============================================================
// 9A. TENANT PAYMENTS (Tenant ➡️ Landlord)
// Tracks rent, deposits, and maintenance fees between users.
// ============================================================
const TenantPaymentSchema = {
  _id: ObjectId,
  
  // Core Relationships
  agreementId: { type: ObjectId, ref: "RentalAgreement", required: true },
  tenantId:    { type: ObjectId, ref: "TenantProfile", required: true },
  landlordId:  { type: ObjectId, ref: "LandlordProfile", required: true },
  propertyId:  { type: ObjectId, ref: "Property", required: true },

  // Payment Details
  paymentType: {
    type: String,
    enum: ["rent", "deposit", "deposit_refund", "late_fee", "maintenance_charge"],
    required: true,
  },
  periodMonth: String,    // e.g., "2026-08" for fast monthly bucketing
  dueDate:     Date,
  
  // Accounting
  amountDue:   { type: Number, required: true },
  amountPaid:  { type: Number, default: 0 },
  balance:     Number,    // Computed: amountDue - amountPaid
  currency:    { type: String, default: "ETB" },

  // Lifecycle
  status: {
    type: String,
    enum: ["pending", "paid", "partial", "overdue", "waived", "disputed"],
    default: "pending",
  },

  // Proof of Transaction
  paidAt:               Date,
  paymentMethod:        { type: String, enum: ["bank_transfer", "mobile_money", "cash", "other"] },
  transactionReference: String,
  receiptKey:           String, // Secure object-storage key for receipt photo

  // Automation
  remindersSent: [{
    sentAt: Date,
    channel: { type: String, enum: ["push", "sms", "email"] },
  }],

  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// Indexes: agreementId, tenantId, landlordId, status, dueDate, periodMonth