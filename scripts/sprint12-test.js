/* eslint-disable */
// Sprint 12 API verification — run: node scripts/sprint12-test.js
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
  else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 180) : ''}`); }
}

(async () => {
  // logins
  const tokens = {};
  for (const role of ['tenant', 'landlord', 'admin']) {
    const r = await api('POST', '/api/auth/login', { body: { email: `dev.${role}@homelink.test`, password: 'Password123!' } });
    tokens[role] = r.data?.token;
  }
  check('logins', !!tokens.admin && !!tokens.tenant && !!tokens.landlord);
  const admin = tokens.admin;

  // ── Combined analytics endpoint ──
  let r = await api('GET', '/api/v1/admin/analytics', { token: admin });
  check('GET /admin/analytics (200)', r.status === 200, r.status);
  const k = r.data?.data?.kpis || {};
  const charts = r.data?.data?.charts || {};

  // ── Sprint 12 KPIs (all 10) ──
  check('KPI totalUsers', Number.isFinite(k.totalUsers) && k.totalUsers >= 4, k.totalUsers);
  check('KPI totalLandlords', Number.isFinite(k.totalLandlords) && k.totalLandlords >= 1, k.totalLandlords);
  check('KPI totalTenants', Number.isFinite(k.totalTenants) && k.totalTenants >= 2, k.totalTenants);
  check('KPI totalProperties', Number.isFinite(k.totalProperties) && k.totalProperties >= 4, k.totalProperties);
  check('KPI verifiedProperties', Number.isFinite(k.verifiedProperties), k.verifiedProperties);
  check('KPI pendingVerification', Number.isFinite(k.pendingVerification), k.pendingVerification);
  check('KPI activeRentals', Number.isFinite(k.activeRentals) && k.activeRentals >= 3, k.activeRentals);
  check('KPI totalApplications', Number.isFinite(k.totalApplications), k.totalApplications);
  check('KPI fraudReports', Number.isFinite(k.fraudReports), k.fraudReports);
  check('KPI openDisputes', Number.isFinite(k.openDisputes), k.openDisputes);

  // KPI counts consistency: users split by role + admins
  check('KPI roles sum to totalUsers', k.totalTenants + k.totalLandlords + (k.totalAdmins || 0) === k.totalUsers, `${k.totalTenants}+${k.totalLandlords}+${k.totalAdmins}!=${k.totalUsers}`);

  // ── Charts (all 6) ──
  check('chart propertiesByCity', Array.isArray(charts.propertiesByCity) && charts.propertiesByCity.length >= 3 && charts.propertiesByCity.every((c) => c.label && Number.isFinite(c.value)), charts.propertiesByCity);
  check('chart usersByRole', Array.isArray(charts.usersByRole) && charts.usersByRole.length === 3, charts.usersByRole);
  check('chart propertiesByPriceRange', Array.isArray(charts.propertiesByPriceRange) && charts.propertiesByPriceRange.length >= 4, charts.propertiesByPriceRange);
  check('chart verificationStats', Array.isArray(charts.verificationStats) && charts.verificationStats.length >= 3, charts.verificationStats);
  check('chart fraudByType', Array.isArray(charts.fraudByType), charts.fraudByType);
  check('chart applicationTrend', Array.isArray(charts.applicationTrend), charts.applicationTrend);
  const cityTotal = (charts.propertiesByCity || []).reduce((s, c) => s + c.value, 0);
  check('chart city counts sum to totalProperties', cityTotal === k.totalProperties, `${cityTotal} vs ${k.totalProperties}`);

  // ── Access control ──
  r = await api('GET', '/api/v1/admin/analytics', { token: tokens.tenant });
  check('tenant blocked from analytics (403)', r.status === 403, r.status);
  r = await api('GET', '/api/v1/admin/analytics', { token: tokens.landlord });
  check('landlord blocked from analytics (403)', r.status === 403, r.status);

  // ── Legacy endpoints still work (kpis + charts) ──
  r = await api('GET', '/api/v1/admin/analytics/kpis', { token: admin });
  check('legacy /analytics/kpis works', r.status === 200 && !!r.data?.data, r.status);
  r = await api('GET', '/api/v1/admin/analytics/charts', { token: admin });
  check('legacy /analytics/charts works', r.status === 200 && !!r.data?.data, r.status);

  // ── Admin controls endpoints (from Sprint 11) still live ──
  r = await api('GET', '/api/v1/admin/suspicious/accounts', { token: admin });
  check('controls: manage users list', r.status === 200 && (r.data.data || []).length >= 3, (r.data.data || []).length);
  r = await api('GET', '/api/v1/properties/all', { token: admin });
  check('controls: manage properties list', r.status === 200 && (r.data.data || []).length >= 4, (r.data.data || []).length);
  r = await api('GET', '/api/v1/verification/pending', { token: admin });
  check('controls: review verification', r.status === 200 && !!r.data?.data?.landlords, r.status);
  r = await api('GET', '/api/v1/fraud-reports', { token: admin });
  check('controls: review fraud', r.status === 200 && Array.isArray(r.data.data), r.status);
  r = await api('GET', '/api/v1/disputes', { token: admin });
  check('controls: review disputes', r.status === 200 && Array.isArray(r.data.data), r.status);

  // ── Dashboard overview (Sprint 11) still works ──
  r = await api('GET', '/api/v1/admin/dashboard', { token: admin });
  check('admin/dashboard overview', r.status === 200 && !!r.data?.data?.openDisputes, r.status);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
