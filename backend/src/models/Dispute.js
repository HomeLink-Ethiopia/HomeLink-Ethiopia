const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  againstUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  agreementId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalAgreement" },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 

  category: {
    type: String,
    enum: [
      "unpaid_rent", 
      "deposit_dispute", 
      "property_damage", 
      "maintenance_neglect", 
      "eviction", 
      "other"
    ],
    required: true,
  },
  
  description: { type: String, required: true },
  evidenceKeys: [String],

  status: {
    type: String,
    enum: [
      "open",           
      "under_review",   
      "mediation",      
      "resolved",       
      "closed",         
      "escalated"       
    ],
    default: "open",
  },

  communications: [{
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: String,
    attachments: [String],
    isAdminNote: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  }],

  outcome: String,
  resolvedAt: Date,

  history: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
    note: String,
  }],

}, { timestamps: true });

disputeSchema.index({ raisedBy: 1 });
disputeSchema.index({ againstUserId: 1 });
disputeSchema.index({ agreementId: 1 });
disputeSchema.index({ status: 1 });

module.exports = mongoose.model('Dispute', disputeSchema);
