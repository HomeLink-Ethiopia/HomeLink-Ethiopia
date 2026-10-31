const { isMockMode, mockStore, persistMockData } = require('../config/db');
const TenantPayment = require('../models/TenantPayment');

/**
 * Generates the full rent and deposit payment schedule for an active rental agreement.
 * Idempotent: will not create duplicate entries for the same month and agreement.
 * Works seamlessly in both in-memory mock mode and real MongoDB mode.
 */
async function generateRentScheduleForAgreement(agreement) {
  if (!agreement) return { created: 0, payments: [] };

  const agreementId = String(agreement._id || '');
  const propId = typeof agreement.propertyId === 'object' ? agreement.propertyId._id : agreement.propertyId;
  const tenantId = typeof agreement.tenantId === 'object' ? agreement.tenantId._id : agreement.tenantId;
  const landlordId = typeof agreement.landlordId === 'object' ? agreement.landlordId._id : agreement.landlordId;

  const startDate = new Date(agreement.startDate || Date.now());
  const endDate = new Date(agreement.endDate || new Date(startDate.getTime() + 365 * 24 * 3600 * 1000));
  const rentAmount = Number(agreement.rentAmount || agreement.monthlyRentEtb || 0);
  const depositAmount = Number(agreement.depositAmount || 0);
  const dueDay = Math.min(Math.max(Number(agreement.paymentDueDay) || 5, 1), 28);
  const now = new Date();

  // ─── IN-MEMORY MOCK MODE ───
  if (isMockMode()) {
    mockStore.payments = mockStore.payments || [];
    let createdCount = 0;

    // 1. Initial Security Deposit (if specified)
    if (depositAmount > 0) {
      const depositExists = mockStore.payments.some(
        (p) => String(p.agreementId) === agreementId && p.paymentType === 'deposit'
      );
      if (!depositExists) {
        const depositDueDate = new Date(startDate);
        mockStore.payments.push({
          _id: `mock-pay-dep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          agreementId,
          tenantId: typeof agreement.tenantId === 'object' ? agreement.tenantId : { _id: tenantId, firstName: 'Tenant' },
          landlordId: typeof agreement.landlordId === 'object' ? agreement.landlordId : { _id: landlordId, firstName: 'Landlord' },
          propertyId: typeof agreement.propertyId === 'object' ? agreement.propertyId : { _id: propId, title: 'Property' },
          paymentType: 'deposit',
          periodMonth: 'Security Deposit',
          amountDue: depositAmount,
          amountPaid: 0,
          balance: depositAmount,
          currency: 'ETB',
          dueDate: depositDueDate.toISOString(),
          status: depositDueDate < now ? 'overdue' : 'pending',
          notes: 'Refundable security deposit held in escrow',
          createdAt: new Date().toISOString(),
        });
        createdCount++;
      }
    }

    // 2. Monthly Rent Schedule across lease term
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const periodMonth = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const exists = mockStore.payments.some(
        (p) => String(p.agreementId) === agreementId && p.paymentType === 'rent' && p.periodMonth === periodMonth
      );
      if (!exists && rentAmount > 0) {
        const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), dueDay);
        mockStore.payments.push({
          _id: `mock-pay-${Date.now()}-${createdCount}-${Math.floor(Math.random() * 1000)}`,
          agreementId,
          tenantId: typeof agreement.tenantId === 'object' ? agreement.tenantId : { _id: tenantId, firstName: 'Tenant' },
          landlordId: typeof agreement.landlordId === 'object' ? agreement.landlordId : { _id: landlordId, firstName: 'Landlord' },
          propertyId: typeof agreement.propertyId === 'object' ? agreement.propertyId : { _id: propId, title: 'Property' },
          paymentType: 'rent',
          periodMonth,
          amountDue: rentAmount,
          amountPaid: 0,
          balance: rentAmount,
          currency: 'ETB',
          dueDate: dueDate.toISOString(),
          status: dueDate < now ? 'overdue' : 'pending',
          notes: `Monthly rent for ${periodMonth}`,
          createdAt: new Date().toISOString(),
        });
        createdCount++;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (createdCount > 0 && typeof persistMockData === 'function') persistMockData();
    const agrPayments = mockStore.payments.filter((p) => String(p.agreementId) === agreementId);
    return { created: createdCount, payments: agrPayments };
  }

  // ─── MONGOOSE DB MODE ───
  let createdCount = 0;

  // 1. Initial Security Deposit
  if (depositAmount > 0) {
    const depositExists = await TenantPayment.exists({ agreementId, paymentType: 'deposit' });
    if (!depositExists) {
      const depositDueDate = new Date(startDate);
      await TenantPayment.create({
        agreementId,
        tenantId,
        landlordId,
        propertyId: propId,
        paymentType: 'deposit',
        periodMonth: 'Security Deposit',
        dueDate: depositDueDate,
        amountDue: depositAmount,
        balance: depositAmount,
        currency: 'ETB',
        status: depositDueDate < now ? 'overdue' : 'pending',
        notes: 'Refundable security deposit held in escrow',
      });
      createdCount++;
    }
  }

  // 2. Monthly Rent Schedule across lease term
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= endDate) {
    const periodMonth = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const exists = await TenantPayment.exists({ agreementId, paymentType: 'rent', periodMonth });
    if (!exists && rentAmount > 0) {
      const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), dueDay);
      await TenantPayment.create({
        agreementId,
        tenantId,
        landlordId,
        propertyId: propId,
        paymentType: 'rent',
        periodMonth,
        dueDate,
        amountDue: rentAmount,
        balance: rentAmount,
        currency: 'ETB',
        status: dueDate < now ? 'overdue' : 'pending',
        notes: `Monthly rent for ${periodMonth}`,
      });
      createdCount++;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const payments = await TenantPayment.find({ agreementId }).sort({ dueDate: 1 }).lean();
  return { created: createdCount, payments };
}

module.exports = {
  generateRentScheduleForAgreement,
};
