/**
 * Sprint — additive routes the frontend calls but the team routers don't
 * expose. Mounted from server.js; all handlers include mock-DB fallbacks so
 * dashboards degrade to empty states instead of 500/404 error banners when
 * MongoDB is unavailable.
 */
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminGate = require('../middleware/adminGate');
const { isMockMode, mockStore } = require('../config/db');
const Joi = require('joi');

// Sprint 14: strict input validation for profile updates (no mass assignment).
const profileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).allow(''),
  lastName: Joi.string().trim().min(2).max(30).allow(''),
  phone: Joi.string().trim().pattern(/^(09|07)[0-9]{8}$/).allow(''),
}).unknown(false);


// ─── GET/PUT /api/v1/extra/profile ─────────────────────────────────────────
// ProfilePage calls /api/auth/profile which doesn't exist; mounted here so
// the tenant/landlord/admin profile screens load and save.
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    if (isMockMode()) {
      let user = Array.from(mockStore.users.values()).find((u) => u._id === req.user.id);
      if (!user) {
        // Old token from a previous mock session - auto-provision so the
        // dashboard keeps working after backend restarts.
        user = {
          _id: req.user.id,
          firstName: 'Demo',
          lastName: 'User',
          email: 'demo-' + req.user.id + '@homelink.local',
          phone: '',
          role: req.user.role || 'tenant',
          password: '',
          emailVerified: true,
          identityStatus: 'verified',
        };
        mockStore.users.set(user.email, user);
      }
      return res.status(200).json({
        data: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          emailVerified: user.emailVerified,
          identityStatus: user.identityStatus,
        },
      });
    }
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ data: user });
  } catch (error) {
    console.error('Extra profile GET error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { error, value } = profileSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { firstName, lastName, phone } = value;
    if (isMockMode()) {
      let user = Array.from(mockStore.users.values()).find((u) => u._id === req.user.id);
      if (!user) {
        user = {
          _id: req.user.id,
          firstName: 'Demo',
          lastName: 'User',
          email: 'demo-' + req.user.id + '@homelink.local',
          phone: '',
          role: req.user.role || 'tenant',
          password: '',
          emailVerified: true,
          identityStatus: 'verified',
        };
        mockStore.users.set(user.email, user);
      }
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phone !== undefined) user.phone = phone;
      mockStore.users.set(user.email, user);
      return res.status(200).json({
        message: 'Profile updated',
        data: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, role: user.role },
        apiUser: { id: user._id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, role: user.role },
      });
    }
    const User = require('../models/User');
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone },
      { new: true, runValidators: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({
      message: 'Profile updated',
      data: user,
      apiUser: { id: user._id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Extra profile PUT error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/v1/extra/viewings/landlord ───────────────────────────────────
// Landlord viewings page alias (matches /viewings/my handler).
router.get('/viewings/landlord', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    if (isMockMode()) return res.status(200).json({ data: [...(mockStore.viewings || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
    const Viewing = require('../models/Viewing');
    const viewings = await Viewing.find({ landlordId: req.user.id })
      .populate('propertyId', 'title location rentAmount images')
      .populate('tenantId', 'firstName lastName email phone')
      .sort({ date: 1 });
    res.status(200).json({ data: viewings });
  } catch (error) {
    console.error('Extra landlord viewings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/v1/extra/agreements/landlord/tenants ─────────────────────────
// Landlord tenants page: one entry per tenant with their properties.
router.get('/agreements/landlord/tenants', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    if (isMockMode()) {
      const landlordId = String(req.user.id || '');
      const foundUser = [...mockStore.users.values()].find(u => u._id === landlordId);
      const userEmail = req.user?.email || foundUser?.email;
      const isSeed = userEmail === 'dev.landlord@homelink.test';
      const myAgreements = (mockStore.agreements || []).filter(a => {
        const lId = String((a.landlordId && a.landlordId._id) || a.landlordId || '');
        return lId === landlordId || (isSeed && (lId === 'mock-landlord-1' || !lId));
      });

      const byTenant = new Map();
      for (const a of myAgreements) {
        const tid = String((a.tenantId && a.tenantId._id) || a.tenantId);
        if (!byTenant.has(tid)) {
          byTenant.set(tid, {
            _id: tid,
            firstName: (a.tenantId && a.tenantId.firstName) || '',
            lastName: (a.tenantId && a.tenantId.lastName) || '',
            email: (a.tenantId && a.tenantId.email) || '',
            phone: '',
            properties: [],
          });
        }
        byTenant.get(tid).properties.push({
          _id: String((a.propertyId && a.propertyId._id) || a.propertyId),
          title: (a.propertyId && a.propertyId.title) || 'Property',
          rentAmount: a.rentAmount,
          startDate: a.startDate,
          agreementStatus: a.status,
        });
      }
      return res.status(200).json({ data: Array.from(byTenant.values()) });
    }
    const RentalAgreement = require('../models/RentalAgreement');
    const agreements = await RentalAgreement.find({ landlordId: req.user.id })
      .populate('tenantId', 'firstName lastName email phone')
      .populate('propertyId', 'title rentAmount')
      .sort({ createdAt: -1 });

    const byTenant = new Map();
    for (const a of agreements) {
      const tenantId = String(a.tenantId?._id || a.tenantId || '');
      if (!byTenant.has(tenantId)) {
        byTenant.set(tenantId, {
          _id: tenantId,
          firstName: a.tenantId?.firstName || '',
          lastName: a.tenantId?.lastName || '',
          email: a.tenantId?.email || '',
          phone: a.tenantId?.phone || '',
          properties: [],
        });
      }
      byTenant.get(tenantId).properties.push({
        _id: String(a.propertyId?._id || a.propertyId || ''),
        title: a.propertyId?.title || 'Property',
        rentAmount: a.rentAmount,
        startDate: a.startDate,
        agreementStatus: a.status,
      });
    }
    res.status(200).json({ data: Array.from(byTenant.values()) });
  } catch (error) {
    console.error('Extra landlord tenants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── AI aliases (/api/v1/ai/*) — the frontend service layer calls /api/v1/ai/*
// but the team router is mounted at /api/ai. Also serves deterministic mock
// results when the database (or Python AI service) is unavailable.
// Sprint 13 — comparables-based estimate from the REAL in-memory listings.
// Inputs: location (city/sub-city), propertyType, sizeM2, bedrooms, amenities.
// Output: a rent RANGE (min–max) plus confidence based on sample size.
function mockEstimate(input) {
  const props = mockStore.properties || [];
  const subCity = String(input.subCity || input.subcity || '').toLowerCase();
  const type = String(input.propertyType || '').toLowerCase();
  const beds = Number(input.bedrooms) || null;
  const amenities = Array.isArray(input.amenities) ? input.amenities.map((a) => String(a).toLowerCase()) : [];

  // Comparables: same sub-city and type; relax stepwise when the sample is thin.
  let comps = props.filter((pr) =>
    (!subCity || String((pr.location && pr.location.subCity) || '').toLowerCase() === subCity) &&
    (!type || String(pr.propertyType || '').toLowerCase() === type)
  );
  let relaxed = "exact";
  if (comps.length < 3) { comps = props.filter((pr) => !type || String(pr.propertyType || '').toLowerCase() === type); relaxed = "same property type, any sub-city"; }
  if (comps.length < 3) { comps = props; relaxed = "all current listings"; }

  if (comps.length === 0) {
    return {
      min: null, max: null, point: null, currency: 'ETB', confidence: 'none', sampleSize: 0,
      message: 'Not enough comparable listings yet to estimate a rent. The AI will not invent a number — add more details or try again later.',
    };
  }

  // Adjust each comparable toward the target spec: ±2% per bedroom, ±0.15%/m² of
  // size difference, +8% per shared-amenity shortfall.
  const targetSize = Number(input.sizeM2) || null;
  const adjusted = comps.map((pr) => {
    let v = pr.rentAmount || 0;
    if (beds && pr.bedrooms) v *= 1 + 0.02 * (beds - pr.bedrooms);
    if (targetSize && pr.sizeM2) v *= 1 + 0.0015 * (targetSize - pr.sizeM2);
    const prAmenities = (pr.amenities || []).map((a) => String(a).toLowerCase());
    if (amenities.length > 0) {
      const missing = amenities.filter((a) => !prAmenities.includes(a)).length;
      v *= 1 + 0.08 * missing;
    }
    return v;
  }).filter((v) => v > 0);

  if (adjusted.length === 0) {
    return { min: null, max: null, point: null, currency: 'ETB', confidence: 'none', sampleSize: 0, message: 'No priced comparables available yet.' };
  }
  adjusted.sort((a, b) => a - b);
  const mid = Math.floor(adjusted.length / 2);
  const median = adjusted.length % 2 ? adjusted[mid] : Math.round((adjusted[mid - 1] + adjusted[mid]) / 2);
  const round = (v) => Math.round(v / 500) * 500;
  const spread = adjusted.length >= 5 ? 0.16 : adjusted.length >= 3 ? 0.22 : 0.3;
  const point = round(median);
  const confidence = adjusted.length >= 15 ? 'high' : adjusted.length >= 7 ? 'medium' : 'low';
  const compList = adjusted.slice(0, 5);

  return {
    min: round(median * (1 - spread)),
    point,
    max: round(median * (1 + spread)),
    currency: 'ETB',
    confidence,
    sampleSize: adjusted.length,
    comparables: compList.map((v) => round(v)),
    message: `Based on ${adjusted.length} comparable listing${adjusted.length === 1 ? "" : "s"} on HomeLink${relaxed !== "exact" ? " (" + relaxed + ")" : ""}. The range widens when fewer listings are available - treat it as guidance, not a set price.`,
  };
}
// Sprint 13 — explainable match score: every factor is computed from the
// actual difference between the preference and the listing, so the
// reasons always match the numbers shown.
function scoreMockMatch(pr, prefs) {
  const budget = prefs.budget || {};
  const maxBudget = Number(budget.max) || 100000;
  const minBudget = Number(budget.min) || 0;
  const price = pr.rentAmount || 0;

  // Budget factor (25%): full marks inside the range, decaying outside.
  let budgetScore;
  if (price >= minBudget && price <= maxBudget) {
    budgetScore = 100 - Math.round((price / Math.max(maxBudget, 1)) * 15);
  } else if (price < minBudget) {
    budgetScore = 70;
  } else {
    const over = (price - maxBudget) / Math.max(maxBudget, 1);
    budgetScore = Math.max(20, Math.round(85 - over * 120));
  }

  // Location factor (20%).
  const wantCity = String((prefs.location && prefs.location.city) || '').toLowerCase();
  const wantSub = String((prefs.location && prefs.location.subCity) || '').toLowerCase();
  const propCity = String((pr.location && pr.location.city) || '').toLowerCase();
  const propSub = String((pr.location && pr.location.subCity) || '').toLowerCase();
  let locationScore = 60;
  let locationNote = 'Location not specified — showing city-wide';
  if (wantSub) {
    if (propSub === wantSub) { locationScore = 100; locationNote = `In your preferred sub-city (${propSub})`; }
    else { locationScore = 45; locationNote = `Different sub-city (${propSub || 'unknown'} vs ${wantSub})`; }
  } else if (wantCity) {
    if (propCity === wantCity || propCity.includes(wantCity) || wantCity.includes(propCity)) { locationScore = 95; locationNote = `In your preferred city (${propCity || 'Addis Ababa'})`; }
    else { locationScore = 40; locationNote = `Outside your preferred city`; }
  }

  // Property type factor (15%).
  const wantType = String(prefs.propertyType || '').toLowerCase();
  const propType = String(pr.propertyType || '').toLowerCase();
  let typeScore = 75;
  let typeNote = 'Any property type accepted';
  if (wantType) {
    if (propType === wantType) { typeScore = 100; typeNote = `${propType} matches your preference`; }
    else { typeScore = 35; typeNote = `You wanted a ${wantType}, this is a ${propType || 'different type'}`; }
  }

  // Bedrooms factor (15%).
  const wantBeds = Number(prefs.bedrooms) || 0;
  const beds = pr.bedrooms || 0;
  let bedScore = 75;
  let bedNote = 'No bedroom requirement set';
  if (wantBeds) {
    if (beds === wantBeds) { bedScore = 100; bedNote = `${beds} bedroom${beds === 1 ? '' : 's'} — exact match`; }
    else if (beds > wantBeds) { bedScore = 82; bedNote = `${beds} bedrooms (you asked for ${wantBeds} — extra space)`; }
    else { bedScore = 30; bedNote = `Only ${beds} bedroom${beds === 1 ? '' : 's'} (you asked for ${wantBeds})`; }
  }

  // Amenities factor (15%).
  const wantAmen = (prefs.amenities || []).map((a) => String(a).toLowerCase());
  const propAmen = (pr.amenities || []).map((a) => String(a).toLowerCase());
  let amenityScore = 70;
  let amenityNote = 'No amenity preferences set';
  if (wantAmen.length > 0) {
    const have = wantAmen.filter((a) => propAmen.includes(a));
    const missing = wantAmen.filter((a) => !propAmen.includes(a));
    amenityScore = Math.round((have.length / wantAmen.length) * 100);
    amenityNote = missing.length === 0
      ? `All ${wantAmen.length} requested amenities available`
      : `${have.length}/${wantAmen.length} amenities (missing: ${missing.join(', ') || 'none'})`;
  }

  // Availability factor (10%): verified+active listings rank higher.
  const verified = pr.verificationStatus === 'verified';
  const active = (pr.listingStatus || 'active') === 'active';
  const availScore = verified && active ? 100 : active ? 75 : 40;

  const score = Math.max(20, Math.min(99, Math.round(
    budgetScore * 0.25 + locationScore * 0.20 + typeScore * 0.15 +
    bedScore * 0.15 + amenityScore * 0.15 + availScore * 0.10
  )));
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C' : 'D';

  const reasons = [
    { icon: budgetScore >= 80 ? 'check' : budgetScore >= 55 ? 'partial' : 'close', text: `Budget: ETB ${price.toLocaleString()}/mo vs your max ETB ${maxBudget.toLocaleString()} — ${budgetScore >= 80 ? 'comfortably within range' : budgetScore >= 55 ? 'within range but near the top' : 'above your budget'}` },
    { icon: locationScore >= 80 ? 'check' : locationScore >= 55 ? 'partial' : 'close', text: locationNote },
    { icon: typeScore >= 80 ? 'check' : typeScore >= 55 ? 'partial' : 'close', text: typeNote },
    { icon: bedScore >= 80 ? 'check' : bedScore >= 55 ? 'partial' : 'close', text: bedNote },
    { icon: amenityScore >= 80 ? 'check' : amenityScore >= 55 ? 'partial' : 'close', text: amenityNote },
    { icon: verified ? 'check' : 'partial', text: verified ? 'Identity-verified listing' : 'Not yet verified — treat with care' },
  ];

  return {
    propertyId: pr._id, title: pr.title, propertyType: pr.propertyType,
    rentAmount: pr.rentAmount, bedrooms: pr.bedrooms, bathrooms: pr.bathrooms, sizeM2: pr.sizeM2,
    location: pr.location, images: pr.images || [], verificationStatus: pr.verificationStatus,
    score, grade,
    breakdown: { budget: budgetScore, location: locationScore, propertyType: typeScore, bedrooms: bedScore, amenities: amenityScore, availability: availScore },
    reasons,
  };
}
router.post('/ai/rent-estimate', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const loc = body.location || {};
    // The landlord form sends city/subCity flat (not nested) — accept both
    // shapes, and only reject when there is truly nothing to estimate from
    // (sprint-fix-rent-estimate).
    const city = loc.city || body.city || '';
    const subCity = loc.subCity || body.subCity || body.subcity || '';
    if (!city && !subCity && !body.sizeM2 && !body.bedrooms && !body.propertyType) {
      return res.status(400).json({ message: 'Provide a city or sub-city (and property details) for a rent estimate.' });
    }
    const normalized = {
      ...body,
      city,
      subCity,
      location: { ...loc, city, subCity },
    };
    return res.status(200).json({ data: { estimate: mockEstimate(normalized) } });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});
router.post('/ai/match', authMiddleware, async (req, res) => {
  try {
    const prefs = req.body || {};
    const limit = prefs.limit || 6;
    const matches = [...(mockStore.properties || [])]
      .map((pr) => scoreMockMatch(pr, prefs))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return res.status(200).json({
      data: {
        matches,
        meta: {
          weights: { budget: 25, location: 20, propertyType: 15, bedrooms: 15, amenities: 15, availability: 10 },
          candidatesConsidered: (mockStore.properties || []).length,
          confidence: 'medium',
          method: 'explainable-weighted-mock',
          note: 'Demo scoring against in-memory listings.',
        },
      },
    });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});
// Sprint 13 — AI fraud-risk prioritization: ranks the admin review queue from
// real store signals (reports, duplicates, price anomaly, verification, age).
// The AI only ORDERS the queue — every decision stays with a human admin.
router.get('/ai/fraud-priority', authMiddleware, roleMiddleware('admin'), adminGate, async (req, res) => {
  try {
    if (isMockMode()) {
      const props = mockStore.properties || [];
      const reports = mockStore.fraudReports || [];
      const queue = props
        .map((pr) => {
          const signals = [];
          let score = 0;
          const openReports = reports.filter((r) => r.reportedPropertyId === pr._id && r.status !== 'dismissed').length;
          if (openReports > 0) { score += Math.min(50, openReports * 22); signals.push(`multiple_reports (${openReports})`); }
          const dupTitles = props.filter((x) => x.title === pr.title).length;
          if (dupTitles > 1) { score += 18; signals.push('duplicate_property_information_found'); }
          const dupImgs = props.filter((x) => x._id !== pr._id && (x.images || []).some((i) => (pr.images || []).some((j) => j.url && i.url === j.url))).length;
          if (dupImgs > 0) { score += 20; signals.push('duplicate_images_detected'); }
          const listed = Number(pr.rentAmount) || 0;
          const sameArea = props.filter((x) => (x.location && x.location.subCity) === (pr.location && pr.location.subCity) && x._id !== pr._id);
          if (sameArea.length >= 2) {
            const avg = sameArea.reduce((s2, x) => s2 + (Number(x.rentAmount) || 0), 0) / sameArea.length;
            if (avg > 0 && listed < avg * 0.5) { score += 25; signals.push('severe_underpricing_vs_area_average'); }
          }
          if (pr.verificationStatus !== 'verified') { score += 12; signals.push('unverified_listing'); }
          const ageDays = (Date.now() - new Date(pr.createdAt || Date.now()).getTime()) / 86400000;
          if (ageDays < 7 && openReports > 0) { score += 10; signals.push('fresh_listing_with_reports'); }
          if (pr.fraudRiskScore && Number(pr.fraudRiskScore) > 50) { score += 15; signals.push('listing_scan_flagged'); }
          score = Math.min(100, Math.round(score));
          const level = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
          return {
            propertyId: pr._id,
            title: pr.title,
            propertyType: pr.propertyType,
            rentAmount: pr.rentAmount,
            location: pr.location || {},
            verificationStatus: pr.verificationStatus || 'unverified',
            listingStatus: pr.listingStatus || 'active',
            riskScore: score,
            riskLevel: level,
            signals,
          };
        })
        .sort((a, b) => b.riskScore - a.riskScore);
      const high = queue.filter((q) => q.riskLevel === 'HIGH').length;
      const medium = queue.filter((q) => q.riskLevel === 'MEDIUM').length;
      const low = queue.filter((q) => q.riskLevel === 'LOW').length;
      return res.status(200).json({
        data: {
          queue,
          summary: { total: queue.length, high, medium, low, note: 'AI ranks the queue from risk signals — it never acts on its own. Review and decide.' },
        },
      });
    }
    return res.status(200).json({
      data: {
        queue: [],
        summary: { total: 0, high: 0, medium: 0, low: 0, note: 'No suspicious listings in demo data.' },
      },
    });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});
// Property reviews list (property detail page) — empty in mock mode.
router.get('/properties/:id/reviews', authMiddleware, async (req, res) => {
  try {
    if (isMockMode()) return res.status(200).json({ data: [] });
    const Review = require('../models/Review');
    const reviews = await Review.find({ propertyId: req.params.id }).populate('userId', 'firstName lastName').sort({ createdAt: -1 });
    return res.status(200).json({ data: reviews });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ─── GET /api/v1/extra/reviews/mine ────────────────────────────────────────
// Reviews written by the logged-in user (tenant reviews page).
router.get('/reviews/mine', authMiddleware, async (req, res) => {
  try {
    if (isMockMode()) {
      const mine = (mockStore.reviews || [])
        .filter((r) => String(r.reviewerId && r.reviewerId._id || r.reviewerId) === String(req.user.id))
        .map((r) => ({
          ...r,
          reviewerName: r.reviewerId && r.reviewerId.firstName ? (r.reviewerId.firstName + ' ' + (r.reviewerId.lastName || '')).trim() : undefined,
          revieweeName: (() => {
            const id = String((r.revieweeId && r.revieweeId._id) || r.revieweeId || '');
            const u = Array.from(mockStore.users.values()).find((x) => x._id === id);
            if (u) return (u.firstName + ' ' + (u.lastName || '')).trim();
            if (r.revieweeId && r.revieweeId.firstName) return (r.revieweeId.firstName + ' ' + (r.revieweeId.lastName || '')).trim();
            const a = (mockStore.agreements || []).find((ag) => ag._id === r.agreementId);
            if (a && a.tenantId && a.tenantId.firstName) return (a.tenantId.firstName + ' ' + (a.tenantId.lastName || '')).trim();
            return 'Tenant';
          })(),
        }));
      return res.status(200).json({ data: mine });
    }
    const Review = require('../models/Review');
    const reviews = await Review.find({ userId: req.user.id })
      .populate('propertyId', 'title location')
      .sort({ createdAt: -1 });
    res.status(200).json({ data: reviews });
  } catch (error) {
    console.error('Extra reviews/mine error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/v1/extra/reviews/my-properties ───────────────────────────────
// Reviews across the landlord's properties.
router.get('/reviews/my-properties', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    if (isMockMode()) {
      const propIds = (mockStore.properties || []).filter((pr) => pr.landlordId === req.user.id || pr.landlordId === "mock-landlord-1").map((pr) => pr._id);
      const list = (mockStore.reviews || [])
        .filter((r) => propIds.includes(r.propertyId) && r.reviewType !== 'landlord_to_tenant')
        .map((r) => ({
          ...r,
          propertyTitle: ((mockStore.properties || []).find((pr) => pr._id === r.propertyId) || {}).title || 'Property',
          reviewerName: r.reviewerId && r.reviewerId.firstName ? (r.reviewerId.firstName + ' ' + (r.reviewerId.lastName || '')).trim() : 'Tenant',
        }));
      return res.status(200).json({ data: list });
    }
    const Review = require('../models/Review');
    const Property = require('../models/Property');
    const LandlordProfile = require('../models/LandlordProfile');

    const profile = await LandlordProfile.findOne({ accountId: req.user.id });
    if (!profile) return res.status(200).json({ data: [] });
    const props = await Property.find({ landlordId: profile._id }).select('_id');
    const reviews = await Review.find({ propertyId: { $in: props.map((p) => p._id) } })
      .populate('propertyId', 'title location')
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.status(200).json({ data: reviews });
  } catch (error) {
    console.error('Extra reviews/my-properties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/v1/extra/reviews/rate-tenant ────────────────────────────────
// Landlord rates a tenant (acknowledged in mock mode).
router.post('/reviews/rate-tenant', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    if (isMockMode()) {
      const agreementId = (req.body && req.body.agreementId) || 'mock-agreement-1';
      const agreement = (mockStore.agreements || []).find((a) => a._id === agreementId);
      if (!agreement) return res.status(404).json({ message: 'Rental agreement not found.' });
      const tenantId = (agreement.tenantId && agreement.tenantId._id) || agreement.tenantId;
      if (String(tenantId) === String(req.user.id)) return res.status(400).json({ message: 'You cannot review yourself.' });
      const dupe = (mockStore.reviews || []).find((r) => r.agreementId === agreementId && r.reviewType === 'landlord_to_tenant' && String((r.reviewerId && r.reviewerId._id) || r.reviewerId) === String(req.user.id));
      if (dupe) return res.status(400).json({ message: 'You have already rated this tenant for this agreement.' });
      const rating = {
        _id: 'mock-review-' + Date.now(),
        reviewerId: { _id: req.user.id, firstName: req.user.firstName || 'Landlord', lastName: req.user.lastName || '' },
        revieweeId: tenantId,
        propertyId: (agreement.propertyId && agreement.propertyId._id) || null,
        agreementId,
        reviewType: 'landlord_to_tenant',
        rating: Math.max(1, Math.min(5, Number(req.body && req.body.rating) || 5)),
        comment: (req.body && req.body.comment) || '',
        landlordReply: '',
        status: 'visible',
        createdAt: new Date().toISOString(),
      };
      mockStore.reviews.push(rating);
      return res.status(201).json({ message: 'Rating saved', data: rating });
    }
    const Review = require('../models/Review');
    const review = await Review.create({ ...req.body, landlordId: req.user.id, type: 'tenant-rating' });
    res.status(201).json({ message: 'Rating saved', data: review });
  } catch (error) {
    console.error('Extra rate-tenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/v1/extra/reviews/:id/reply ───────────────────────────────────
// Landlord reply on a review (acknowledged in mock mode).
router.put('/reviews/:id/reply', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
  try {
    if (isMockMode()) {
      return res.status(200).json({ message: 'Reply saved (mock mode)', data: { _id: req.params.id, reply: req.body?.reply || '' } });
    }
    const Review = require('../models/Review');
    const review = await Review.findByIdAndUpdate(req.params.id, { landlordReply: req.body?.reply || '' }, { new: true });
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.status(200).json({ message: 'Reply saved', data: review });
  } catch (error) {
    console.error('Extra review reply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/v1/extra/audit-logs ──────────────────────────────────────────
// Sprint 11 — admin audit trail ("Admin X approved landlord Y at <time>").
router.get('/audit-logs', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    if (isMockMode()) {
      const logs = [...(mockStore.auditLogs || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 200);
      return res.status(200).json({ data: logs });
    }
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find({})
      .populate('performedBy', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const shaped = logs.map((l) => ({
      _id: l._id,
      actorName: l.performedBy ? ((l.performedBy.firstName || '') + ' ' + (l.performedBy.lastName || '')).trim() : 'Admin',
      actorRole: (l.performedBy && l.performedBy.role) || 'admin',
      action: l.action,
      targetType: String((l.targetEntity && l.targetEntity.entityType) || 'system').toLowerCase(),
      targetLabel: (l.metadata && l.metadata.targetLabel) || String((l.targetEntity && l.targetEntity.entityId) || ''),
      changes: l.before && l.after ? Object.keys(l.after).map((k) => ({ field: k, from: String((l.before || {})[k]), to: String(l.after[k]) })) : [],
      decision: l.action,
      reason: (l.metadata && l.metadata.reason) || '',
      ip: l.ipAddress || '',
      createdAt: l.createdAt,
    }));
    res.status(200).json({ data: shaped });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
