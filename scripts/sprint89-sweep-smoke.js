#!/usr/bin/env node
/**
 * Sprint 8 — module-level smoke test for the overdue sweep job.
 * Loads the job in-process against the mock store, fabricates a past-due
 * pending payment, runs one sweep, and asserts the flip + notifications.
 * Run: node scripts/sprint89-sweep-smoke.js
 */
process.env.MOCK_MODE = process.env.MOCK_MODE || 'true';

const { isMockMode, mockStore, mockCreateNotification } = require('../backend/src/config/db');
const { runOverdueSweep } = require('../backend/src/jobs/overdueSweep');

(async () => {
  if (!isMockMode()) {
    console.error('Expected mock mode for this smoke test.');
    process.exit(1);
  }
  mockStore.payments = mockStore.payments || [];
  mockStore.payments.push({
    _id: 'smoke-payment-overdue-1',
    agreementId: 'smoke-agreement-1',
    tenantId: 'mock-user-seed-1',
    landlordId: 'mock-landlord-1',
    propertyId: '66d1f801e12a4b001a111111',
    paymentType: 'rent',
    periodMonth: '2026-08',
    amountDue: 42000,
    dueDate: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
    status: 'pending',
  });

  await runOverdueSweep();

  const p = mockStore.payments.find((x) => x._id === 'smoke-payment-overdue-1');
  const notifs = (mockStore.notifications || []).filter((n) => n.type === 'rent_overdue');
  const tenantNotified = notifs.some((n) => String(n.userId) === 'mock-user-seed-1');
  const landlordNotified = notifs.some((n) => String(n.userId) === 'mock-landlord-1');

  let fail = 0;
  const ok = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) fail++; };
  ok('pending → overdue flip', p && p.status === 'overdue');
  ok('idempotency guard set (overdueNotifiedAt)', p && !!p.overdueNotifiedAt);
  ok('tenant rent_overdue notification', tenantNotified);
  ok('landlord rent_overdue notification', landlordNotified);

  // second run must be a no-op (no duplicate notifications)
  const before = notifs.length;
  await runOverdueSweep();
  const after = (mockStore.notifications || []).filter((n) => n.type === 'rent_overdue').length;
  ok('second sweep does not duplicate notifications', after === before);

  console.log(fail ? 'sweep smoke: FAILED' : 'sweep smoke: all passed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('smoke crashed:', e); process.exit(1); });
