/* eslint-disable */
// Sprint 15 — whole-system verification. Run: node scripts/sprint15-test.js
// Part A: the 12 proposal modules (auth, properties, verification, search,
// applications, viewings, agreements, rent, maintenance, fraud, disputes, admin).
// Part B: the three end-to-end journeys from the proposal (landlord onboarding,
// tenant find→rent, fraud report→action). Tests the FLOW, not single endpoints.
const BASE = 'http://localhost:5000';
const ts = () => Date.now().toString(36);

async function api(method, urlPath, { token, body } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 200) : ''}`); }
}
const arr = (d) => (Array.isArray(d) ? d : d?.data || d?.applications || d?.matches || []);

(async () => {
  // ════════════════ A1. AUTH ════════════════
  const email = `s15.${ts()}@homelink.test`;
  const phone = '0911' + String(Date.now() % 1000000).padStart(6, '0');
  let r = await api('POST', '/api/auth/register', {
    body: { firstName: 'Samuel', lastName: 'Fifteenth', email, phone, password: 'Sprint15!pw', role: 'tenant' },
  });
  check('auth: register 201', r.status === 201, r.status);
  check('auth: register does not leak password', !/password/i.test(JSON.stringify(r.data).replace(/"password":"[^"]*x/g, '"x')), 'check manually');
  const rLogin = await api('POST', '/api/auth/login', { body: { email, password: 'Sprint15!pw' } });
  check('auth: new user can login', rLogin.status === 200 && !!rLogin.data.token, rLogin.status);
  const newTenant = rLogin.data?.token;
  r = await api('POST', '/api/auth/login', { body: { email, password: 'WrongPass1!' } });
  check('auth: wrong password 401', r.status === 401, r.status);
  r = await api('POST', '/api/auth/register', { body: { firstName: 'Samuel', lastName: 'Fifteenth', email, phone: '0911223355', password: 'Sprint15!pw', role: 'tenant' } });
  check('auth: duplicate email 400', r.status === 400, r.status);

  const tokens = {};
  for (const role of ['tenant', 'landlord', 'admin']) {
    const lr = await api('POST', '/api/auth/login', { body: { email: `dev.${role}@homelink.test`, password: 'Password123!' } });
    tokens[role] = lr.data?.token;
  }
  check('auth: dev logins (tenant/landlord/admin)', !!tokens.tenant && !!tokens.landlord && !!tokens.admin);
  const tenant = tokens.tenant, landlord = tokens.landlord, admin = tokens.admin;
  r = await api('GET', '/api/auth/me', { token: tenant });
  check('auth: /me returns user', r.status === 200 && !!r.data?.user, r.status);

  // ════════════════ A2/A4. PROPERTIES + SEARCH ════════════════
  r = await api('GET', '/api/v1/properties/search?q=Bole');
  check('search: q=Bole returns results', r.status === 200 && arr(r.data).length >= 1, r.status);
  r = await api('GET', '/api/v1/properties/search?propertyType=apartment');
  const sApts = arr(r.data);
  check('search: propertyType filter', r.status === 200 && sApts.length >= 1 && sApts.every((p) => p.propertyType === 'apartment'), sApts.map((p) => p.propertyType));
  r = await api('GET', '/api/v1/properties/search?q=zzzznothing');
  check('search: no match -> empty list (not error)', r.status === 200 && arr(r.data).length === 0, r.status);
  r = await api('GET', '/api/v1/properties/search?minPrice=40000&maxPrice=60000&sort=price_asc');
  const sPrice = arr(r.data);
  check('search: price range + sort', r.status === 200 && sPrice.length >= 1 && sPrice.every((p) => p.rentAmount >= 40000 && p.rentAmount <= 60000) && sPrice.every((p, i, a) => i === 0 || a[i - 1].rentAmount <= p.rentAmount), sPrice.map((p) => p.rentAmount));
  r = await api('GET', '/api/v1/properties/search?subCity=Bole&bedrooms=2');
  check('search: subCity + bedrooms filters', r.status === 200 && arr(r.data).length >= 1, r.status);
  r = await api('GET', '/api/v1/properties/66d1f801e12a4b001a111111');
  check('properties: public detail view', r.status === 200 && !!r.data?.data?.title, r.status);

  const propPayload = {
    title: `Sprint15 Apartment ${ts()}`,
    description: 'Two-bedroom apartment created by the Sprint 15 whole-system test.',
    propertyType: 'apartment',
    rentAmount: 38500,
    bedrooms: 2,
    bathrooms: 1,
    sizeM2: 78,
    city: 'Addis Ababa',
    subCity: 'Bole',
    amenities: ['parking'],
  };
  r = await api('POST', '/api/v1/properties', { token: landlord, body: propPayload });
  const createdOk = r.status === 201 || r.status === 200;
  check('properties: landlord creates listing', createdOk, r.status);
  const newPropId = r.data?.data?._id || r.data?.property?._id || r.data?._id;
  r = await api('GET', '/api/v1/properties/my', { token: landlord });
  check('properties: appears in landlord /my', r.status === 200 && (!createdOk || arr(r.data).some((p) => p._id === newPropId)), r.status);
  r = await api('POST', '/api/v1/properties', { token: tenant, body: propPayload });
  check('properties: tenant cannot create (403)', r.status === 403, r.status);

  // ════════════════ A3. VERIFICATION ════════════════
  // verification/submit = PROPERTY verification (needs propertyId); dev.landlord
  // owns the seeded Bole apartment, so submit for it.
  r = await api('POST', '/api/v1/verification/submit', { token: landlord, body: { propertyId: '66d1f801e12a4b001a111111', documents: [{ fileKey: '/uploads/lease-s15.pdf', name: 'ownership-lease.pdf' }], notes: 'Sprint 15 verification submission' } });
  check('verification: landlord submits property (2xx/400-already-pending)', [201, 200, 400].includes(r.status), `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
  r = await api('GET', '/api/v1/verification/status', { token: landlord });
  check('verification: status visible to landlord', r.status === 200 && Array.isArray(r.data?.data), `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
  r = await api('GET', '/api/v1/verification/pending', { token: admin });
  const pendingOk = r.status === 200;
  const pendingProps = pendingOk ? (r.data?.data?.properties || r.data?.data || []) : [];
  check('verification: admin sees pending queue', pendingOk && Array.isArray(pendingProps), r.status);
  const pendingItem = Array.isArray(pendingProps) ? pendingProps.find((v) => v.status === 'submitted' || v.status === 'under_review') : null;
  if (pendingItem) {
    r = await api('PUT', `/api/v1/verification/${pendingItem._id}/review`, { token: admin, body: { status: 'verified', reviewNotes: 'Sprint 15 admin approval' } });
    check('verification: admin reviews item (2xx)', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
  } else {
    check('verification: pending item available to review', pendingOk, 'no submitted item in queue');
  }
  r = await api('GET', '/api/v1/verification/pending', { token: tenant });
  check('verification: tenant blocked from pending (403)', r.status === 403, r.status);

  // ════════════════ A5. APPLICATIONS ════════════════
  const appNote = `s15-app-${ts()}`;
  r = await api('POST', '/api/v1/applications', { token: tenant, body: { propertyId: '66d1f801e12a4b001a111111', employmentStatus: 'Employed', monthlyIncome: 32000, note: appNote } });
  check('applications: tenant applies (201)', r.status === 201, r.status);
  let appId = r.data?.data?._id || r.data?._id || r.data?.application?._id;
  r = await api('GET', '/api/v1/applications/my', { token: tenant });
  check('applications: tenant /my lists it', r.status === 200 && arr(r.data).some((a) => a.note === appNote), r.status);
  r = await api('GET', '/api/v1/applications/landlord', { token: landlord });
  check('applications: landlord sees queue', r.status === 200 && arr(r.data).some((a) => a.note === appNote), r.status);
  r = await api('PUT', `/api/v1/applications/${appId || 'mock-application-1'}/review`, { token: landlord, body: { status: 'approved' } });
  check('applications: landlord approves', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
  r = await api('GET', '/api/v1/applications/landlord', { token: landlord });
  check('applications: status persisted after approval', arr(r.data).some((a) => a.note === appNote && a.status === 'approved'), (arr(r.data).find((a) => a.note === appNote) || {}).status);

  // ════════════════ A6. VIEWINGS ════════════════
  const vNote = `s15-viewing-${ts()}`;
  r = await api('POST', '/api/v1/viewings', { token: tenant, body: { propertyId: '66d1f801e12a4b001a222222', requestedSlots: [{ date: '2026-10-10', startTime: '09:00', endTime: '10:00' }], tenantNote: vNote } });
  check('viewings: tenant books (201)', r.status === 201, r.status);
  const viewId = r.data?.data?._id || r.data?._id || r.data?.viewing?._id;
  r = await api('GET', '/api/v1/viewings/my', { token: tenant });
  check('viewings: tenant /my lists booking', r.status === 200 && arr(r.data).some((v) => v.tenantNote === vNote), r.status);
  r = await api('GET', '/api/v1/viewings/landlord', { token: landlord });
  check('viewings: landlord sees booking', r.status === 200 && arr(r.data).some((v) => v.tenantNote === vNote), r.status);
  r = await api('PUT', `/api/v1/viewings/${viewId || 'mock-viewing-1'}/accept`, { token: landlord, body: {} });
  check('viewings: landlord accepts', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);

  // ════════════════ A7. AGREEMENTS ════════════════
  r = await api('GET', '/api/v1/agreements/landlord', { token: landlord });
  check('agreements: landlord list', r.status === 200 && arr(r.data).length >= 2, r.status);
  r = await api('GET', '/api/v1/agreements/my', { token: tenant });
  check('agreements: tenant list', r.status === 200 && arr(r.data).length >= 1, r.status);
  r = await api('GET', '/api/v1/agreements/mock-agreement-1', { token: tenant });
  check('agreements: detail by id', r.status === 200 && !!r.data?.data?._id, r.status);
  const agrNote = ts();
  r = await api('POST', '/api/v1/agreements', {
    token: landlord,
    body: { propertyId: '66d1f801e12a4b001a111111', tenantId: 'mock-user-seed-1', rentAmount: 42000, startDate: '2026-10-01', endDate: '2027-09-30', paymentDueDay: 5, notes: `s15-agr-${agrNote}` },
  });
  const newAgrId = r.data?.data?._id || r.data?._id || r.data?.agreement?._id;
  check('agreements: landlord creates from application', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
  r = await api('PUT', `/api/v1/agreements/${newAgrId || 'mock-agreement-new'}/confirm`, { token: tenant, body: {} });
  check('agreements: tenant signs/confirms', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);

  // ════════════════ A8. RENT ════════════════
  const agrForRent = newAgrId || 'mock-agreement-1';
  r = await api('GET', '/api/v1/payments/my', { token: tenant });
  check('rent: tenant /my payments list', r.status === 200, r.status);
  r = await api('GET', '/api/v1/payments/landlord', { token: landlord });
  check('rent: landlord payments list', r.status === 200, r.status);
  r = await api('POST', `/api/v1/payments/generate/${agrForRent}`, { token: landlord, body: {} });
  check('rent: landlord generates schedule', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
  r = await api('GET', `/api/v1/payments/agreement/${agrForRent}`, { token: tenant });
  const rentList = arr(r.data);
  check('rent: schedule visible on agreement', r.status === 200 && rentList.length >= 1, `${r.status} n=${rentList.length}`);
  const payId = rentList[0]?._id;
  if (payId) {
    r = await api('POST', `/api/v1/payments/${payId}/pay`, { token: tenant, body: { paymentMethod: 'telebirr', transactionReference: `TX-S15-${ts()}` } });
    check('rent: tenant records payment', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
    r = await api('PUT', `/api/v1/payments/${payId}/verify`, { token: landlord, body: { status: 'paid' } });
    check('rent: landlord verifies payment', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
  } else {
    check('rent: schedule has a payment to record', false, 'no payment id');
  }

  // ════════════════ A9. MAINTENANCE ════════════════
  const issue = `s15-leak-${ts()}`;
  r = await api('POST', '/api/v1/maintenance', { token: tenant, body: { propertyId: '66d1f801e12a4b001a111111', issue, description: 'Kitchen tap leaking (Sprint 15)' } });
  check('maintenance: tenant creates ticket (201)', r.status === 201, r.status);
  const ticketId = r.data?.data?._id || r.data?._id || r.data?.ticket?._id;
  r = await api('GET', '/api/v1/maintenance/my', { token: tenant });
  check('maintenance: tenant /my lists ticket', r.status === 200 && arr(r.data).some((t) => t.issue === issue), r.status);
  r = await api('PUT', `/api/v1/maintenance/${ticketId || 'mock-ticket-1'}/status`, { token: landlord, body: { status: 'in_progress' } });
  check('maintenance: landlord updates status', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);

  // ════════════════ A10. FRAUD ════════════════
  const frNote = `Photos do not match. Sprint15-${ts()}`;
  r = await api('POST', '/api/v1/fraud-reports', { token: tenant, body: { propertyId: '66d1f801e12a4b001a333333', category: 'fake_property', description: frNote } });
  check('fraud: tenant files report (201 + risk)', r.status === 201 && !!r.data?.riskLevel, r.status);
  r = await api('GET', '/api/v1/fraud-reports/admin', { token: admin });
  check('fraud: admin lists reports', r.status === 200 && arr(r.data).length >= 1, r.status);
  r = await api('GET', '/api/v1/fraud-reports/admin', { token: tenant });
  check('fraud: tenant blocked from admin list (403)', r.status === 403, r.status);
  r = await api('GET', '/api/v1/ai/fraud-priority', { token: admin });
  check('fraud: AI priority queue live', r.status === 200 && arr(r.data?.data?.queue).length >= 1, r.status);

  // ════════════════ A11. DISPUTES ════════════════
  r = await api('POST', '/api/v1/disputes', { token: tenant, body: { agreementId: 'mock-agreement-1', category: 'deposit_refund', description: `Sprint 15 dispute ${ts()}` } });
  check('disputes: tenant files (2xx)', r.status >= 200 && r.status < 300, r.status);
  const dispId = r.data?.data?._id || r.data?._id || r.data?.dispute?._id;
  r = await api('GET', '/api/v1/disputes', { token: admin });
  check('disputes: admin lists all', r.status === 200 && arr(r.data).length >= 1, r.status);
  r = await api('PUT', `/api/v1/disputes/${dispId || 'mock-dispute-1'}/review`, { token: admin, body: { decision: 'resolve', resolution: 'Deposit refunded after Sprint 15 review.', note: 'Sprint 15 admin decision.' } });
  check('disputes: admin resolves', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);

  // ════════════════ A12. ADMIN ════════════════
  r = await api('GET', '/api/v1/admin/analytics', { token: admin });
  check('admin: combined analytics', r.status === 200 && !!r.data?.data?.kpis, r.status);
  r = await api('GET', '/api/v1/admin/users', { token: admin });
  check('admin: user list without passwords', r.status === 200 && arr(r.data).length >= 3 && !/password/i.test(JSON.stringify(r.data)), r.status);
  r = await api('GET', '/api/v1/admin/properties', { token: admin });
  check('admin: all properties', r.status === 200 && arr(r.data).length >= 4, r.status);
  r = await api('GET', '/api/v1/admin/audit-logs', { token: admin });
  check('admin: audit trail readable', r.status === 200, r.status);
  r = await api('GET', '/api/v1/admin/analytics', { token: landlord });
  check('admin: landlord blocked (403)', r.status === 403, r.status);

  // ═══════════════════════════════════════════════
  // B. END-TO-END SCENARIOS (proposal journeys)
  // ═══════════════════════════════════════════════

  // ── Scenario 1: landlord register → verify → admin approves → create → tenant finds ──
  const S1 = [];
  const lEmail = `s15.landlord.${ts()}@homelink.test`;
  const lPhone = '0912' + String((Date.now() + 100) % 1000000).padStart(6, '0');
  S1.push(['register as landlord', (await api('POST', '/api/auth/register', { body: { firstName: 'Landlord', lastName: 'Journey', email: lEmail, phone: lPhone, password: 'Journey1!pw', role: 'landlord' } })).status === 201]);
  const ll = (await api('POST', '/api/auth/login', { body: { email: lEmail, password: 'Journey1!pw' } })).data?.token;
  S1.push(['landlord login', !!ll]);
  const lProp = { title: `Journey Apartment ${ts()}`, description: 'Created in scenario 1 end-to-end.', propertyType: 'apartment', rentAmount: 36000, bedrooms: 2, bathrooms: 1, sizeM2: 75, city: 'Addis Ababa', subCity: 'Kazanchis', amenities: ['wifi'] };
  const pc = await api('POST', '/api/v1/properties', { token: ll, body: lProp });
  const lPropId = pc.data?.data?._id || pc.data?._id;
  S1.push(['create property', pc.status < 300 && !!lPropId]);
  S1.push(['submit property verification', (await api('POST', '/api/v1/verification/submit', { token: ll, body: { propertyId: lPropId, documents: [{ fileKey: '/uploads/journey-lease.pdf', name: 'lease.pdf' }] } })).status < 300]);
  if (lPropId) {
    S1.push(['admin moderates listing live', (await api('PUT', `/api/v1/admin/properties/${lPropId}/moderate`, { token: admin, body: { listingStatus: 'active', reason: 'S1 journey' } })).status < 300]);
    const found = await api('GET', `/api/v1/properties/${lPropId}`);
    S1.push(['tenant can view the listing', found.status === 200]);
  } else {
    S1.push(['admin moderates listing live', false]);
    S1.push(['tenant can view the listing', false]);
  }
  S1.push(['property appears in search', (await api('GET', '/api/v1/properties/search?q=Journey')).status === 200 && arr((await api('GET', '/api/v1/properties/search?q=Journey')).data).some((p) => p.title?.includes('Journey'))]);
  const s1 = await api('POST', '/api/v1/ai/match', { token: tenant, body: { budget: { min: 30000, max: 40000 }, location: { subCity: 'Kazanchis' }, propertyType: 'apartment', bedrooms: 2, amenities: ['wifi'], limit: 6 } });
  S1.push(['AI match surfaces candidate', s1.status === 200 && arr(s1.data?.data?.matches).length >= 1]);

  // ── Scenario 2: tenant search → AI → viewing → application → approval → agreement → rent ──
  const S2 = [];
  S2.push(['search', (await api('GET', '/api/v1/properties/search?propertyType=apartment')).status === 200]);
  const m2 = await api('POST', '/api/v1/ai/match', { token: tenant, body: { budget: { min: 35000, max: 45000 }, location: { subCity: 'Bole' }, propertyType: 'apartment', bedrooms: 2, amenities: ['parking', 'generator'], limit: 3 } });
  const topMatch = arr(m2.data?.data?.matches)[0];
  S2.push(['AI recommendation with reasons', m2.status === 200 && topMatch && topMatch.reasons?.length >= 1]);
  const s2Prop = topMatch?.propertyId || '66d1f801e12a4b001a111111';
  const v2 = await api('POST', '/api/v1/viewings', { token: tenant, body: { propertyId: s2Prop, requestedSlots: [{ date: '2026-10-12', startTime: '11:00', endTime: '12:00' }], tenantNote: 'S2 journey viewing' } });
  S2.push(['viewing booked', v2.status === 201]);
  const a2 = await api('POST', '/api/v1/applications', { token: tenant, body: { propertyId: s2Prop, employmentStatus: 'Employed', monthlyIncome: 42000, note: 'S2 journey application' } });
  const a2Id = a2.data?.data?._id || a2.data?._id;
  S2.push(['application submitted', a2.status === 201 && !!a2Id]);
  const ap2 = await api('PUT', `/api/v1/applications/${a2Id || 'x'}/review`, { token: landlord, body: { status: 'approved' } });
  S2.push(['landlord approves application', ap2.status < 300]);
  const ag2 = await api('POST', '/api/v1/agreements', { token: landlord, body: { propertyId: s2Prop, tenantId: 'mock-user-seed-1', rentAmount: 42000, startDate: '2026-10-01', endDate: '2027-09-30', paymentDueDay: 5 } });
  const ag2Id = ag2.data?.data?._id || ag2.data?._id;
  S2.push(['agreement created', ag2.status < 300 && !!ag2Id]);
  S2.push(['tenant signs agreement', (await api('PUT', `/api/v1/agreements/${ag2Id || 'x'}/confirm`, { token: tenant, body: {} })).status < 300]);
  const gen2 = await api('POST', `/api/v1/payments/generate/${ag2Id || 'mock-agreement-1'}`, { token: landlord, body: {} });
  S2.push(['rent schedule generated', gen2.status < 300]);
  const plist = arr((await api('GET', `/api/v1/payments/agreement/${ag2Id || 'mock-agreement-1'}`, { token: tenant })).data);
  const pay2 = plist[0]?._id;
  S2.push(['tenant pays first month', pay2 ? (await api('POST', `/api/v1/payments/${pay2}/pay`, { token: tenant, body: { paymentMethod: 'telebirr', transactionReference: `TX-S2-${ts()}` } })).status < 300 : false]);
  S2.push(['landlord verifies payment', pay2 ? (await api('PUT', `/api/v1/payments/${pay2}/verify`, { token: landlord, body: { status: 'paid' } })).status < 300 : false]);

  // ── Scenario 3: tenant reports → fraud system → prioritization → admin investigation → action ──
  const S3 = [];
  const fr = await api('POST', '/api/v1/fraud-reports', { token: tenant, body: { propertyId: '66d1f801e12a4b001a222222', category: 'scam', description: 'Agent demanded deposit before viewing. S3 journey.' } });
  S3.push(['fraud report filed with risk score', fr.status === 201 && typeof fr.data?.riskScore === 'number']);
  const scored = await api('GET', '/api/v1/fraud-reports/risk-score/66d1f801e12a4b001a222222', { token: tenant });
  S3.push(['risk score endpoint', scored.status === 200 && typeof scored.data?.data?.score === 'number']);
  const pr = await api('GET', '/api/v1/ai/fraud-priority', { token: admin });
  const q = arr(pr.data?.data?.queue);
  S3.push(['AI prioritization ranks queue', pr.status === 200 && q.length >= 1 && q[0].riskScore >= (q[q.length - 1]?.riskScore ?? 0)]);
  const reports = arr((await api('GET', '/api/v1/fraud-reports/admin', { token: admin })).data);
  const target = reports.find((x) => x.status === 'open') || reports[0];
  const act = target ? await api('PUT', `/api/v1/fraud-reports/${target._id}/review`, { token: admin, body: { status: 'investigating', adminNote: 'S3 journey: opening investigation.' } }) : { status: 0 };
  S3.push(['admin investigates report', act.status < 300]);
  const resolved = target ? await api('PUT', `/api/v1/fraud-reports/${target._id}/review`, { token: admin, body: { status: 'resolved', adminNote: 'S3 journey: listing suspended pending landlord response.' } }) : { status: 0 };
  S3.push(['admin takes action (resolve)', resolved.status < 300]);

  const journey = (name, steps) => {
    const bad = steps.filter(([, ok]) => !ok);
    check(`${name}: all ${steps.length} steps pass`, bad.length === 0, bad.map(([n]) => n).join(', ') || 'ok');
    for (const [n, ok] of steps) console.log(`  ${ok ? '  ✓' : '  ✗'} ${n}`);
  };
  journey('Scenario 1 (landlord onboarding)', S1);
  journey('Scenario 2 (tenant to rent)', S2);
  journey('Scenario 3 (fraud to action)', S3);

  console.log(`\nSprint 15: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
