const mongoose = require('mongoose');

const viewingSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  landlordId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  requestedSlots: [{
    date: Date,
    startTime: String,
    endTime: String,
  }],
  
  confirmedSlot: {
    date: Date,
    startTime: String,
    endTime: String,
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "rescheduled", "cancelled", "completed", "no_show"],
    default: "pending"
  },

  tenantNote: String,
  landlordNote: String,
  
  cancellationReason: String,
  cancelledBy: { type: String, enum: ["tenant", "landlord", "admin"] },

  outcome: {
    tenantInterested: Boolean,
    tenantFeedback: String,
  }
}, { timestamps: true });

// Indexes for faster lookups
viewingSchema.index({ propertyId: 1 });
viewingSchema.index({ tenantId: 1, status: 1 });
viewingSchema.index({ landlordId: 1, status: 1 });
viewingSchema.index({ "confirmedSlot.date": 1 });

module.exports = mongoose.model('Viewing', viewingSchema);
