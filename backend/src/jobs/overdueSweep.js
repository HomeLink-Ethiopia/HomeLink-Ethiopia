/**
 * Sprint 8 — overdue rent sweep job.
 * Flips pending rent payments to `overdue` once their due date has passed and
 * notifies the tenant (and landlord). Idempotent: each payment notifies at most
 * once (guarded by `overdueNotifiedAt`). Runs hourly via setInterval.
 *
 * (sprint89-overdue-sweep)
 */
const TenantPayment = require('../models/TenantPayment');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, mockCreateNotification } = require('../config/db');

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

const notify = async (userId, type, title, body, entityId) => {
  try {
    await Notification.create({
      userId, type, title, body,
      relatedEntity: { entityType: 'TenantPayment', entityId },
      channels: ['in_app'],
    });
  } catch (e) {
    console.error('[overdueSweep] notification failed:', e.message);
  }
};

const runOverdueSweep = async () => {
  try {
    if (isMockMode()) {
      const now = new Date();
      let flipped = 0;
      (mockStore.payments || []).forEach((p) => {
        if (
          p.status === 'pending' &&
          p.dueDate &&
          new Date(p.dueDate) < now &&
          !p.overdueNotifiedAt
        ) {
          p.status = 'overdue';
          p.overdueNotifiedAt = now.toISOString();
          flipped++;
          mockCreateNotification(
            p.tenantId, 'rent_overdue', 'Rent Overdue',
            `Your rent payment of ${p.amountDue} ETB (due ${new Date(p.dueDate).toLocaleDateString()}) is overdue.`,
            'TenantPayment', p._id
          );
          mockCreateNotification(
            p.landlordId, 'rent_overdue', 'Rent Payment Overdue',
            `A rent payment of ${p.amountDue} ETB for your property is past its due date.`,
            'TenantPayment', p._id
          );
        }
      });
      if (flipped) console.log(`[overdueSweep] mock: marked ${flipped} payment(s) overdue`);
      return;
    }

    const now = new Date();
    const stale = await TenantPayment.find({
      status: 'pending',
      dueDate: { $lt: now },
      overdueNotifiedAt: { $exists: false },
    }).limit(500);

    for (const payment of stale) {
      payment.status = 'overdue';
      payment.overdueNotifiedAt = now;
      await payment.save();
      await notify(
        payment.tenantId, 'rent_overdue', 'Rent Overdue',
        `Your rent payment of ${payment.amountDue} ETB (due ${payment.dueDate.toLocaleDateString()}) is overdue.`,
        payment._id
      );
      await notify(
        payment.landlordId, 'rent_overdue', 'Rent Payment Overdue',
        `A rent payment of ${payment.amountDue} ETB for your property is past its due date.`,
        payment._id
      );
    }
    if (stale.length) console.log(`[overdueSweep] marked ${stale.length} payment(s) overdue`);
  } catch (e) {
    console.error('[overdueSweep] run failed:', e.message);
  }
};

const startOverdueSweepJob = () => {
  runOverdueSweep();
  setInterval(runOverdueSweep, SWEEP_INTERVAL_MS);
  console.log('[overdueSweep] job started (hourly)');
};

module.exports = { startOverdueSweepJob, runOverdueSweep };
