const TenantPayment = require('../models/TenantPayment');
const RentalAgreement = require('../models/RentalAgreement');
const Review = require('../models/Review');
const CreditScore = require('../models/CreditScore');

/**
 * Tenant Rent Credit Score — computed from real platform data.
 *
 * Weights: on-time payments 400 | lease completion 300 | landlord reviews 300
 * New tenants with no history get the neutral baseline 620 ("building" tier).
 */

const BASELINE = 620;

const computeCreditScore = async (userId) => {
  // ── 1. On-time payments (0–400) ──
  const payments = await TenantPayment.find({ tenantId: userId }).lean();
  const now = new Date();
  // Only invoices that have actually come due (or were paid/waived) count —
  // a future pending invoice must never penalize the tenant.
  const rentPayments = payments.filter(p =>
    p.paymentType === 'rent' && (
      p.status === 'paid' || p.status === 'partial' || p.status === 'waived' ||
      (p.dueDate && new Date(p.dueDate) <= now)
    )
  );
  const total = rentPayments.length;
  const paid = rentPayments.filter(p => p.status === 'paid');
  const onTime = paid.filter(p => p.paidAt && p.dueDate && new Date(p.paidAt) <= new Date(p.dueDate));
  const late = paid.filter(p => p.paidAt && p.dueDate && new Date(p.paidAt) > new Date(p.dueDate));

  let payPoints = 0;
  let payDetail = 'No rent payment history yet';
  if (total > 0) {
    const onTimeRatio = onTime.length / total;             // 0..1
    const latePenalty = Math.min(late.length / Math.max(total, 1), 1) * 0.5;
    payPoints = Math.round(400 * Math.max(onTimeRatio - latePenalty, 0));
    payDetail = `${onTime.length} of ${total} rent payments on time${late.length ? `, ${late.length} late` : ''}`;
  }

  // ── 2. Lease completion (0–300) ──
  const agreements = await RentalAgreement.find({ tenantId: userId }).lean();
  const completed = agreements.filter(a => {
    const ended = ['expired', 'terminated'].includes(a.status);
    if (a.status === 'terminated') return false;            // early termination hurts
    return ended;
  });
  // expired = ran to the end date naturally
  const expiredClean = agreements.filter(a => a.status === 'expired').length;
  const terminatedEarly = agreements.filter(a => a.status === 'terminated').length;
  const active = agreements.filter(a => a.status === 'active');

  let monthsOfTenure = 0;
  active.forEach(a => {
    const days = (Date.now() - new Date(a.startDate).getTime()) / 86400000;
    monthsOfTenure += Math.max(Math.floor(days / 30), 0);
  });

  let leasePoints = 0;
  let leaseDetail = 'No completed leases yet';
  if (expiredClean > 0 || active.length > 0) {
    // each completed lease 120 pts; current continuous tenure up to 180 pts (6+ months)
    leasePoints = Math.min(expiredClean * 120, 240);
    const tenurePoints = Math.min(Math.floor(monthsOfTenure / 6) * 60, 180);
    leasePoints += tenurePoints;
    leasePoints = Math.min(leasePoints, 300);
    const parts = [];
    if (expiredClean) parts.push(`${expiredClean} lease${expiredClean > 1 ? 's' : ''} completed`);
    if (active.length) parts.push(`${monthsOfTenure} month${monthsOfTenure === 1 ? '' : 's'} of current tenancy`);
    if (terminatedEarly) parts.push(`${terminatedEarly} early termination${terminatedEarly > 1 ? 's' : ''} (penalty applied)`);
    leaseDetail = parts.join(' • ') || 'No lease history';
  }
  leasePoints -= terminatedEarly * 60;
  leasePoints = Math.max(leasePoints, 0);

  // ── 3. Landlord reviews (0–300) ──
  const reviews = await Review.find({ revieweeId: userId, reviewType: 'landlord_to_tenant', status: 'published' }).lean();
  let reviewPoints = 0;
  let reviewDetail = 'No landlord reviews yet';
  if (reviews.length > 0) {
    const avg = reviews.reduce((s, r) => s + (r.ratings?.overall || 3), 0) / reviews.length; // 1..5
    // avg 3.0 → 150 pts, 5.0 → 300, 1.0 → 30 (not zero — a reviewed tenant has signal)
    reviewPoints = Math.round(((avg - 1) / 4) * 270 + 30);
    reviewPoints = Math.max(Math.min(reviewPoints, 300), 0);
    reviewDetail = `${reviews.length} landlord review${reviews.length > 1 ? 's' : ''} • ${avg.toFixed(1)}/5 average`;
  }

  // ── Combine ──
  const hasHistory = total > 0 || agreements.length > 0 || reviews.length > 0;
  const raw = payPoints + leasePoints + reviewPoints;

  // Blend with baseline: no history → exactly 620; light history → 60% evidence / 40% baseline
  let score;
  if (!hasHistory) score = BASELINE;
  else if (total + agreements.length + reviews.length < 3) score = Math.round(raw * 0.6 + BASELINE * 0.4);
  else score = raw;

  score = Math.max(0, Math.min(1000, score));

  const doc = await CreditScore.findOneAndUpdate(
    { userId },
    {
      score,
      tier: CreditScore.tierFor(score),
      breakdown: {
        onTimePayments: { points: payPoints, detail: payDetail },
        leaseCompletion: { points: leasePoints, detail: leaseDetail },
        landlordReviews: { points: reviewPoints, detail: reviewDetail },
      },
      stats: {
        paymentsTotal: total,
        paymentsOnTime: onTime.length,
        paymentsLate: late.length,
        agreementsCompleted: expiredClean,
        agreementsTerminatedEarly: terminatedEarly,
        activeAgreement: active.length > 0,
        monthsOfTenure,
        reviewsCount: reviews.length,
        reviewsAvgRating: reviews.length
          ? Number((reviews.reduce((s, r) => s + (r.ratings?.overall || 3), 0) / reviews.length).toFixed(1))
          : 0,
      },
      computedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return doc;
};

module.exports = { computeCreditScore, BASELINE };
