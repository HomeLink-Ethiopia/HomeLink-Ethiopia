// ============================================================
// 19. HOUSING ANALYTICS SNAPSHOTS (FR-13)
// Pre-aggregated statistical data for platform dashboards.
// Strictly privacy-preserving (No PII). Used to generate fast 
// market insights without running heavy queries on the live Property collection.
// ============================================================
const HousingAnalyticsSchema = {
  // Unique database identifier for this statistical snapshot
  _id: ObjectId,
  
  // ─────────────────────────────────────────────────────────────
  // TIME BUCKETING & DIMENSIONS
  // ─────────────────────────────────────────────────────────────
  
  // String-based time bucket for incredibly fast querying (e.g., "2026-08")
  period: String, 
  
  granularity: { type: String, enum: ["monthly", "weekly"] },
  
  // Geographic and categorical dimensions (Allows filtering the dashboard)
  city: String,
  subCity: String,         // e.g., "Bole", "Yeka"
  propertyType: String,    // e.g., "apartment", "villa"

  // ─────────────────────────────────────────────────────────────
  // AGGREGATED METRICS
  // ─────────────────────────────────────────────────────────────
  metrics: {
    // Inventory metrics
    activeListings: Number,
    newListingsCount: Number,
    
    // Pricing metrics
    avgRentETB: Number,
    medianRentETB: Number, // Often more accurate than average for real estate
    minRentETB: Number,
    maxRentETB: Number,
    
    // Engagement & Conversion metrics (The "Rental Funnel")
    totalApplications: Number,
    newAgreementsCount: Number,
    
    // Performance metrics
    avgDaysToRent: Number, // How long properties sit on the market before being rented
    occupancyRate: Number, 
    
    // Funnel Health
    viewingToApplicationRate: Number, // Percentage of visits that result in an application
    applicationApprovalRate: Number,  // Percentage of applications accepted by landlords
  },

  // When the background job calculated these numbers
  computedAt: { type: Date, default: Date.now },
};

// ============================================================
// RECOMMENDED INDEXES FOR MONGOOSE
// - { period: 1, subCity: 1, propertyType: 1 } 
//   (Compound index perfectly optimized for filtering the analytics dashboard)
// ============================================================