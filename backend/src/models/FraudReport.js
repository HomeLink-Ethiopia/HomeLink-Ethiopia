const mongoose = require('mongoose');

const fraudReportSchema = new mongoose.Schema({
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reportedPropertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 

  category: {
    type: String,
    enum: [
      "fake_listing",       
      "duplicate_listing",  
      "image_theft",        
      "scam",               
      "impersonation",
      "suspicious_payment",      
      "other"
    ],
    required: true,
  },
  
  description: String,
  evidenceKeys: [String], 

  // Output of the AI / Risk Engine
  aiRiskScore: { type: Number, min: 0, max: 1 },
  aiRiskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"] },
  aiSignals: [String], 

  status: {
    type: String,
    enum: [
      "open",                   
      "under_review",           
      "resolved_action_taken",  
      "resolved_no_action",     
      "dismissed"               
    ],
    default: "open",
  },

  adminNotes: String,
  resolvedAt: Date,

  history: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
    note: String,
  }],

}, { timestamps: true });

fraudReportSchema.index({ reportedPropertyId: 1 });
fraudReportSchema.index({ reportedUserId: 1 });
fraudReportSchema.index({ status: 1, aiRiskScore: -1 }); // Useful for admin dashboard sorting by risk

module.exports = mongoose.model('FraudReport', fraudReportSchema);
