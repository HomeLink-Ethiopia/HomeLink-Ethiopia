// ============================================================
// 18. RENT ESTIMATES (FR-04, FR-13 — AI Layer)
// Stores AI-generated pricing suggestions. 
// Can be linked to an existing property or used as a standalone 
// calculator for prospective landlords.
// ============================================================
const RentEstimateSchema = {
  // Unique database identifier
  _id: ObjectId,
  
  // Optional: Null if this was just a user playing with a public calculator widget
  propertyId: { type: ObjectId, ref: "Property" },
  
  // The user who requested the estimate (can be null for anonymous public users)
  requestedBy: { type: ObjectId, ref: "Account" },

  // ─────────────────────────────────────────────────────────────
  // ML MODEL INPUTS (Feature Snapshot)
  // ─────────────────────────────────────────────────────────────
  // We save the exact inputs used at the time of the calculation. 
  // If the property changes later, we know exactly what this estimate was based on.
  inputFeatures: {
    city: String,
    subCity: String,
    propertyType: String,
    bedrooms: Number,
    bathrooms: Number,
    sizeM2: Number,
    furnished: Boolean,
    amenities: [String],
    condition: String,
  },

  // ─────────────────────────────────────────────────────────────
  // ML MODEL OUTPUTS & METADATA
  // ─────────────────────────────────────────────────────────────
  estimatedRentMin: Number,
  estimatedRentMax: Number,
  estimatedRentMid: Number,
  currency: { type: String, default: "ETB" },
  
  // 0.0 to 1.0 indicating how confident the AI is (low confidence if data in that subCity is sparse)
  confidenceScore: Number,
  
  // Tracks which version of your pricing algorithm generated this (e.g., "v2.1.0")
  modelVersion: String,
  
  // E.g., "Estimates are data-driven suggestions and not guaranteed market values."
  disclaimer: String, 

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE & AUTO-EXPIRY
  // ─────────────────────────────────────────────────────────────
  createdAt: { type: Date, default: Date.now },
  
  // CRITICAL: Market prices change. This timestamp defines when the estimate goes stale.
  expiresAt: Date, 
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - propertyId: 1, createdAt: -1 (To quickly load the latest estimate for a listing)
// - requestedBy: 1 (To show a user their recent searches)
// 
// PRO-TIP: Create a TTL (Time-To-Live) index on 'expiresAt'.
// MongoDB will automatically delete the document when the clock passes this date!
// ============================================================