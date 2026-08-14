// ============================================================
// 4. PROPERTY LISTING (FR-03, FR-04, FR-11)
// Core collection for all housing units. Includes embedded AI 
// caching, geospatial querying, and strict fraud prevention data[cite: 1].
// ============================================================
const PropertySchema = {
  // Unique MongoDB identifier
  _id: ObjectId,

  // Links to the verified landlord profile who owns the listing
  landlordId: { type: ObjectId, ref: "LandlordProfile", required: true },

  // Optional link if a registered property management company runs the day-to-day
  managedBy: { type: ObjectId, ref: "Account" },

  // ─────────────────────────────────────────────────────────────
  // LISTING DETAILS
  // ─────────────────────────────────────────────────────────────
  title: { type: String, required: true },
  description: String,
  propertyType: {
    type: String,
    enum: ["apartment", "house", "room", "studio", "villa", "compound", "commercial"],
    required: true,
  },

  // ─────────────────────────────────────────────────────────────
  // LOCATION & GEOSPATIAL SEARCH
  // Formatted specifically as a GeoJSON Point to enable $near and $geoWithin queries.
  // ─────────────────────────────────────────────────────────────
  location: {
    address: String,
    subCity: String,
    woreda: String,
    city: { type: String, default: "Addis Ababa" },
    coordinates: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: [Number],  // Always ordered as: [longitude, latitude]
    },
  },

  // ─────────────────────────────────────────────────────────────
  // PHYSICAL ATTRIBUTES
  // ─────────────────────────────────────────────────────────────
  bedrooms: Number,
  bathrooms: Number,
  sizeM2: Number,         // Square meterage
  floor: Number,          // Which floor the unit is on (for apartments)
  totalFloors: Number,    // Total floors in the building
  furnished: { type: Boolean, default: false },
  amenities: [String],    // Array of features (e.g., ["generator", "water_tank", "wifi"])
  condition: { type: String, enum: ["new", "good", "needs_repair"], default: "good" },

  // ─────────────────────────────────────────────────────────────
  // PRICING & TERMS
  // ─────────────────────────────────────────────────────────────
  rentAmount: { type: Number, required: true },
  depositAmount: Number,
  currency: { type: String, default: "ETB" },
  rentFrequency: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
  availableFrom: Date,
  minLeaseDuration: Number, // Stored in months

  // ─────────────────────────────────────────────────────────────
  // MEDIA & FRAUD DETECTION (FR-11)
  // ─────────────────────────────────────────────────────────────
  images: [{
    key: String,          // The object-storage key (e.g., S3 or Cloudinary ID)
    url: String,          // The publicly accessible CDN URL
    isPrimary: Boolean,   // Marks the main cover photo for the listing
    uploadedAt: Date,
  }],
  
  // Stores perceptual hashes of the images. Checked during upload to block 
  // duplicate/stolen images from being used in fake listings[cite: 1].
  imageHashes: [String],  
  
  documents: [String],    // Internal URLs for verified ownership documents

  // ─────────────────────────────────────────────────────────────
  // SYSTEM STATUS
  // ─────────────────────────────────────────────────────────────
  
  // Visibility control for the landlord (e.g., taking it off the market temporarily)
  listingStatus: {
    type: String,
    enum: ["draft", "active", "rented", "inactive", "suspended"],
    default: "draft",
  },
  
  // Trust control for the platform admins
  verificationStatus: {
    type: String,
    enum: ["unverified", "pending", "verified", "rejected", "suspended"],
    default: "unverified",
  },

  // ─────────────────────────────────────────────────────────────
  // AI & MACHINE LEARNING FIELDS (FR-04, FR-11)
  // ─────────────────────────────────────────────────────────────
  
  // Automatically computed score (0.0 to 1.0) flagging suspicious properties for admin review[cite: 1].
  fraudRiskScore: { type: Number, min: 0, max: 1 },
  
  // Precomputed mathematical vector representing the property features. 
  // Enables lightning-fast cosine similarity calculations for tenant recommendations[cite: 1].
  recommendationFeatureVector: [Number],
  
  // Denormalized fair-rent cache so the frontend can display ML estimates instantly without joining collections.
  rentEstimateCache: {
    minETB: Number,
    maxETB: Number,
    computedAt: Date,
  },

  // ─────────────────────────────────────────────────────────────
  // METRICS & TIMESTAMPS
  // ─────────────────────────────────────────────────────────────
  viewCount: { type: Number, default: 0 },
  favouriteCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  
  // Soft delete flag. If a date is present, the property is hidden from all tenant-facing APIs.
  deletedAt: Date,
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - landlordId: 1
// - location.coordinates: "2dsphere" (Required for map queries)
// - listingStatus: 1, verificationStatus: 1 (Heavy filtering happens here)
// - propertyType: 1, rentAmount: 1, bedrooms: 1 (Common tenant search filters)
// - fraudRiskScore: -1 (Allows admins to quickly pull the most suspicious listings)
// ============================================================