// ============================================================
// 15. NOTIFICATIONS (FR-01 through FR-13)
// Centralized notification system supporting omni-channel delivery
// (In-App, Push, SMS, Email) and polymorphic deep-linking.
// ============================================================
const NotificationSchema = {
  // Unique database identifier
  _id: ObjectId,
  
  // The user receiving the notification
  userId: { type: ObjectId, ref: "Account", required: true },

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATION CONTENT & ROUTING
  // ─────────────────────────────────────────────────────────────
  
  // Explicit categories allow users to mute specific types of alerts 
  // (e.g., muting "new_message" but keeping "rent_due")
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
    ],
    required: true,
  },
  
  title: String,
  body:  String,

  // Polymorphic reference for frontend deep-linking.
  // E.g., { entityType: "Payment", entityId: "12345" } tells the mobile app 
  // to open the Payment Details screen for invoice 12345.
  relatedEntity: {
    entityType: String,
    entityId:   ObjectId,
  },

  // ─────────────────────────────────────────────────────────────
  // OMNI-CHANNEL DELIVERY TRACKING
  // ─────────────────────────────────────────────────────────────
  
  // The channels this notification was *instructed* to use based on user preferences
  channels: [{ type: String, enum: ["in_app", "push", "sms", "email"] }],
  
  // The channels that *actually* succeeded (useful for debugging failed SMS/Email gateways)
  sentVia:  [String], 

  // ─────────────────────────────────────────────────────────────
  // INBOX STATE
  // ─────────────────────────────────────────────────────────────
  isRead: { type: Boolean, default: false },
  readAt: Date,

  // Automatically deletes extremely old notifications if you use a TTL index later
  createdAt: { type: Date, default: Date.now },
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - userId: 1, isRead: 1 (Fast count for the "unread notifications" red badge icon)
// - userId: 1, createdAt: -1 (To load the user's notification inbox in chronological order)
// - type: 1 (Useful for analytics on what types of alerts are firing most often)
// ============================================================