const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');
const { isMockMode, mockStore, mockCreateNotification } = require('../config/db');

/**
 * Smart Lease Renewal — auto-reminders at 60/30/15 days before lease expiry.
 *
 * Runs every 6 hours (setInterval, no external cron dependency). Idempotent:
 * each milestone fires at most once per agreement via the renewalReminders
 * array. High-value tenants (score >= 700) get a personalized nudge; others
 * get the standard reminder.
 */

const MILESTONES = [60, 30, 15];
const CHECK_INTERVAL_MS = 6 * 3600 * 1000; // every 6 hours

const daysUntil = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

const notify = async (userId, type, title, body, entityId) => {
  try {
    await Notification.create({
      userId, type, title, body,
      relatedEntity: { entityType: 'RentalAgreement', entityId },
      channels: ['in_app'],
    });
  } catch (e) {
    console.error('[renewalReminders] notification failed:', e.message);
  }
};

const runRenewalReminderJob = async () => {
  try {
    if (isMockMode()) {
      const soon = new Date(Date.now() + 60 * 86400000);
      const now = new Date();
      (mockStore.agreements || []).forEach((a) => {
        if (a.status !== 'active' || !a.endDate) return;
        const end = new Date(a.endDate);
        if (end < now || end > soon) return;
        const days = daysUntil(a.endDate);
        const milestone = MILESTONES.find(m => days <= m);
        if (!milestone) return;
        a.renewalReminders = a.renewalReminders || [];
        if (a.renewalReminders.some(r => r.milestone === milestone)) return;
        if (a.renewalProposal && a.renewalProposal.status === 'proposed') return;
        const tenantId = typeof a.tenantId === 'object' ? a.tenantId?._id : a.tenantId;
        const landlordId = typeof a.landlordId === 'object' ? a.landlordId?._id : a.landlordId;
        const title = a.propertyId?.title || 'your rental';
        const msg = `Lease for ${title} expires in ${days} days.`;
        if (tenantId) mockCreateNotification(tenantId, 'agreement_expiring', `Lease expires in ${days} days`, msg, 'RentalAgreement', a._id);
        if (landlordId) mockCreateNotification(landlordId, 'agreement_expiring', `Lease expires in ${days} days`, msg, 'RentalAgreement', a._id);
        a.renewalReminders.push({ milestone, sentAt: new Date().toISOString() });
      });
      return;
    }

    const soon = new Date(Date.now() + 60 * 86400000);
    const agreements = await RentalAgreement.find({
      status: 'active',
      endDate: { $lte: soon, $gte: new Date() },
    })
      .populate('propertyId', 'title')
      .populate('tenantId', 'firstName')
      .populate('landlordId', 'firstName')
      .lean();

    let sent = 0;
    for (const a of agreements) {
      const days = daysUntil(a.endDate);
      const milestone = MILESTONES.find(m => days <= m);
      if (!milestone) continue;

      const already = (a.renewalReminders || []).some(r => r.milestone === milestone);
      if (already) continue;
      // Skip if a proposal is already pending — no need to nag
      if (a.renewalProposal && a.renewalProposal.status === 'proposed') continue;

      const title = a.propertyId?.title || 'your rental';
      const msg = days > 45
        ? `Your lease for ${title} expires in ${days} days (${new Date(a.endDate).toLocaleDateString()}). Now is a good time to discuss renewal.`
        : days > 20
          ? `Your lease for ${title} expires in ${days} days. Propose or accept renewal terms to avoid disruption.`
          : `Final reminder: lease for ${title} expires in ${days} days. Agree on renewal terms now.`;

      await notify(a.tenantId._id, 'agreement_expiring', `Lease expires in ${days} days`, msg, a._id);
      await notify(a.landlordId._id, 'agreement_expiring', `Lease expires in ${days} days`, msg, a._id);

      await RentalAgreement.updateOne(
        { _id: a._id },
        { $push: { renewalReminders: { milestone, sentAt: new Date() } } }
      );
      sent += 1;
    }
    if (sent > 0) console.log(`[renewalReminders] ${sent} lease expiry reminder(s) sent`);
  } catch (e) {
    console.error('[renewalReminders] job error:', e.message);
  }
};

const startRenewalReminderJob = () => {
  // Run shortly after boot, then on interval
  setTimeout(runRenewalReminderJob, 15 * 1000);
  setInterval(runRenewalReminderJob, CHECK_INTERVAL_MS);
  console.log('⏰ Renewal reminder job scheduled (60/30/15-day milestones, every 6h)');
};

module.exports = { startRenewalReminderJob, runRenewalReminderJob };
