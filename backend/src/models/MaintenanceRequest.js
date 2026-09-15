const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
  agreementId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalAgreement" },
  propertyId:  { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  landlordId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 

  title:       { type: String, required: true },
  description: String,
  
  category: {
    type: String,
    enum: ["plumbing", "electrical", "structural", "appliance", "cleaning", "pest", "security", "other"],
  },
  
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
  mediaKeys:  [String], 

  status: {
    type: String,
    enum: [
      "submitted",     
      "acknowledged",  
      "assigned",      
      "in_progress",   
      "resolved",      
      "closed",        
      "rejected"       
    ],
    default: "submitted",
  },

  scheduledDate: Date,
  resolvedAt: Date,
  closedAt: Date,
  resolutionNote: String,
  tenantConfirmedResolution: Boolean,

  updates: [{
    status:    String,
    note:      String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
  }]

}, { timestamps: true });

maintenanceRequestSchema.index({ propertyId: 1 });
maintenanceRequestSchema.index({ tenantId: 1, status: 1 });
maintenanceRequestSchema.index({ landlordId: 1, priority: -1, status: 1 });
maintenanceRequestSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
