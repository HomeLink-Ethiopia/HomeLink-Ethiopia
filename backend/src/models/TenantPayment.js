const mongoose = require('mongoose');

const tenantPaymentSchema = new mongoose.Schema({
  agreementId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalAgreement", required: true },
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  landlordId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  propertyId:  { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },

  paymentType: {
    type: String,
    enum: ["rent", "deposit", "deposit_refund", "late_fee", "maintenance_charge"],
    required: true,
  },
  periodMonth: String,    // e.g., "2026-08" for fast monthly bucketing
  dueDate:     Date,
  
  amountDue:   { type: Number, required: true },
  amountPaid:  { type: Number, default: 0 },
  balance:     Number,
  currency:    { type: String, default: "ETB" },

  status: {
    type: String,
    enum: ["pending", "paid", "partial", "overdue", "waived", "disputed"],
    default: "pending",
  },

  paidAt:               Date,
  paymentMethod:        { type: String, enum: ["cbe", "chapa", "telebirr", "bank_transfer", "mobile_money", "cash", "other"] },
  transactionReference: String,
  receiptKey:           String, 

  remindersSent: [{
    sentAt: Date,
    channel: { type: String, enum: ["push", "sms", "email"] },
  }],

  notes: String,
}, { timestamps: true });

tenantPaymentSchema.index({ agreementId: 1 });
tenantPaymentSchema.index({ tenantId: 1, status: 1 });
tenantPaymentSchema.index({ landlordId: 1, status: 1 });
tenantPaymentSchema.index({ periodMonth: 1 });

module.exports = mongoose.model('TenantPayment', tenantPaymentSchema);
