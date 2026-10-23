const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  landlordId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewingAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Viewing' },
  
  fullName: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  emergencyContact: { type: String, trim: true },

  message: String,
  moveInDate: Date,
  durationMonths: Number,
  numberOfOccupants: Number,
  hasPets: Boolean,
  
  monthlyIncome: Number,
  employmentStatus: String,

  supportingDocuments: [{
    documentType: String, // e.g., "employment_letter", "bank_statement", "reference"
    fileKey: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  documents: [mongoose.Schema.Types.Mixed],

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
