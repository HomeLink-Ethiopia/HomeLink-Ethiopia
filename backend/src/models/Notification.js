const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  type: {
    type: String,
    enum: [
      "application_received", "application_approved", "application_rejected",
      "viewing_confirmed", "viewing_reminder", "viewing_cancelled",
      "agreement_ready", "agreement_signed",
      "rent_due", "rent_overdue", "payment_received",
      "maintenance_update", "maintenance_resolved",
      "new_message",
      "fraud_report_update", "dispute_update",
      "verification_update", "system",
      "viewing_requested" // Adding this because it was missing in the original enum but used in our flow
    ],
    required: true,
  },
  
  title: String,
  body: String,

  relatedEntity: {
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
  },

  channels: [{ type: String, enum: ["in_app", "push", "sms", "email"] }],
  sentVia: [String], 

  isRead: { type: Boolean, default: false },
  readAt: Date,

}, { timestamps: true });

// Recommended Indexes
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
