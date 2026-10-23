/* eslint-disable */
// Sprint 11 API verification — run: node scripts/sprint11-test.js
const BASE = 'http://localhost:5000';

async function api(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try { data = await res.json(); } catch { /* html */ }
  return { status: res.status, data };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 180) : ''}`); }
}

async function login(email) {
  const r = await api('POST', '/api/auth/login', { body: { email, password: 'Password123!' } });
  if (!r.data || !r.data.token) throw new Error('login failed ' + email);
  return r.data.token;
}

(async () => {
  const tenant = await login('dev.tenant@homelink.test');
  const landlord = await login('dev.landlord@homelink.test');
  const admin = await login('dev.admin@homelink.test');
  check('logins', !!tenant && !!landlord && !!admin);

  // ── Dispute creation with evidence (multipart) ──
  const fd = new FormData();
  fd.append('reason', 'property_condition');
  fd.append('description', 'Sprint 11 test — radiator leaked for two weeks and the landlord has not responded.');
  fd.append('evidence', new File(['leak photo bytes'], 'leak-photo.jpg', { type: 'image/jpeg' }));
  let r = await api('POST', '/api/v1/disputes', { token: tenant, form: fd });
  check('create dispute with evidence (201)', r.status === 201, r.data);
  const disputeId = r.data?.data?._id;
  check('dispute stores evidence file names', Array.isArray(r.data?.data?.evidence) && r.data.data.evidence.includes('leak-photo.jpg'), r.data?.data?.evidence);
  check('dispute resolved counterparty (landlord)', !!r.data?.data?.againstUserId, r.data?.data?.againstUserId);

  // create without description → 400
  const fd2 = new FormData();
  fd2.append('reason', 'other');
  r = await api('POST', '/api/v1/disputes', { token: tenant, form: fd2 });
  check('dispute without description blocked (400)', r.status === 400, r.status);

  // unknown agreement → 404
  const fd3 = new FormData();
  fd3.append('reason', 'other');
  fd3.append('agreementId', 'mock-agreement-999');
  fd3.append('description', 'x');
  r = await api('POST', '/api/v1/disputes', { token: tenant, form: fd3 });
  check('dispute with unknown agreement (404)', r.status === 404, r.status);

  // property derived from agreement
  const fd4 = new FormData();
  fd4.append('agreementId', 'mock-agreement-3');
  fd4.append('reason', 'payment_issue');
  fd4.append('description', 'Sprint 11 — payment allocation question.');
  r = await api('POST', '/api/v1/disputes', { token: tenant, form: fd4 });
  check('dispute derives property from agreement', r.status === 201 && r.data?.data?.propertyId?._id === '66d1f801e12a4b001a333333', r.data?.data?.propertyId);

  // ── My disputes (both sides) ──
  r = await api('GET', '/api/v1/disputes/my', { token: tenant });
  check('tenant sees own disputes', r.status === 200 && (r.data.data || []).length >= 2, (r.data.data || []).length);
  r = await api('GET', '/api/v1/disputes/my', { token: landlord });
  check('landlord sees disputes against them', r.status === 200 && (r.data.data || []).length >= 2, (r.data.data || []).length);

  // ── Messages / thread ──
  r = await api('POST', `/api/v1/disputes/${disputeId}/messages`, { token: tenant, body: { text: 'Adding the plumber invoice tomorrow.' } });
  check('tenant adds message (201)', r.status === 201, r.data);
  r = await api('GET', '/api/v1/disputes/my', { token: tenant });
  const myD = (r.data.data || []).find((d) => d._id === disputeId);
  check('message shows in thread', myD && (myD.thread || []).some((m) => (m.text || '').includes('plumber invoice')), myD && myD.thread);

  // unauthorized message → 403
  r = await api('POST', `/api/v1/disputes/${disputeId}/messages`, { token: admin, body: { isAdminNote: false } });
  // admin CAN post — use a different id for unauthorized: create 3rd-party? Use admin on own? admin allowed. Test with fraud-report-style unknown id instead.
  r = await api('POST', '/api/v1/disputes/does-not-exist/messages', { token: tenant, body: { text: 'x' } });
  check('message on unknown dispute (404)', r.status === 404, r.status);

  // ── Admin: investigate / request evidence ──
  r = await api('PUT', `/api/v1/disputes/${disputeId}/review`, { token: admin, body: { decision: 'investigate' } });
  check('admin investigate → under_review', r.status === 200 && r.data?.data?.status === 'under_review', r.data?.data?.status);

  r = await api('PUT', `/api/v1/disputes/${disputeId}/review`, { token: admin, body: { decision: 'request_evidence', note: 'Please attach the plumber report and payment receipts.' } });
  check('admin request evidence (200)', r.status === 200, r.data);

  // resolve without reason → 400
  r = await api('PUT', `/api/v1/disputes/${disputeId}/review`, { token: admin, body: { decision: 'resolve' } });
  check('resolve without reason blocked (400)', r.status === 400, r.status);

  r = await api('PUT', `/api/v1/disputes/${disputeId}/review`, { token: admin, body: { decision: 'resolve', resolution: 'Landlord refunded 50% of the deposit; both parties agreed.' } });
  check('admin resolve dispute (200)', r.status === 200 && r.data?.data?.status === 'resolved' && r.data?.data?.outcome?.includes('50%'), r.data?.data?.status);

  // non-admin cannot review
  r = await api('PUT', `/api/v1/disputes/${disputeId}/review`, { token: tenant, body: { decision: 'resolve', resolution: 'self-decide' } });
  check('tenant cannot review disputes (403)', r.status === 403, r.status);

  // ── Withdraw ──
  const fd5 = new FormData();
  fd5.append('reason', 'other');
  fd5.append('description', 'Sprint 11 — will withdraw this one.');
  r = await api('POST', '/api/v1/disputes', { token: tenant, form: fd5 });
  const wdId = r.data?.data?._id;
  r = await api('POST', `/api/v1/disputes/${wdId}/withdraw`, { token: tenant });
  check('filer withdraws own dispute', r.status === 200 && r.data?.data?.status === 'withdrawn', r.data?.data?.status);
  r = await api('POST', `/api/v1/disputes/${wdId}/withdraw`, { token: tenant });
  check('cannot withdraw a decided dispute (400)', r.status === 400, r.status);

  // landlord cannot withdraw tenant's dispute
  const fd6 = new FormData();
  fd6.append('reason', 'other');
  fd6.append('description', 'Sprint 11 — withdrawal guard test.');
  r = await api('POST', '/api/v1/disputes', { token: tenant, form: fd6 });
  const wd2 = r.data?.data?._id;
  r = await api('POST', `/api/v1/disputes/${wd2}/withdraw`, { token: landlord });
  check('only filer can withdraw (403)', r.status === 403, r.status);

  // ── Admin lists ──
  r = await api('GET', '/api/v1/disputes', { token: admin });
  check('admin lists all disputes', r.status === 200 && (r.data.data || []).length >= 4, (r.data.data || []).length);
  r = await api('GET', '/api/v1/disputes', { token: tenant });
  check('tenant cannot list all disputes (403)', r.status === 403, r.status);

  r = await api('GET', '/api/v1/admin/suspicious/accounts', { token: admin });
  check('admin users/suspicious list', r.status === 200 && (r.data.data || []).length >= 3 && (r.data.data || []).every((u) => typeof u.reportsAgainst === 'number'), (r.data.data || []).length);

  // ── Suspend / reinstate (audit-logged) ──
  r = await api('GET', '/api/v1/admin/suspicious/accounts', { token: admin });
  const victim = (r.data.data || []).find((u) => u.role === 'tenant' && u._id !== 'mock-admin-1');
  r = await api('PUT', `/api/v1/admin/users/${victim._id}/suspend`, { token: admin, body: { suspend: true, reason: 'Sprint 11 test suspension' } });
  check('admin suspends user (200)', r.status === 200, r.data);
  r = await api('GET', '/api/v1/admin/suspicious/accounts', { token: admin });
  check('suspension reflected (isActive false)', (r.data.data || []).find((u) => u._id === victim._id)?.isActive === false);
  r = await api('PUT', `/api/v1/admin/users/${victim._id}/suspend`, { token: admin, body: { suspend: false, reason: 'Reinstated' } });
  check('admin reinstates user (200)', r.status === 200, r.data);
  r = await api('PUT', `/api/v1/admin/users/${victim._id}/suspend`, { token: tenant, body: { suspend: true, reason: 'x' } });
  check('tenant cannot suspend (403)', r.status === 403, r.status);

  // ── Verification workbench (mock) ──
  // Make the test repeatable: file a fresh property verification first.
  { const { execSync } = require('child_process'); try { execSync('node scripts/sprint11-reset.js', { stdio: 'ignore' }); } catch { /* optional */ } }
  r = await api('GET', '/api/v1/verification/pending', { token: admin });
  const pendingLandlords = r.data?.data?.landlords || [];
  const pendingProps = r.data?.data?.properties || [];
  check('verification pending returns {landlords, properties}', r.status === 200 && Array.isArray(pendingLandlords) && Array.isArray(pendingProps), r.status);

  check('seeded second landlord present (Mikias)', pendingLandlords.some((l) => l._id === 'mock-landlord-2'), pendingLandlords.map((l) => l._id));
  // pick the newest 'submitted' request (the reset helper files one each run)
  const pv = (pendingProps || []).slice().reverse().find((p) => p.status === 'submitted') || { _id: 'mock-propver-1' };
  r = await api('GET', '/api/v1/verification/pending', { token: tenant });
  check('tenant cannot access verification queue (403)', r.status === 403, r.status);

  // approve the property verification → audit
  r = await api('PUT', `/api/v1/verification/${pv._id}/review`, { token: admin, body: { status: 'verified', reviewNotes: 'Ownership deed checks out.' } });
  check('admin verifies property (200)', r.status === 200 && r.data?.data?.status === 'verified', r.data);
  r = await api('PUT', `/api/v1/verification/${pv._id}/review`, { token: admin, body: { status: 'rejected' } });
  check('already-decided verification blocked (400)', r.status === 400, r.status);

  // landlord review approve
  r = await api('PUT', `/api/v1/verification/landlord/mock-landlord-2/review`, { token: admin, body: { status: 'verified', reviewNotes: 'ID and lease verified.' } });
  check('admin approves landlord (200)', r.status === 200 && r.data?.data?.status === 'verified', r.data);

  // ── Audit trail — every action above must be recorded ──
  r = await api('GET', '/api/v1/audit-logs', { token: admin });
  const logs = r.data?.data || [];
  check('audit trail has entries', r.status === 200 && logs.length >= 4, logs.length);
  const actions = logs.map((l) => l.action);
  check('audit: dispute actions recorded', actions.some((a) => a.startsWith('dispute.')), actions.slice(0, 6));
  check('audit: suspension recorded', actions.includes('user.suspend') && actions.includes('user.unsuspend'), actions.slice(0, 8));
  check('audit: property verification recorded', actions.includes('property.verified'), actions.slice(0, 8));
  check('audit: landlord approval recorded', actions.includes('landlord.verified'), actions.slice(0, 8));
  const sample = logs.find((l) => l.action === 'landlord.verified');
  check('audit entry has actor/time/target/reason (Admin X approved Y at T)', sample && sample.actorName && sample.createdAt && sample.targetLabel && typeof sample.reason === 'string', sample && { actorName: sample.actorName, action: sample.action, target: sample.targetLabel, at: sample.createdAt });

  r = await api('GET', '/api/v1/audit-logs', { token: tenant });
  check('tenant cannot read audit logs (403)', r.status === 403, r.status);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
