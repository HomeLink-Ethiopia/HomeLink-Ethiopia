const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  
  // Enforce verified stays
  agreementId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalAgreement", required: true }, 

  reviewType: {
    type: String,
    enum: ["tenant_to_landlord", "landlord_to_tenant", "tenant_to_property"],
    required: true,
  },

  ratings: {
    overall:       { type: Number, min: 1, max: 5, required: true },
    communication: { type: Number, min: 1, max: 5 },
    accuracy:      { type: Number, min: 1, max: 5 },
    maintenance:   { type: Number, min: 1, max: 5 },
    reliability:   { type: Number, min: 1, max: 5 },
  },
  
  comment: String,

  response: {
    body: String,
    respondedAt: Date,
  },

  status: { 
    type: String, 
    enum: ["pending", "published", "flagged", "removed"], 
    default: "published" // Can default to published, or pending if admin approval needed
  },
  
  moderationNote: String,
  moderatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  moderatedAt:    Date,

}, { timestamps: true });

// Prevent duplicate reviews for the same agreement and type
reviewSchema.index({ agreementId: 1, reviewType: 1, reviewerId: 1 }, { unique: true });

reviewSchema.index({ propertyId: 1, status: 1 });
reviewSchema.index({ revieweeId: 1, status: 1 });

module.exports = mongoose.model('Review', reviewSchema);
