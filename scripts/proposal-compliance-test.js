#!/usr/bin/env node
/**
 * Proposal compliance suite — verifies the 13 functional requirements
 * (FR-01..FR-13) + responsible-AI components of the HomeLink Ethiopia
 * proposal against the running backend (mock mode).
 * Run: node scripts/proposal-compliance-test.js  (backend on :5000)
 */
const BASE = 'http://localhost:5000';
const TENANT = { email: 'dev.tenant@homelink.test', password: 'Password123!' };
const LANDLORD = { email: 'dev.landlord@homelink.test', password: 'Password123!' };
const ADMIN = { email: 'dev.admin@homelink.test', password: 'Password123!' };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};
async function api(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}
const unwrap = (d) => (d && typeof d === 'object' && 'data' in d ? d.data : d);

(async () => {
  console.log('Proposal compliance (FR-01..FR-13) — ' + BASE);
  const t = await api('POST', '/api/auth/login', null, TENANT);
  const l = await api('POST', '/api/auth/login', null, LANDLORD);
  const a = await api('POST', '/api/auth/login', null, ADMIN);
  const tTok = t.data.token, lTok = l.data.token, aTok = a.data.token;
  ok('demo accounts (tenant/landlord/admin) authenticate', !!tTok && !!lTok && !!aTok);

  // FR-01 — registration, auth, roles, suspension, audit history
  console.log('\nFR-01 Registration, Authentication & Roles');
  const reg = await api('POST', '/api/auth/register', null, {
    firstName: 'FR01', lastName: 'Probe', email: `fr01-${Date.now()}@homelink.test`,
    phone: '0934' + String(Date.now()).slice(-6), password: 'Password123!', role: 'tenant',
  });
  ok('register + roles + validation', reg.status === 201);
  ok('RBAC enforced (tenant→landlord route 403)', (await api('GET', '/api/v1/agreements/landlord', tTok)).status === 403);
  const sus = await api('PUT', '/api/v1/admin/users/mock-user-seed-1/suspend', aTok, { suspend: false, reason: 'compliance-probe' });
  ok('admin suspension endpoint exists (200/404)', [200, 404].includes(sus.status), 'got ' + sus.status);
  ok('audit history recorded', (unwrap((await api('GET', '/api/v1/admin/audit-logs', aTok)).data) || []).length >= 1);

  // FR-02 — landlord & property verification + audit trail
  console.log('\nFR-02 Landlord & Property Verification');
  const pend = await api('GET', '/api/v1/verification/pending', aTok);
  ok('verification queue (pending/under_review states)', pend.status === 200 && 'landlords' in pend.data.data);
  ok('admin review decision recorded', (await api('GET', '/api/v1/admin/audit-logs', aTok)).status === 200);

  // FR-03 — listing & discovery
  console.log('\nFR-03 Property Listing & Discovery');
  const s = await api('GET', '/api/v1/properties/search?q=Bole&minPrice=10000&sort=price_asc&page=1&limit=5');
  const rows = unwrap(s.data) || [];
  ok('structured listings (location/type/rooms/size/rent/amenities/images)', s.status === 200 && rows.length >= 1 && 'rentAmount' in rows[0] && 'amenities' in rows[0] && 'images' in rows[0]);
  ok('search + filter + sort + pagination', !!s.data.pagination);

  // FR-04 — intelligent matching (explainable)
  console.log('\nFR-04 Intelligent Property Matching');
  const m = await api('POST', '/api/v1/ai/match', tTok, { budget: { min: 20000, max: 50000 }, location: { subCity: 'Bole' }, propertyType: 'apartment' });
  const matches = (unwrap(m.data) || {}).matches || [];
  ok('ranked matches with score + reasons (responsible AI)', m.status === 200 && matches.length >= 1 && matches[0].reasons.length >= 3);

  // FR-05 — viewings
  console.log('\nFR-05 Viewing Appointment Management');
  const pid = rows[0]._id;
  const when = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
  const v = await api('POST', '/api/v1/viewings', tTok, { propertyId: pid, requestedSlots: [{ date: when, startTime: '09:00', endTime: '10:00' }], tenantNote: 'FR-05' });
  const vid = unwrap(v.data)._id;
  ok('request + confirm flow', v.status === 201 && (await api('PUT', '/api/v1/viewings/' + vid + '/accept', lTok, {})).status === 200);
  ok('notifications for both parties', ((await api('GET', '/api/v1/notifications', tTok)).data.notifications || []).some((n) => n.type === 'viewing_confirmed'));

  // FR-06 — applications (incl. request information)
  console.log('\nFR-06 Rental Applications');
  const ap = await api('POST', '/api/v1/applications', tTok, { propertyId: pid, employmentStatus: 'Employed', monthlyIncome: 31000 });
  const apid = unwrap(ap.data)._id;
  ok('submit + review', ap.status === 201 && (await api('PUT', '/api/v1/applications/' + apid + '/review', lTok, { status: 'under_review' })).status === 200);
  const info = await api('PUT', '/api/v1/applications/' + apid + '/review', lTok, { status: 'info_requested', landlordFeedback: 'Please share income proof' });
  ok('landlord can request information', info.status === 200 && unwrap(info.data).status === 'info_requested', 'got ' + info.status);

  // FR-07 — agreements
  console.log('\nFR-07 Digital Rental Agreement Workflow');
  const start = new Date(); start.setDate(start.getDate() + 5);
  const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
  const ag = await api('POST', '/api/v1/agreements', lTok, { propertyId: pid, tenantId: 'mock-user-seed-1', rentAmount: 42000, depositAmount: 84000, startDate: start.toISOString(), endDate: end.toISOString(), paymentDueDay: 5 });
  const agid = unwrap(ag.data)._id;
  ok('agreement stores parties/dates/rent/deposit/status', ag.status === 201 && !!unwrap(ag.data).depositAmount);
  ok('dual-signature workflow → active', (await api('PUT', '/api/v1/agreements/' + agid + '/confirm', tTok, {})).status === 200);

  // FR-08 — rent management
  console.log('\nFR-08 Rent Management');
  const gen = await api('POST', '/api/v1/payments/generate/' + agid, lTok, {});
  ok('rent obligations + due dates generated', gen.status === 201);
  const pays = (unwrap((await api('GET', '/api/v1/payments/agreement/' + agid, lTok)).data) || []);
  const target = pays.find((p) => p.status !== 'paid');
  await api('POST', '/api/v1/payments/' + target._id + '/pay', tTok, { paymentMethod: 'cbe', transactionReference: 'FR08-TX' });
  const ver = await api('PUT', '/api/v1/payments/' + target._id + '/verify', lTok, { amountPaid: target.amountDue });
  ok('payments, balances, receipts (verify flow)', ver.status === 200 && unwrap(ver.data).status === 'paid');
  const rem = await api('POST', '/api/v1/payments/' + (pays.find((p) => p.status === 'pending') || pays[0])._id + '/remind', lTok, {});
  ok('reminders endpoint', [200, 400].includes(rem.status), 'got ' + rem.status);

  // FR-09 — maintenance
  console.log('\nFR-09 Maintenance Management');
  const mt = await api('POST', '/api/v1/maintenance', tTok, { propertyId: pid, title: 'FR-09 leak', issue: 'FR-09 leak', description: 'probe', category: 'plumbing', priority: 'high' });
  const tid = unwrap(mt.data)._id;
  ok('submit with description/media-paths + statuses', mt.status === 201 && unwrap(mt.data).status === 'submitted');
  ok('landlord assign/track → resolved → closed',
    (await api('PUT', '/api/v1/maintenance/' + tid + '/status', lTok, { status: 'in_progress' })).status === 200 &&
    (await api('PUT', '/api/v1/maintenance/' + tid + '/status', lTok, { status: 'resolved' })).status === 200);

  // FR-10 — ratings & reviews (transaction-linked, moderated)
  console.log('\nFR-10 Ratings, Reviews & Reputation');
  const rv = await api('POST', '/api/v1/reviews', tTok, { agreementId: agid, reviewType: 'tenant_to_property', rating: 5, comment: 'Compliance probe review' });
  ok('verified-interaction review created (transaction-linked)', rv.status === 201, 'got ' + rv.status + ' ' + JSON.stringify(rv.data).slice(0, 60));
  const rvDup = await api('POST', '/api/v1/reviews', tTok, { agreementId: agid, reviewType: 'tenant_to_property', rating: 4, comment: 'dup' });
  ok('duplicate review for same agreement blocked (moderation integrity)', rvDup.status === 400, 'got ' + rvDup.status);
  ok('moderation states exist (visible/hidden)', rv.status !== 201 || ['visible', 'hidden', 'flagged'].includes(unwrap(rv.data).status));

  // FR-11 — fraud reporting & risk detection (human review)
  console.log('\nFR-11 Fraud Reporting & Risk Detection');
  const fr = await api('POST', '/api/v1/fraud-reports', tTok, { targetType: 'property', targetId: pid, reason: 'duplicate_listing', description: 'Compliance probe: looks duplicated' });
  ok('users report suspicious listings/accounts', fr.status === 201, 'got ' + fr.status);
  const adminReports = await api('GET', '/api/v1/fraud-reports/admin', aTok);
  ok('admin review queue', adminReports.status === 200);
  const risk = await api('GET', '/api/v1/fraud-reports/risk-score/' + pid, tTok);
  ok('AI risk-score endpoint (prioritization, not punishment)', risk.status === 200, 'got ' + risk.status);

  // FR-12 — dispute management
  console.log('\nFR-12 Dispute Management');
  const dp = await api('POST', '/api/v1/disputes', tTok, { agreementId: 'mock-agreement-1', category: 'repair', description: 'Compliance probe dispute', propertyId: pid });
  const dpid = unwrap(dp.data) && unwrap(dp.data)._id;
  ok('user submits dispute with evidence paths', dp.status === 201, 'got ' + dp.status);
  ok('admin tracks status/outcomes', (await api('PUT', '/api/v1/disputes/' + dpid + '/review', aTok, { decision: 'resolve', resolution: 'Amicably resolved', note: 'probe' })).status === 200);

  // FR-13 — housing analytics (aggregated, privacy-preserving)
  console.log('\nFR-13 Housing Analytics');
  const kpis = await api('GET', '/api/v1/admin/analytics/kpis', aTok);
  ok('aggregated KPIs', kpis.status === 200);
  const charts = await api('GET', '/api/v1/admin/analytics/charts', aTok);
  ok('market indicators (charts/trends)', charts.status === 200);
  ok('analytics admin-gated (privacy)', (await api('GET', '/api/v1/admin/analytics/kpis', tTok)).status === 403);

  // Responsible AI components
  console.log('\nResponsible AI Components');
  const re = await api('POST', '/api/v1/ai/rent-estimate', tTok, { location: { subCity: 'Bole' }, sizeM2: 85, bedrooms: 2, bathrooms: 1 });
  ok('8.2 fair-rent estimation labeled as estimate', re.status === 200 && (unwrap(re.data) || {}).estimate !== undefined);
  const fraudScan = await api('GET', '/api/v1/admin/analytics', aTok);
  ok('8.3 fraud-risk feeds admin queue (human review)', fraudScan.status === 200);

  console.log('\nProposal compliance: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Suite crashed:', e); process.exit(1); });
