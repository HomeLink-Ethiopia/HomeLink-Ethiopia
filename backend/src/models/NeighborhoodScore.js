const mongoose = require('mongoose');

/**
 * Feature: Neighborhood Safety & Liveability Data
 *
 * AI-generated 0–100 scores per neighborhood (sub-city) across the seven
 * dimensions tenants care about. Tenants compare neighborhoods side-by-side
 * before choosing. An overall score is derived and stored on the document.
 */
const neighborhoodScoreSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },   // e.g. "Bole"
  city: { type: String, default: 'Addis Ababa' },

  scores: {
    safety:            { type: Number, min: 0, max: 100, required: true },
    noise:             { type: Number, min: 0, max: 100, required: true },  // higher = quieter
    floodRisk:         { type: Number, min: 0, max: 100, required: true },  // higher = safer (low risk)
    waterReliability:  { type: Number, min: 0, max: 100, required: true },
    electricityReliability: { type: Number, min: 0, max: 100, required: true },
    internet:          { type: Number, min: 0, max: 100, required: true },
    transport:         { type: Number, min: 0, max: 100, required: true },
  },

  // Derived overall — set from the seed/service, kept denormalized for fast sort
  overall: { type: Number, min: 0, max: 100, default: 0 },

  // Signals behind the numbers (shown in the UI so scores aren't a black box)
  summary: String,                 // one-paragraph AI summary
  highlights: [String],            // e.g. "Metro line access", "Frequent water outages"
  listingsCount: { type: Number, default: 0 },
  avgRentEstimate: { type: Number, default: 0 },   // ETB/month, from the rent model
}, { timestamps: true });

neighborhoodScoreSchema.index({ overall: -1 });
neighborhoodScoreSchema.index({ city: 1, overall: -1 });

module.exports = mongoose.model('NeighborhoodScore', neighborhoodScoreSchema);
