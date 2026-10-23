const mongoose = require('mongoose');

/**
 * Feature: Tenant Rent Credit Score (0–1000)
 *
 * Computed from real platform data:
 *   - On-time rent payments (40%)   → TenantPayment history
 *   - Lease completion (30%)        → RentalAgreement outcomes
 *   - Landlord reviews (30%)        → Review (landlord_to_tenant)
 *
 * Landlords see this score before approving applications; tenants see their
 * own score on the dashboard. New tenants start at a neutral baseline of 620.
 */
const creditScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  score: { type: Number, min: 0, max: 1000, default: 620 },
  tier: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'building', 'risky'],
    default: 'building',
  },

  breakdown: {
    onTimePayments: {
      points: { type: Number, default: 0 },     // contribution out of 400
      detail: String,                            // e.g. "7 of 8 payments on time"
    },
    leaseCompletion: {
      points: { type: Number, default: 0 },     // out of 300
      detail: String,
    },
    landlordReviews: {
      points: { type: Number, default: 0 },     // out of 300
      detail: String,
    },
  },

  stats: {
    paymentsTotal: { type: Number, default: 0 },
    paymentsOnTime: { type: Number, default: 0 },
    paymentsLate: { type: Number, default: 0 },
    agreementsCompleted: { type: Number, default: 0 },
    agreementsTerminatedEarly: { type: Number, default: 0 },
    activeAgreement: { type: Boolean, default: false },
    monthsOfTenure: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    reviewsAvgRating: { type: Number, default: 0 },
  },

  computedAt: { type: Date, default: Date.now },
}, { timestamps: true });

creditScoreSchema.index({ userId: 1 });

creditScoreSchema.statics.tierFor = function (score) {
  if (score >= 850) return 'excellent';
  if (score >= 700) return 'good';
  if (score >= 550) return 'fair';
  if (score >= 400) return 'building';
  return 'risky';
};

module.exports = mongoose.model('CreditScore', creditScoreSchema);
