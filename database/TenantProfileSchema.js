// ============================================================
// 2. TENANT PROFILE (FR-01, FR-04)
// This schema holds data specific to renters (tenants). 
// It is kept separate from the AccountSchema to keep auth logic clean.
// ============================================================
const TenantProfileSchema = {
  // Unique MongoDB identifier for this profile document
  _id: ObjectId,

  // Links directly to the core Auth Account. 
  // 'unique: true' ensures one account can only have one tenant profile (One-to-One).
  accountId: { type: ObjectId, ref: "Account", required: true, unique: true },

  // The tenant's legal name, used for generating digital rental agreements
  fullName: { type: String, required: true },

  // URL or storage key (e.g., AWS S3, Cloudinary) for the user's avatar image
  profilePhoto: String,

  // ─────────────────────────────────────────────────────────────
  // IDENTITY VERIFICATION (KYC)
  // ─────────────────────────────────────────────────────────────
  identityVerification: {
    // Tracks where the tenant is in the approval pipeline
    status: { 
      type: String, 
      enum: ["unverified", "pending", "verified", "rejected"], 
      default: "unverified" 
    },
    
    // The specific type of government ID submitted (e.g., Fayda ID, Kebele ID)
    documentType: { type: String, enum: ["national_id", "passport", "kebele_id"] },
    
    // Secure URL/key pointing to the uploaded image of their ID
    documentKey: String,
    
    // Audit trail: Which admin reviewed and approved/rejected this ID
    reviewedBy: { type: ObjectId, ref: "Account" },
    
    // Audit trail: When the admin made the decision
    reviewedAt: Date,
    
    // Internal notes from the admin (e.g., "Image too blurry, requested re-upload")
    notes: String,
  },

  // ─────────────────────────────────────────────────────────────
  // EMPLOYMENT & FINANCIAL
  // ─────────────────────────────────────────────────────────────
  
  // Helps landlords gauge tenant reliability during the application process
  employmentStatus: { type: String, enum: ["employed", "self_employed", "student", "other"] },
  
  // Stated monthly income in ETB (can be used to calculate rent-to-income ratios)
  monthlyIncome: Number,

  // ─────────────────────────────────────────────────────────────
  // BASELINE SEARCH PREFERENCES (AI Recommendations - FR-04)
  // ─────────────────────────────────────────────────────────────
  // These act as the default fallback for the AI to populate the user's "Home" feed.
  // Live frontend searches can override these temporarily without updating the database.
  preferences: {
    budgetMin: Number,                 // Minimum expected rent in ETB
    budgetMax: Number,                 // Maximum expected rent in ETB
    preferredLocations: [String],      // Array of preferred sub-cities or woredas
    propertyTypes: [String],           // E.g., ["apartment", "studio"]
    minBedrooms: Number,               // Minimum sleeping rooms required
    amenities: [String],               // Must-have features, e.g., ["wifi", "parking"]
  },

  // Standard timestamps for tracking when the profile was created or modified
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// Indexes: 
// - accountId (unique): Ensures fast lookups when fetching a profile after login.