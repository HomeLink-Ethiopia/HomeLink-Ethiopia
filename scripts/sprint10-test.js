/* eslint-disable */
// Sprint 10 API verification — run: node scripts/sprint10-test.js
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
  try { data = await res.json(); } catch { /* html error page */ }
  return { status: res.status, data };
}

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${extra ? ' — ' + JSON.stringify(extra).slice(0, 200) : ''}`); }
}

async function login(email) {
  const r = await api('POST', '/api/auth/login', { body: { email, password: 'Password123!' } });
  if (!r.data || !r.data.token) throw new Error('login failed: ' + JSON.stringify(r.data));
  return r.data.token;
}

(async () => {
  // ── Logins ──
  const tenant = await login('dev.tenant@homelink.test');
  const landlord = await login('dev.landlord@homelink.test');
  const admin = await login('dev.admin@homelink.test');
  check('logins (tenant/landlord/admin)', !!tenant && !!landlord && !!admin);

  // ── Ratings: guards ──
  // agreement-3 (Executive 1BR, tenant=dev tenant) is unreviewed — use it for creates.
  let r = await api('POST', '/api/v1/reviews', {
    token: tenant,
    body: { agreementId: 'mock-agreement-3', reviewType: 'tenant_to_property', propertyId: '66d1f801e12a4b001a333333', revieweeId: 'mock-landlord-1', rating: 5, comment: 'Great stay, clean and as advertised.' },
  });
  check('create review (201)', r.status === 201, r);

  r = await api('POST', '/api/v1/reviews', {
    token: tenant,
    body: { agreementId: 'mock-agreement-3', reviewType: 'tenant_to_property', rating: 4, comment: 'dup' },
  });
  check('duplicate review blocked (400)', r.status === 400, r);

  r = await api('POST', '/api/v1/reviews', {
    token: tenant,
    body: { agreementId: 'mock-agreement-3', reviewType: 'tenant_to_property', revieweeId: 'mock-user-seed-1', rating: 5, comment: 'self' },
  });
  check('self-review blocked (400)', r.status === 400, r);

  r = await api('POST', '/api/v1/reviews', {
    token: tenant,
    body: { agreementId: 'mock-agreement-9', reviewType: 'tenant_to_property', rating: 5, comment: 'unknown agreement' },
  });
  check('unknown agreement blocked (404)', r.status === 404, r);

  r = await api('POST', '/api/v1/reviews', {
    token: tenant,
    body: { agreementId: 'mock-agreement-2', reviewType: 'tenant_to_property', rating: 5, comment: 'not my agreement' },
  });
  check('unauthorized reviewer blocked (403)', r.status === 403, r);

  r = await api('POST', '/api/v1/reviews', {
    token: tenant,
    body: { agreementId: 'mock-agreement-1', reviewType: 'landlord_to_tenant', rating: 5 },
  });
  check('tenant cannot post landlord_to_tenant (403)', r.status === 403, r);

  r = await api('POST', '/api/v1/reviews', {
    token: landlord,
    body: { agreementId: 'mock-agreement-1', reviewType: 'tenant_to_property', rating: 5 },
  });
  check('landlord cannot post tenant_to_property (403)', r.status === 403, r);

  r = await api('GET', '/api/v1/reviews/mine', { token: tenant });
  check('GET /reviews/mine lists the new review', r.status === 200 && (r.data.data || []).some((x) => x.comment && x.comment.includes('Great stay')), r.data && r.data.data && r.data.data.length);

  // ── Landlord rate-tenant ──
  r = await api('POST', '/api/v1/reviews/rate-tenant', {
    token: landlord,
    body: { agreementId: 'mock-agreement-3', rating: 5, comment: 'Punctual with rent.' },
  });
  check('landlord rates tenant (201)', r.status === 201, r);

  r = await api('POST', '/api/v1/reviews/rate-tenant', {
    token: landlord,
    body: { agreementId: 'mock-agreement-3', rating: 4, comment: 'again' },
  });
  check('duplicate tenant rating blocked (400)', r.status === 400, r);

  r = await api('POST', '/api/v1/reviews/rate-tenant', {
    token: landlord,
    body: { agreementId: 'mock-agreement-9', rating: 4 },
  });
  check('rate-tenant unknown agreement (404)', r.status === 404, r);

  r = await api('POST', '/api/v1/reviews/rate-tenant', { token: tenant, body: { agreementId: 'mock-agreement-2', rating: 4 } });
  check('tenant cannot rate-tenant (403)', r.status === 403, r);

  r = await api('GET', '/api/v1/reviews/my-properties', { token: landlord });
  const propReviews = r.data.data || [];
  check('landlord sees property reviews (>=3, no landlord_to_tenant)', r.status === 200 && propReviews.length >= 3 && propReviews.every((x) => x.reviewType !== 'landlord_to_tenant'), propReviews.length);
  check('my-properties enriched with reviewerName/propertyTitle', propReviews.every((x) => typeof x.reviewerName === 'string' && typeof x.propertyTitle === 'string'), propReviews[0]);

  r = await api('GET', '/api/v1/agreements/landlord', { token: landlord });
  check('landlord agreements list has 2 demo rows', r.status === 200 && (r.data.data || []).length >= 2, r.data && r.data.data && r.data.data.length);

  r = await api('GET', '/api/v1/agreements/my', { token: tenant });
  check('tenant agreements list has rows (dev tenant sees demo)', r.status === 200 && (r.data.data || []).length >= 2, r.data && r.data.data && r.data.data.length);

  // Agreement-derived reviewee/property when the client omits them
  r = await api('GET', '/api/v1/reviews/mine', { token: tenant });
  const mineNew = (r.data.data || []).find((x) => x.agreementId === 'mock-agreement-3');
  check('review reviewee/property derived from agreement', mineNew && String(mineNew.revieweeId) === 'mock-landlord-1' && String(mineNew.propertyId) === '66d1f801e12a4b001a333333', mineNew);

  // ── Fraud reporting ──
  r = await api('POST', '/api/v1/fraud-reports', {
    token: tenant,
    body: { propertyId: '66d1f801e12a4b001a333333', category: 'fake_property', description: 'The photos do not match the actual apartment at all.' },
  });
  check('fraud report filed (201 + risk)', r.status === 201 && r.data.riskLevel, r);

  r = await api('POST', '/api/v1/fraud-reports', {
    token: tenant,
    body: { propertyId: '66d1f801e12a4b001a333333', category: 'scam', description: 'They asked for a deposit before signing anything.' },
  });
  check('second report scores HIGH with escalation signal', r.status === 201 && r.data.riskLevel === 'HIGH' && (r.data.signals || []).some((s) => s.includes('multiple_historical_reports')), r);

  r = await api('GET', '/api/v1/fraud-reports', { token: admin });
  const shaped = (r.data.data || [])[0];
  check('admin fraud list (shaped: reportType/riskScore/reporterId)', r.status === 200 && shaped && typeof shaped.reportType === 'string' && typeof shaped.riskScore === 'number' && !!shaped.reporterId, shaped && { reportType: shaped.reportType, riskScore: shaped.riskScore });

  const target = (r.data.data || []).find((x) => x.status === 'open') || (r.data.data || [])[0];
  r = await api('PUT', `/api/v1/fraud-reports/${target._id}/review`, { token: admin, body: { status: 'under_review', adminNotes: 'Investigating with the landlord.' } });
  check('admin review action (200)', r.status === 200, r);

  r = await api('GET', '/api/v1/fraud-reports', { token: tenant });
  check('tenant cannot list fraud reports (403)', r.status === 403, r.status);

  // risk-score endpoint
  r = await api('GET', '/api/v1/fraud-reports/risk-score/66d1f801e12a4b001a333333', { token: admin });
  check('risk-score endpoint returns score/level', r.status === 200 && r.data.data && typeof r.data.data.score === 'number' && !!r.data.data.level, r.data);

  // ── The booking bug: create → appears in dashboards ──
  r = await api('POST', '/api/v1/viewings', {
    token: tenant,
    body: { propertyId: '66d1f801e12a4b001a222222', requestedSlots: [{ date: '2026-10-05', startTime: '09:00', endTime: '10:00' }], tenantNote: 'Sprint 10 UI test booking' },
  });
  check('book viewing (201)', r.status === 201, r);

  r = await api('GET', '/api/v1/viewings/my', { token: tenant });
  check('booking appears in /viewings/my', r.status === 200 && (r.data.data || []).some((v) => v.tenantNote === 'Sprint 10 UI test booking'), (r.data.data || []).length);

  r = await api('GET', '/api/v1/viewings/my-requests', { token: tenant });
  check('booking appears in /viewings/my-requests (team route)', r.status === 200 && Array.isArray(r.data) && r.data.some((v) => v.tenantNote === 'Sprint 10 UI test booking'), Array.isArray(r.data) && r.data.length);

  r = await api('GET', '/api/v1/viewings/landlord', { token: landlord });
  check('booking appears in landlord viewings', r.status === 200 && (r.data.data || []).some((v) => v.tenantNote === 'Sprint 10 UI test booking'), (r.data.data || []).length);

  // applications
  r = await api('POST', '/api/v1/applications', {
    token: tenant,
    body: { propertyId: '66d1f801e12a4b001a111111', employmentStatus: 'Employed', monthlyIncome: 30000, note: 'Sprint 10 application test' },
  });
  check('apply (201)', r.status === 201, r);

  r = await api('GET', '/api/v1/applications/my', { token: tenant });
  check('application appears in /applications/my', r.status === 200 && (r.data.data || []).some((a) => a.note === 'Sprint 10 application test'), (r.data.data || []).length);

  r = await api('GET', '/api/v1/applications/landlord', { token: landlord });
  check('application appears in /applications/landlord', r.status === 200 && (r.data.data || []).some((a) => a.note === 'Sprint 10 application test'), (r.data.data || []).length);

  // maintenance
  r = await api('POST', '/api/v1/maintenance', {
    token: tenant,
    body: { propertyId: '66d1f801e12a4b001a111111', issue: 'Sprint 10 test leak', description: 'Testing maintenance ticket creation' },
  });
  check('create maintenance ticket (201)', r.status === 201, r);

  r = await api('GET', '/api/v1/maintenance/my', { token: tenant });
  check('ticket appears in /maintenance/my', r.status === 200 && (r.data.data || []).some((t) => t.issue === 'Sprint 10 test leak'), (r.data.data || []).length);

  r = await api('GET', '/api/v1/maintenance/landlord', { token: landlord });
  check('ticket appears in /maintenance/landlord', r.status === 200 && (r.data.data || []).some((t) => t.issue === 'Sprint 10 test leak'), (r.data.data || []).length);

  // tenants page
  r = await api('GET', '/api/v1/agreements/landlord/tenants', { token: landlord });
  check('landlord tenants list groups by tenant', r.status === 200 && (r.data.data || []).length >= 2 && (r.data.data || []).every((t) => Array.isArray(t.properties)), (r.data.data || []).length);

  // admin properties/all
  r = await api('GET', '/api/v1/properties/all', { token: admin });
  check('admin /properties/all (4 listings)', r.status === 200 && (r.data.data || []).length >= 4, r.data && r.data.data && r.data.data.length);

  // landlord reply (PUT)
  r = await api('GET', '/api/v1/reviews/my-properties', { token: landlord });
  const firstReview = (r.data.data || []).find((x) => !x.landlordReply);
  if (firstReview) {
    const rr = await api('PUT', `/api/v1/reviews/${firstReview._id}/reply`, { token: landlord, body: { reply: 'Thank you for the feedback!' } });
    check('landlord reply (PUT /reviews/:id/reply)', rr.status === 200, rr);
  } else {
    check('landlord reply — all reviews already replied (skip)', true);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
