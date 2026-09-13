// ============================================================
// 6. VIEWING APPOINTMENTS (FR-05)
// Manages the scheduling and outcomes of physical property visits[cite: 1].
// Uses explicit time strings to avoid UTC offset issues across devices.
// ============================================================
const ViewingAppointmentSchema = {
  // Unique MongoDB identifier
  _id: ObjectId,
  
  // The property being visited
  propertyId: { type: ObjectId, ref: "Property", required: true },
  
  // The renter requesting the visit
  tenantId: { type: ObjectId, ref: "TenantProfile", required: true },
  
  // The owner or manager hosting the visit
  landlordId: { type: ObjectId, ref: "LandlordProfile", required: true },

  // ─────────────────────────────────────────────────────────────
  // SCHEDULING LOGIC
  // ─────────────────────────────────────────────────────────────
  
  // The tenant can propose multiple times (e.g., up to 3 slots) to reduce back-and-forth messaging[cite: 1].
  requestedSlots: [{
    date: Date,           // e.g., 2026-08-20
    startTime: String,    // e.g., "14:00" (24-hour format)
    endTime: String,      // e.g., "15:00"
  }],
  
  // The single slot the landlord officially selects and confirms
  confirmedSlot: {
    date: Date,
    startTime: String,
    endTime: String,
  },

  // ─────────────────────────────────────────────────────────────
  // APPOINTMENT LIFECYCLE
  // ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ["pending", "confirmed", "rescheduled", "cancelled", "completed", "no_show"],
    default: "pending",
  },

  // Optional contextual messages sent during the booking process
  tenantNote: String,
  landlordNote: String,
  
  // Audit fields for cancellations
  cancellationReason: String,
  cancelledBy: { type: String, enum: ["tenant", "landlord", "admin"] },

  // ─────────────────────────────────────────────────────────────
  // POST-VISIT FEEDBACK
  // ─────────────────────────────────────────────────────────────
  outcome: {
    // True if the tenant wants to proceed with a rental application
    tenantInterested: Boolean,
    
    // Qualitative feedback (e.g., "Too small", "Loved the natural light")
    tenantFeedback: String,
  },

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - propertyId: 1
// - tenantId: 1, status: 1 (Allows tenant dashboard to show upcoming visits)
// - landlordId: 1, status: 1 (Allows landlord dashboard to manage schedule)
// - "confirmedSlot.date": 1 (For chronological sorting)
// ============================================================