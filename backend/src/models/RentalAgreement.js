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

  agreementDocumentKey: String, 
  templateVersion: String,

  status: {
    type: String,
    enum: [
      "draft", 
      "pending_signatures", 
      "active", 
      "expired", 
      "terminated", 
      "disputed"
    ],
    default: "draft",
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
  }]

}, { timestamps: true });

rentalAgreementSchema.index({ propertyId: 1 });
rentalAgreementSchema.index({ tenantId: 1, status: 1 });
rentalAgreementSchema.index({ landlordId: 1, status: 1 });
rentalAgreementSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('RentalAgreement', rentalAgreementSchema);
