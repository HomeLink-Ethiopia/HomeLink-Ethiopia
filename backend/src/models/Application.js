const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  landlordId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewingAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Viewing' },
  
  message: String,
  moveInDate: Date,
  durationMonths: Number,
  numberOfOccupants: Number,
  hasPets: Boolean,
  petDetails: String,
  
  monthlyIncome: Number,
  employmentStatus: String,

  // Ethiopian Tenant Screening & Behavioral Assessment
  religion: { type: String, default: 'Orthodox Christian' },
  maritalStatus: { type: String, default: 'single' },
  smokingHabit: { type: String, default: 'non_smoker' },
  alcoholHabit: { type: String, default: 'non_drinker' },
  quietHoursAgreed: { type: Boolean, default: true },
  previousLandlordName: String,
  previousLandlordPhone: String,
  previousRentalDuration: String,
  reasonForMoving: String,
  tenantBehaviorScore: { type: Number, default: 4.9 },
  tenantReviewBadges: [{ type: String }],

  supportingDocuments: [{
    documentType: String, // e.g., "kebele_id", "proof_of_income", "employment_letter"
    fileKey: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

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
    default: "submitted"
  },
  
  landlordFeedback: String,
  infoRequested: String,
  decidedAt: Date,
  expiresAt: Date,

  history: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String,
  }]
}, { timestamps: true });

// Indexes for dashboards
applicationSchema.index({ propertyId: 1 });
applicationSchema.index({ tenantId: 1, status: 1 });
applicationSchema.index({ landlordId: 1, status: 1 });
applicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
