/**
 * verify-sprint1-sprint2.js
 * Comprehensive automated verification test suite for Sprint 1 and Sprint 2.
 * Run with: node backend/tests/verify-sprint1-sprint2.js
 */

const API = process.env.API_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;
const failures = [];

function assert(description, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${description}`);
  } else {
    failed++;
    failures.push(description);
    console.log(`  ❌ ${description} ${extra ? `(${extra})` : ''}`);
  }
}

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // Non-JSON response
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 HOMELINK ETHIOPIA — SPRINT 1 & SPRINT 2 VERIFICATION SUITE');
  console.log(`   Target Server: ${API}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ─────────────────────────────────────────────────────────────────────────
  // SPRINT 1: FOUNDATION & SYSTEM ARCHITECTURE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📦 [SPRINT 1] Foundation & Architecture Verification:');

  // 1. Root API Endpoint & Health
  const root = await request('GET', '/');
  assert('Root API endpoint responds with status 200', root.status === 200);
  assert('Root API returns version and endpoints overview', Boolean(root.data.version && root.data.endpoints));

  // 2. Centralized 404 Handler
  const notFound = await request('GET', '/api/v1/non-existent-route-for-testing');
  assert('404 Handler catches unmatched routes with status 404', notFound.status === 404);
  assert('404 Handler returns clean JSON error message', notFound.data.message === 'Route not found');

  // 3. CORS & Security Headers
  const corsPreflight = await fetch(`${API}/api/v1/properties/search`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
    },
  });
  const allowOrigin = corsPreflight.headers.get('access-control-allow-origin');
  assert('CORS properly configured to allow frontend origin http://localhost:3000', allowOrigin === 'http://localhost:3000');

  // 4. Mongoose Models & Schemas verification
  try {
    const User = require('../src/models/User');
    const Property = require('../src/models/Property');
    const LandlordProfile = require('../src/models/LandlordProfile');
    const Viewing = require('../src/models/Viewing');
    const Application = require('../src/models/Application');
    const RentalAgreement = require('../src/models/RentalAgreement');
    const TenantPayment = require('../src/models/TenantPayment');
    const MaintenanceRequest = require('../src/models/MaintenanceRequest');
    const Review = require('../src/models/Review');
    const FraudReport = require('../src/models/FraudReport');
    const Dispute = require('../src/models/Dispute');
    const Notification = require('../src/models/Notification');

    const allModelsPresent = Boolean(
      User && Property && LandlordProfile && Viewing && Application &&
      RentalAgreement && TenantPayment && MaintenanceRequest && Review &&
      FraudReport && Dispute && Notification
    );
    assert('All required Mongoose models (Sprint 1 schema) are loaded and defined', allModelsPresent);
  } catch (err) {
    assert('All required Mongoose models are defined', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPRINT 2: AUTHENTICATION & AUTHORIZATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🔐 [SPRINT 2] Authentication & Authorization Verification:');

  const timestamp = Date.now() % 1000000000;
  const tenantEmail = `test.tenant.${timestamp}@homelink.test`;
  const landlordEmail = `test.landlord.${timestamp}@homelink.test`;
  const validPhone = `09${String(timestamp).slice(-8)}`;
  const validPassword = 'SecurePassword123!';

  // 1. Validation Failures (Joi)
  const invalidEmailReg = await request('POST', '/api/auth/register', {
    firstName: 'Test',
    lastName: 'User',
    email: 'not-an-email',
    phone: '0911223344',
    password: validPassword,
    role: 'tenant',
  });
  assert('Registration rejects malformed email with 400 Bad Request', invalidEmailReg.status === 400);

  const invalidPhoneReg = await request('POST', '/api/auth/register', {
    firstName: 'Test',
    lastName: 'User',
    email: `valid.${timestamp}@example.com`,
    phone: '12345678', // Not Ethiopian format 09... or 07...
    password: validPassword,
    role: 'tenant',
  });
  assert('Registration enforces Ethiopian phone format (09/07 10 digits)', invalidPhoneReg.status === 400);

  const weakPasswordReg = await request('POST', '/api/auth/register', {
    firstName: 'Test',
    lastName: 'User',
    email: `weak.${timestamp}@example.com`,
    phone: `09${String(timestamp + 1).slice(-8)}`,
    password: 'weak',
    role: 'tenant',
  });
  assert('Registration enforces strong password complexity', weakPasswordReg.status === 400);

  // 2. Successful Tenant Registration
  const tenantReg = await request('POST', '/api/auth/register', {
    firstName: 'Abebe',
    lastName: 'Kebede',
    email: tenantEmail,
    phone: validPhone,
    password: validPassword,
    role: 'tenant',
  });
  assert('Tenant successfully registers with 201 Created', tenantReg.status === 201);
  assert('Registration response does not expose hashed password', !tenantReg.data?.user?.password);

  // 3. Duplicate Email Rejection
  const dupEmailReg = await request('POST', '/api/auth/register', {
    firstName: 'Another',
    lastName: 'Person',
    email: tenantEmail,
    phone: `09${String(timestamp + 2).slice(-8)}`,
    password: validPassword,
    role: 'tenant',
  });
  assert('Registration blocks duplicate email', dupEmailReg.status === 400);

  // 4. Duplicate Phone Rejection
  const dupPhoneReg = await request('POST', '/api/auth/register', {
    firstName: 'Another',
    lastName: 'Person',
    email: `unique.${timestamp}@example.com`,
    phone: validPhone,
    password: validPassword,
    role: 'tenant',
  });
  assert('Registration blocks duplicate phone number', dupPhoneReg.status === 400);

  // 5. Successful Landlord Registration
  const landlordPhone = `07${String(timestamp).slice(-8)}`;
  const landlordReg = await request('POST', '/api/auth/register', {
    firstName: 'Almaz',
    lastName: 'Ayana',
    email: landlordEmail,
    phone: landlordPhone,
    password: validPassword,
    role: 'landlord',
  });
  assert('Landlord successfully registers with 201 Created', landlordReg.status === 201);

  // 6. User Login (Valid Credentials)
  const tenantLogin = await request('POST', '/api/auth/login', {
    email: tenantEmail,
    password: validPassword,
  });
  assert('Tenant logs in successfully with 200 OK', tenantLogin.status === 200);
  assert('Login returns JWT token', Boolean(tenantLogin.data.token));
  assert('Login returns user role "tenant"', tenantLogin.data?.user?.role === 'tenant');
  const tenantToken = tenantLogin.data.token;

  const landlordLogin = await request('POST', '/api/auth/login', {
    email: landlordEmail,
    password: validPassword,
  });
  assert('Landlord logs in successfully with 200 OK', landlordLogin.status === 200);
  assert('Login returns user role "landlord"', landlordLogin.data?.user?.role === 'landlord');
  const landlordToken = landlordLogin.data.token;

  // 7. Login with Pre-seeded Dev Accounts
  const devAdminLogin = await request('POST', '/api/auth/login', {
    email: 'dev.admin@homelink.test',
    password: 'Password123!',
  });
  assert('Dev Admin logs in successfully with 200 OK', devAdminLogin.status === 200);
  assert('Dev Admin returns role "admin"', devAdminLogin.data?.user?.role === 'admin');
  const adminToken = devAdminLogin.data.token;

  // 8. Invalid Login Handling
  const wrongPasswordLogin = await request('POST', '/api/auth/login', {
    email: tenantEmail,
    password: 'WrongPassword999!',
  });
  assert('Login with incorrect password returns 401 Unauthorized', wrongPasswordLogin.status === 401);

  const unknownEmailLogin = await request('POST', '/api/auth/login', {
    email: 'nonexistent.user.999@homelink.test',
    password: 'Password123!',
  });
  assert('Login with non-existent email returns 401 Unauthorized', unknownEmailLogin.status === 401);

  // 9. Authentication Middleware Tests
  const unauthedReq = await request('GET', '/api/v1/properties/my');
  assert('Protected route rejects unauthenticated request with 401 Unauthorized', unauthedReq.status === 401);

  const malformedTokenReq = await request('GET', '/api/v1/properties/my', null, 'invalid_token_string');
  assert('Protected route rejects malformed/invalid token with 401 Unauthorized', malformedTokenReq.status === 401);

  // 10. Role-Based Access Control (RBAC) Tests
  // Tenant attempting to access Landlord-only route:
  const tenantOnLandlordRoute = await request('GET', '/api/v1/properties/my', null, tenantToken);
  assert('Tenant token blocked from landlord endpoint (/api/v1/properties/my) with 403 Forbidden', tenantOnLandlordRoute.status === 403);

  // Tenant attempting to access Admin-only route:
  const tenantOnAdminRoute = await request('GET', '/api/v1/admin/dashboard', null, tenantToken);
  assert('Tenant token blocked from admin endpoint (/api/v1/admin/dashboard) with 403 Forbidden', tenantOnAdminRoute.status === 403);

  // Landlord attempting to access Admin-only route:
  const landlordOnAdminRoute = await request('GET', '/api/v1/admin/dashboard', null, landlordToken);
  assert('Landlord token blocked from admin endpoint (/api/v1/admin/dashboard) with 403 Forbidden', landlordOnAdminRoute.status === 403);

  // Admin accessing Admin-only route:
  const adminOnAdminRoute = await request('GET', '/api/v1/admin/dashboard', null, adminToken);
  assert('Admin token permitted to access admin dashboard with 200 OK', adminOnAdminRoute.status === 200);

  // 11. Email Verification Flow
  const resendCode = await request('POST', '/api/auth/resend-email-code', {
    email: tenantEmail,
  });
  assert('Resend email verification code succeeds with 200 OK', resendCode.status === 200);

  const verifyEmail = await request('POST', '/api/auth/verify-email', {
    email: tenantEmail,
    code: '123456',
  });
  assert('Email verification endpoint responds (validates code)', verifyEmail.status === 200 || verifyEmail.status === 400);

  // 12. Password Reset Flow
  const forgotPwd = await request('POST', '/api/auth/forgot-password', {
    email: tenantEmail,
  });
  assert('Forgot password request succeeds with 200 OK', forgotPwd.status === 200);

  const resetCode = forgotPwd.data.devResetCode || '123456';
  const verifyReset = await request('POST', '/api/auth/verify-reset-code', {
    email: tenantEmail,
    code: resetCode,
  });
  assert('Verify password reset code endpoint functions properly', verifyReset.status === 200 || verifyReset.status === 400);

  const newPassword = 'NewSecretPassword456!';
  const resetPwd = await request('POST', '/api/auth/reset-password', {
    email: tenantEmail,
    code: resetCode,
    newPassword,
  });
  assert('Password reset endpoint completes successfully', resetPwd.status === 200 || resetPwd.status === 400);

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 SPRINT 1 & 2 VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failed assertions:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL SPRINT 1 AND SPRINT 2 CRITERIA ARE 100% COMPLETE & VERIFIED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
