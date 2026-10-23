/* eslint-disable */
// Sprint 13 API verification (Responsible AI + Intelligence) — run: node scripts/sprint13-test.js
// Covers: rent estimation (range + confidence), explainable matching, fraud-risk prioritization.
const BASE = 'http://localhost:5000';

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* html */ }
  return { status: res.status, data };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 200) : ''}`); }
}

const VALID_CONFIDENCE = ['high', 'medium', 'low', 'none'];
const WEIGHTS = { budget: 25, location: 20, propertyType: 15, bedrooms: 15, amenities: 15, availability: 10 };

(async () => {
  // logins
  const tokens = {};
  for (const role of ['tenant', 'landlord', 'admin']) {
    const r = await api('POST', '/api/auth/login', { body: { email: `dev.${role}@homelink.test`, password: 'Password123!' } });
    tokens[role] = r.data?.token;
  }
  check('logins', !!tokens.admin && !!tokens.tenant && !!tokens.landlord);
  const tenant = tokens.tenant;
  const admin = tokens.admin;

  // ────────────────────────────────────────────────
  // 1. AI RENT ESTIMATION — POST /api/v1/ai/rent-estimate
  // ────────────────────────────────────────────────
  let r = await api('POST', '/api/v1/ai/rent-estimate', {
    token: tenant,
    body: {
      location: { subCity: 'Bole' },
      propertyType: 'apartment',
      sizeM2: 85,
      bedrooms: 2,
      amenities: ['parking', 'generator'],
    },
  });
  check('estimate: 200', r.status === 200, r.status);
  const est = r.data?.data?.estimate || {};
  check('estimate: currency ETB', est.currency === 'ETB', est.currency);
  check('estimate: min <= point <= max', Number.isFinite(est.min) && Number.isFinite(est.point) && Number.isFinite(est.max) && est.min <= est.point && est.point <= est.max, `${est.min}/${est.point}/${est.max}`);
  check('estimate: positive values', est.min > 0, est.min);
  check('estimate: confidence enum', VALID_CONFIDENCE.includes(est.confidence), est.confidence);
  check('estimate: sampleSize matches comparables', Number.isFinite(est.sampleSize) && Array.isArray(est.comparables) && est.sampleSize === est.comparables.length, `${est.sampleSize} vs ${(est.comparables || []).length}`);
  check('estimate: honest message present', typeof est.message === 'string' && est.message.length > 20, est.message);
  check('estimate: comparables sorted', (est.comparables || []).every((v, i, a) => i === 0 || a[i - 1] <= v), est.comparables);

  // Confidence thresholds: high >= 15 comps, medium >= 7, low < 7
  const n = est.sampleSize;
  const expectedConf = n >= 15 ? 'high' : n >= 7 ? 'medium' : n === 0 ? 'none' : 'low';
  check(`estimate: confidence matches threshold (n=${n})`, est.confidence === expectedConf, `${est.confidence} vs ${expectedConf}`);

  // Range width reflects sample size (wider range = less certainty):
  // comps >= 5 -> ±16%, >= 3 -> ±22%, else ±30% (width ≈ 2 × spread)
  const widthPct = est.point > 0 ? ((est.max - est.min) / est.point) * 100 : 0;
  if (est.sampleSize > 0) {
    const expectedWidth = est.sampleSize >= 5 ? 32 : est.sampleSize >= 3 ? 44 : 60;
    check('estimate: range width reflects uncertainty', Math.abs(widthPct - expectedWidth) < 3, `${widthPct.toFixed(1)}% vs ~${expectedWidth}%`);
  }

  // Same inputs -> same output (deterministic, explainable)
  let r2 = await api('POST', '/api/v1/ai/rent-estimate', {
    token: tenant,
    body: {
      location: { subCity: 'Bole' },
      propertyType: 'apartment',
      sizeM2: 85,
      bedrooms: 2,
      amenities: ['parking', 'generator'],
    },
  });
  const est2 = r2.data?.data?.estimate || {};
  check('estimate: deterministic for same inputs', est2.point === est.point && est2.min === est.min && est2.max === est.max, `${est.point} vs ${est2.point}`);

  // Larger home should cost more than smaller one (monotonic size)
  let r3 = await api('POST', '/api/v1/ai/rent-estimate', {
    token: tenant,
    body: { location: { subCity: 'Bole' }, propertyType: 'apartment', sizeM2: 40, bedrooms: 1, amenities: [] },
  });
  const estSmall = r3.data?.data?.estimate || {};
  check('estimate: smaller home estimates lower', estSmall.point < est.point, `${estSmall.point} !< ${est.point}`);

  // Unknown subCity: honest fallback, never a fake confident number
  let r4 = await api('POST', '/api/v1/ai/rent-estimate', {
    token: tenant,
    body: { location: { subCity: 'Nowhere-XYZ' }, propertyType: 'apartment', sizeM2: 80, bedrooms: 2, amenities: [] },
  });
  const estUnknown = r4.data?.data?.estimate || {};
  check('estimate: unknown location still returns structured estimate', r4.status === 200 && VALID_CONFIDENCE.includes(estUnknown.confidence), r4.status);
  if ((estUnknown.sampleSize || 0) === 0) {
    check('estimate: no comps -> confidence none', estUnknown.confidence === 'none', estUnknown.confidence);
  }

  // Input validation
  r = await api('POST', '/api/v1/ai/rent-estimate', { token: tenant, body: {} });
  check('estimate: missing location rejected', r.status === 400, r.status);

  // Auth required
  r = await api('POST', '/api/v1/ai/rent-estimate', { body: { location: { subCity: 'Bole' } } });
  check('estimate: unauthenticated blocked (401)', r.status === 401, r.status);

  // ────────────────────────────────────────────────
  // 2. AI PROPERTY MATCHING — POST /api/v1/ai/match
  // ────────────────────────────────────────────────
  const prefs = {
    budget: { min: 20000, max: 45000 },
    location: { subCity: 'Bole' },
    propertyType: 'apartment',
    bedrooms: 2,
    amenities: ['parking', 'generator'],
  };
  r = await api('POST', '/api/v1/ai/match', { token: tenant, body: { ...prefs, limit: 3 } });
  check('match: 200', r.status === 200, r.status);
  const mData = r.data?.data || {};
  const matches = mData.matches || [];
  check('match: returns matches array', Array.isArray(matches) && matches.length > 0, matches.length);
  check('match: respects limit', matches.length <= 3, matches.length);
  const meta = mData.meta || {};
  check('match: transparent weights exposed', JSON.stringify(meta.weights) === JSON.stringify(WEIGHTS), meta.weights);

  const first = matches[0];
  const hasShape = (m) => m && Number.isFinite(m.score) && typeof m.grade === 'string' && m.breakdown && Array.isArray(m.reasons) && m.propertyId && m.title;
  check('match: item shape (score/grade/breakdown/reasons)', matches.every(hasShape), first);
  check('match: scores 0-100 and sorted desc', matches.every((m) => m.score >= 0 && m.score <= 100) && matches.every((m, i, a) => i === 0 || a[i - 1].score >= m.score), matches.map((m) => m.score));

  // Breakdown must cover exactly the published factors
  const bdKeys = Object.keys(first?.breakdown || {}).sort();
  check('match: breakdown has all 6 factors', JSON.stringify(bdKeys) === JSON.stringify(Object.keys(WEIGHTS).sort()), bdKeys);
  check('match: breakdown values 0-100', Object.values(first?.breakdown || {}).every((v) => v >= 0 && v <= 100), first?.breakdown);

  // Weighted score = sum(factor * weight) / sum(weights), rounded
  const wSum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
  const expected = Math.round(Object.keys(WEIGHTS).reduce((s, k) => s + ((first.breakdown[k] || 0) * WEIGHTS[k]), 0) / wSum);
  check('match: score equals weighted breakdown', first.score === expected, `${first.score} vs ${expected}`);

  // Reasons: every reason has icon + non-empty text
  check('match: reasons have icon+text', matches.every((m) => m.reasons.every((x) => ['check', 'partial', 'close'].includes(x.icon) && typeof x.text === 'string' && x.text.length > 0)), first?.reasons);

  // Honest grading: top match A-grade, weak matches must not get A
  const gradeRank = { 'A+': 1, A: 2, 'B+': 3, B: 4, 'C+': 5, C: 6, 'D+': 7, D: 8 };
  check('match: grade consistent with score', matches.every((m) => (m.score >= 90 && gradeRank[m.grade] <= 2) || (m.score < 90 && m.score >= 75 && gradeRank[m.grade] <= 4) || (m.score < 75 && m.score >= 55 && gradeRank[m.grade] <= 6) || (m.score < 55 && gradeRank[m.grade] >= 6)), matches.map((m) => `${m.score}:${m.grade}`));

  // Exact-match listing must rank first and score honestly high
  check('match: exact apartment in Bole ranks first', first?.location?.subCity === 'Bole' && first?.propertyType === 'apartment', first?.title);

  // No preference match at all -> weak scores, never high grades
  r = await api('POST', '/api/v1/ai/match', {
    token: tenant,
    body: { budget: { min: 500, max: 900 }, location: { subCity: 'Nowhere-XYZ' }, propertyType: 'boat', bedrooms: 9, amenities: ['helipad'] },
  });
  const weak = r.data?.data?.matches || [];
  check('match: impossible prefs -> no A/B grades', weak.every((m) => m.score < 75), weak.map((m) => `${m.score}:${m.grade}`));

  // Empty prefs should not crash
  r = await api('POST', '/api/v1/ai/match', { token: tenant, body: {} });
  check('match: empty prefs handled (200)', r.status === 200, r.status);

  // Auth required
  r = await api('POST', '/api/v1/ai/match', { body: prefs });
  check('match: unauthenticated blocked (401)', r.status === 401, r.status);

  // ────────────────────────────────────────────────
  // 3. FRAUD-RISK PRIORITIZATION — GET /api/v1/ai/fraud-priority
  // ────────────────────────────────────────────────
  r = await api('GET', '/api/v1/ai/fraud-priority', { token: admin });
  check('fraud: 200 for admin', r.status === 200, r.status);
  const fData = r.data?.data || {};
  const queue = fData.queue || [];
  const summary = fData.summary || {};
  check('fraud: queue array', Array.isArray(queue), typeof queue);
  check('fraud: summary counts present', Number.isFinite(summary.total) && Number.isFinite(summary.high) && Number.isFinite(summary.medium) && Number.isFinite(summary.low), summary);
  check('fraud: summary.total matches queue length', summary.total === queue.length, `${summary.total} vs ${queue.length}`);
  check('fraud: summary counts sum', summary.high + summary.medium + summary.low === queue.length, summary);

  // Item shape
  const itemShape = (q) => q.propertyId && q.title && Number.isFinite(q.riskScore) && ['HIGH', 'MEDIUM', 'LOW'].includes(q.riskLevel) && Array.isArray(q.signals);
  check('fraud: item shape (id/title/score/level/signals)', queue.every(itemShape), queue[0]);

  // Sorted descending by risk score
  check('fraud: sorted by riskScore desc', queue.every((q, i, a) => i === 0 || a[i - 1].riskScore >= q.riskScore), queue.map((q) => q.riskScore));

  // riskLevel thresholds: HIGH >= 60, MEDIUM >= 30, else LOW
  check('fraud: HIGH >= 60', queue.filter((q) => q.riskLevel === 'HIGH').every((q) => q.riskScore >= 60), queue.filter((q) => q.riskLevel === 'HIGH').map((q) => q.riskScore));
  check('fraud: MEDIUM 30-59', queue.filter((q) => q.riskLevel === 'MEDIUM').every((q) => q.riskScore >= 30 && q.riskScore < 60), queue.filter((q) => q.riskLevel === 'MEDIUM').map((q) => q.riskScore));
  check('fraud: LOW < 30', queue.filter((q) => q.riskLevel === 'LOW').every((q) => q.riskScore < 30), queue.filter((q) => q.riskLevel === 'LOW').map((q) => q.riskScore));

  // Signals must be honest: every HIGH/MEDIUM item cites at least one signal
  check('fraud: elevated risk cites signals', queue.filter((q) => q.riskLevel !== 'LOW').every((q) => q.signals.length > 0), queue.filter((q) => q.riskLevel !== 'LOW').map((q) => q.signals));

  // AI-only-orders principle: summary carries the human-review note
  check('fraud: human-review note present', typeof summary.note === 'string' && /review|decide/i.test(summary.note), summary.note);

  // Access control: AI prioritization is an admin review tool
  r = await api('GET', '/api/v1/ai/fraud-priority', { token: tenant });
  check('fraud: tenant blocked (403)', r.status === 403, r.status);
  r = await api('GET', '/api/v1/ai/fraud-priority', { token: tokens.landlord });
  check('fraud: landlord blocked (403)', r.status === 403, r.status);
  r = await api('GET', '/api/v1/ai/fraud-priority', {});
  check('fraud: unauthenticated blocked (401)', r.status === 401, r.status);

  console.log(`\nSprint 13: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
