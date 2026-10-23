const mongoose = require('mongoose');

const rentalAgreementSchema = new mongoose.Schema({
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  landlordId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  rentAmount: { type: Number, required: true },
  depositAmount: Number,
  currency: { type: String, default: "ETB" },
  
  paymentDueDay: { type: Number, min: 1, max: 31 },
  paymentFrequency: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
  
  noticePeriodDays: Number, 
  utilitiesIncluded: [String],
  specialConditions: String,
  terms: { type: [String], default: [] },

  agreementDocumentKey: String, 
  templateVersion: String,

  status: {
    type: String,
    enum: [
      "draft", 
      "pending_signatures",
      "pending_landlord",
      "pending_tenant", 
      "active", 
      "expired", 
      "terminated", 
      "disputed"
    ],
    default: "pending_signatures",
  },
  
  tenantSignedAt: Date,
  landlordSignedAt: Date,
  
  terminationDate: Date,
  terminationReason: String,
  terminatedBy: { type: String, enum: ["tenant", "landlord", "admin"] },

  renewals: [{
    newEndDate: Date,
    newRentAmount: Number,
    agreedAt: Date,
  }],

  // ─── Smart Lease Renewal ───
  // Either party proposes; the other accepts/rejects. Accepting applies the
  // new terms and both parties' signatures in one click.
  renewalProposal: {
    proposedBy: { type: String, enum: ["tenant", "landlord"] },
    newEndDate: Date,
    newRentAmount: Number,
    message: String,
    suggestedByAI: { type: Boolean, default: false },
    // NOTE: no default — Mongoose would otherwise materialize empty subdocs
    // with status "proposed", creating ghost proposals.
    status: { type: String, enum: ["proposed", "accepted", "rejected"] },
    proposedAt: Date,
    respondedAt: Date,
  },

  // Auto-reminders sent at 60/30/15 days before expiry (one per milestone)
  renewalReminders: [{ milestone: Number, sentAt: Date }],

}, { timestamps: true });

// Keep the renewal subdoc clean: drop it entirely if it has no real content
// (Mongoose 9 hooks are promise-based — no `next` callback)
rentalAgreementSchema.pre('validate', async function () {
  if (this.renewalProposal && !this.renewalProposal.proposedAt) {
    this.renewalProposal = undefined;
  }
});

rentalAgreementSchema.index({ propertyId: 1 });
rentalAgreementSchema.index({ tenantId: 1, status: 1 });
rentalAgreementSchema.index({ landlordId: 1, status: 1 });
rentalAgreementSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('RentalAgreement', rentalAgreementSchema);
