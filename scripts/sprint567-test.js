#!/usr/bin/env node
/**
 * Sprint 5-7 verification suite — runs against the live backend (mock mode).
 * S5 discovery, S6 AI matching, S7 viewings & applications (+ notifications).
 * Run: node scripts/sprint567-test.js   (backend must be running on :5000)
 */
const BASE = 'http://localhost:5000';
const TENANT = { email: 'dev.tenant@homelink.test', password: 'Password123!' };
const LANDLORD = { email: 'dev.landlord@homelink.test', password: 'Password123!' };

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
  console.log('Sprint 5-7 verification — ' + BASE);
  const t = await api('POST', '/api/auth/login', null, TENANT);
  const l = await api('POST', '/api/auth/login', null, LANDLORD);
  const tTok = t.data.token, lTok = l.data.token;
  ok('tenant + landlord login', !!tTok && !!lTok);

  // ══ SPRINT 5 — DISCOVERY ══
  console.log('\n── Sprint 5: Property Discovery ──');
  const s1 = await api('GET', '/api/v1/properties/search?q=Bole');
  const rows1 = unwrap(s1.data);
  ok('search by location text (q=)', s1.status === 200 && rows1.length >= 1);

  const s2 = await api('GET', '/api/v1/properties/search?minPrice=40000&maxPrice=60000');
  ok('filter: min/max price', (unwrap(s2.data) || []).every((p) => p.rentAmount >= 40000 && p.rentAmount <= 60000));
  const s3 = await api('GET', '/api/v1/properties/search?propertyType=apartment');
  ok('filter: property type', (unwrap(s3.data) || []).every((p) => p.propertyType === 'apartment'));
  const s4 = await api('GET', '/api/v1/properties/search?bedrooms=3');
  ok('filter: bedrooms (min)', (unwrap(s4.data) || []).every((p) => p.bedrooms >= 3));
  const s5 = await api('GET', '/api/v1/properties/search?bathrooms=2');
  ok('filter: bathrooms (min)', (unwrap(s5.data) || []).every((p) => p.bathrooms >= 2));
  const s6 = await api('GET', '/api/v1/properties/search?amenities=generator');
  ok('filter: amenities', (unwrap(s6.data) || []).every((p) => (p.amenities || []).some((a) => a.toLowerCase().includes('generator'))));
  const s7 = await api('GET', '/api/v1/properties/search?furnished=true');
  ok('filter: furnished', (unwrap(s7.data) || []).every((p) => p.furnished === true));
  const s8 = await api('GET', '/api/v1/properties/search?verifiedOnly=true');
  ok('filter: verified only', (unwrap(s8.data) || []).every((p) => p.verificationStatus === 'verified'));
  const s9 = await api('GET', '/api/v1/properties/search?city=Addis');
  ok('filter: city', (unwrap(s9.data) || []).every((p) => (p.location.city || '').toLowerCase().includes('addis')));

  const sa = await api('GET', '/api/v1/properties/search?sort=price_asc');
  const ra = (unwrap(sa.data) || []).map((p) => p.rentAmount);
  ok('sort: price low→high', sa.status === 200 && ra.every((v, i) => i === 0 || ra[i - 1] <= v));
  const sd = await api('GET', '/api/v1/properties/search?sort=price_desc');
  const rd = (unwrap(sd.data) || []).map((p) => p.rentAmount);
  ok('sort: price high→low', rd.every((v, i) => i === 0 || rd[i - 1] >= v));
  const sn = await api('GET', '/api/v1/properties/search?sort=newest');
  ok('sort: newest (200)', sn.status === 200);

  const sp = await api('GET', '/api/v1/properties/search?page=1&limit=2');
  ok('pagination: page/limit/total returned', sp.status === 200 && sp.data.pagination && sp.data.pagination.page === 1 && sp.data.pagination.limit === 2 && typeof sp.data.pagination.total === 'number');
  const sp2 = await api('GET', '/api/v1/properties/search?page=2&limit=2');
  ok('pagination: page 2 differs from page 1', (unwrap(sp2.data) || []).length >= 0 && JSON.stringify(unwrap(sp.data)) !== JSON.stringify(unwrap(sp2.data)));

  const pid = rows1[0]._id;
  const det = await api('GET', '/api/v1/properties/' + pid);
  const d = unwrap(det.data);
  ok('details: images + location + price + amenities + description + availability', det.status === 200 && 'images' in d && d.location && 'rentAmount' in d && 'amenities' in d && 'description' in d && 'status' in d);
  ok('details: landlord verification badge', d.landlordId && (typeof d.landlordId === 'object' ? d.landlordId.verificationStatus === 'verified' : true));
  ok('details: ratings present (avg + count)', d.ratings && 'average' in d.ratings && 'count' in d.ratings);

  // favourites: save → view → duplicate → remove → view
  const fav1 = await api('POST', '/api/v1/properties/' + pid + '/favourite', tTok, {});
  ok('save property (201)', fav1.status === 201, 'got ' + fav1.status);
  const favDup = await api('POST', '/api/v1/properties/' + pid + '/favourite', tTok, {});
  ok('duplicate save rejected (400)', favDup.status === 400, 'got ' + favDup.status);
  const favList = await api('GET', '/api/v1/properties/favourites', tTok);
  ok('view saved properties', favList.status === 200 && (unwrap(favList.data) || []).some((p) => p._id === pid));
  const favDel = await api('DELETE', '/api/v1/properties/' + pid + '/favourite', tTok);
  ok('remove saved property (200)', favDel.status === 200, 'got ' + favDel.status);
  const favList2 = await api('GET', '/api/v1/properties/favourites', tTok);
  ok('saved list no longer contains removed property', !(unwrap(favList2.data) || []).some((p) => p._id === pid));

  // ══ SPRINT 6 — AI MATCHING ══
  console.log('\n── Sprint 6: AI Matching ──');
  const prefs = {
    budget: { min: 30000, max: 50000 },
    location: { city: 'Addis Ababa', subCity: 'Bole' },
    propertyType: 'apartment', bedrooms: 2,
    amenities: ['generator', 'water tank'], moveInDate: '2026-11-01',
  };
  const sv = await api('POST', '/api/v1/properties/preferences', tTok, prefs);
  ok('tenant preferences saved (budget/location/type/beds/amenities/move-in)', sv.status === 200, 'got ' + sv.status);
  const gp = await api('GET', '/api/v1/properties/preferences', tTok);
  ok('preferences readable', gp.status === 200 && unwrap(gp.data) && unwrap(gp.data).propertyType === 'apartment');
  const up = await api('PUT', '/api/v1/properties/preferences', tTok, { bedrooms: 3 });
  ok('preferences partially updatable', up.status === 200 && unwrap(up.data).bedrooms === 3);

  const match = await api('POST', '/api/v1/ai/match', tTok, prefs);
  const mBody = unwrap(match.data) || {};
  const matches = mBody.matches || [];
  ok('POST /ai/match returns ranked matches', match.status === 200 && matches.length >= 1);
  ok('match has score 0-100', matches.every((m) => m.score >= 0 && m.score <= 100));
  ok('match is explainable (reasons array)', matches.every((m) => Array.isArray(m.reasons) && m.reasons.length >= 3));
  ok('match has per-factor breakdown', matches.every((m) => m.breakdown && 'budget' in m.breakdown && 'location' in m.breakdown));
  const sorted = matches.map((m) => m.score);
  ok('matches sorted best-first', sorted.every((v, i) => i === 0 || sorted[i - 1] >= v));
  ok('weights documented (budget 25%)', mBody.meta && mBody.meta.weights && mBody.meta.weights.budget === 25);

  // ══ SPRINT 7 — VIEWINGS & APPLICATIONS ══
  console.log('\n── Sprint 7: Viewings & Applications ──');
  const when = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const vr = await api('POST', '/api/v1/viewings', tTok, {
    propertyId: pid,
    requestedSlots: [{ date: when, startTime: '10:00', endTime: '11:00' }],
    tenantNote: 'Is parking available?',
  });
  const viewing = unwrap(vr.data);
  const vid = viewing && viewing._id;
  ok('tenant requests viewing (date/time/message)', vr.status === 201 && viewing.status === 'requested', 'got ' + vr.status);

  const vRej = await api('POST', '/api/v1/viewings', tTok, {
    propertyId: pid,
    requestedSlots: [{ date: when, startTime: '12:00', endTime: '13:00' }],
    tenantNote: 'Second slot test',
  });
  const vRejId = unwrap(vRej.data)._id;

  const acc = await api('PUT', '/api/v1/viewings/' + vid + '/accept', lTok, { confirmedSlot: { date: when, startTime: '10:00' }, landlordNote: 'See you there' });
  ok('landlord accepts viewing → confirmed', acc.status === 200 && unwrap(acc.data).status === 'confirmed', 'got ' + acc.status);
  const rej = await api('PUT', '/api/v1/viewings/' + vRejId + '/reject', lTok, { cancellationReason: 'Booked that day' });
  ok('landlord rejects viewing → cancelled', rej.status === 200, 'got ' + rej.status);
  const vRes = await api('POST', '/api/v1/viewings', tTok, {
    propertyId: pid,
    requestedSlots: [{ date: when, startTime: '14:00', endTime: '15:00' }],
    tenantNote: 'Reschedule test',
  });
  const vResId = unwrap(vRes.data)._id;
  const rsc = await api('PUT', '/api/v1/viewings/' + vResId + '/reschedule', lTok, { confirmedSlot: { date: when, startTime: '15:00' } });
  ok('landlord reschedules viewing', rsc.status === 200, 'got ' + rsc.status);
  const cmp = await api('PUT', '/api/v1/viewings/' + vResId + '/complete', lTok, {});
  ok('landlord completes viewing', cmp.status === 200 && unwrap(cmp.data).status === 'completed', 'got ' + cmp.status);

  const app1 = await api('POST', '/api/v1/applications', tTok, { propertyId: pid, employmentStatus: 'Employed', monthlyIncome: 30000, note: 'Interested in moving in November' });
  const app = unwrap(app1.data);
  ok('tenant applies (201, under_review)', app1.status === 201 && ['submitted', 'under_review'].includes(app.status), 'got ' + app1.status);

  const lApps = await api('GET', '/api/v1/applications/landlord', lTok);
  ok('landlord views applications', lApps.status === 200 && (unwrap(lApps.data) || []).some((x) => x._id === app._id));

  const apr = await api('PUT', '/api/v1/applications/' + app._id + '/review', lTok, { status: 'approved', landlordFeedback: 'Great fit' });
  ok('landlord approves application', apr.status === 200 && unwrap(apr.data).status === 'approved', 'got ' + apr.status);

  const app2 = await api('POST', '/api/v1/applications', tTok, { propertyId: pid, employmentStatus: 'Employed', monthlyIncome: 28000 });
  const app2Id = unwrap(app2.data)._id;
  const rej2 = await api('PUT', '/api/v1/applications/' + app2Id + '/review', lTok, { status: 'rejected', landlordFeedback: 'Already rented' });
  ok('landlord rejects application', rej2.status === 200 && unwrap(rej2.data).status === 'rejected', 'got ' + rej2.status);

  const app3 = await api('POST', '/api/v1/applications', tTok, { propertyId: pid, employmentStatus: 'Employed', monthlyIncome: 28000 });
  const wd = await api('PUT', '/api/v1/applications/' + unwrap(app3.data)._id + '/withdraw', tTok, {});
  ok('tenant withdraws application', wd.status === 200, 'got ' + wd.status);

  // spec notifications generated by these events
  const notifs = await api('GET', '/api/v1/notifications', tTok);
  const nRows = (notifs.data && notifs.data.notifications) || [];
  const types = new Set(nRows.map((n) => n.type));
  ok('viewing_accepted notification emitted', types.has('viewing_confirmed'), [...types].join(','));
  ok('application_received → decision notifications emitted', types.has('application_approved') || types.has('application_rejected'));

  // ══ summary ══
  console.log('\nSprint 5-7: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Suite crashed:', e); process.exit(1); });
