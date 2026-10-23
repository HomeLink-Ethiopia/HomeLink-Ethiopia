const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const TenantPayment = require('../models/TenantPayment');
const RentalAgreement = require('../models/RentalAgreement');
const documentUpload = require('../middleware/documentUpload');
const {
    generateInvoice,
    recordPayment,
    verifyPayment,
    initializeChapaPayment,
    verifyChapaPayment,
    getPayments,
    getPaymentById,
    sendReminder,
    uploadPaymentReceipt,
} = require('../controller/paymentController');

// ─── Response shaping: frontend reads payment.amount / payment.status ───
const shapePayment = (p) => {
    const raw = p.toObject ? p.toObject() : p;
    return {
        ...raw,
        amount: raw.amountDue,
        amountDueEtb: raw.amountDue,
        paidDate: raw.paidAt,
    };
};

const wrapList = (req, res, next) => {
    const send = res.json.bind(res);
    res.json = (body) => {
        if (Array.isArray(body)) return send({ data: body.map(shapePayment) });
        if (body && body.invoice) return send({ data: shapePayment(body.invoice), message: body.message });
        if (body && body.payment) return send({ data: shapePayment(body.payment), message: body.message });
        return send(body);
    };
    next();
};

// ─── Tenant payments — GET /api/v1/payments/my
router.get('/my', authMiddleware, wrapList, getPayments);

// ─── Landlord payments — GET /api/v1/payments/landlord
router.get('/landlord', authMiddleware, wrapList, getPayments);

// ─── Payments for one agreement — GET /api/v1/payments/agreement/:agreementId
router.get('/agreement/:agreementId', authMiddleware, wrapList, async (req, res) => {
    try {
        const { isMockMode, mockStore } = require('../config/db');
        // Sprint 15: mock-mode rent schedule for an agreement.
        if (isMockMode()) {
            const list2 = (mockStore.payments || []).filter((p) => p.agreementId === req.params.agreementId);
            return res.status(200).json(list2.map(shapePayment));
        }
        const payments = await TenantPayment.find({ agreementId: req.params.agreementId })
            .populate('propertyId', 'title')
            .sort({ dueDate: -1 })
            .lean();
        res.status(200).json(payments.map(shapePayment));
    } catch (error) {
        console.error('payments/agreement error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── Smart one-click rent schedule — POST /api/v1/payments/generate/:agreementId
// Creates the monthly rent records for the whole lease term (idempotent:
// re-generating doesn't duplicate). Called by the landlord agreements page.
const { generateRentScheduleForAgreement } = require('../utils/rentScheduleHelper');

router.post('/generate/:agreementId', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
    try {
        const { isMockMode, mockStore } = require('../config/db');
        let agreement = null;
        if (isMockMode()) {
            agreement = (mockStore.agreements || []).find((a) => a._id === req.params.agreementId);
        } else {
            agreement = await RentalAgreement.findById(req.params.agreementId).populate('propertyId', 'title');
        }
        if (!agreement) return res.status(404).json({ message: 'Agreement not found' });

        const landlordId = typeof agreement.landlordId === 'object' ? agreement.landlordId._id : agreement.landlordId;
        if (String(landlordId) !== String(req.user.id) && !isMockMode()) {
            return res.status(403).json({ message: 'Unauthorized or agreement not found' });
        }

        const result = await generateRentScheduleForAgreement(agreement);

        res.status(201).json({
            message: result.created > 0 ? `Rent schedule created — ${result.created} record(s) created` : 'Rent schedule already up to date',
            created: result.created,
            data: (result.payments || []).map(shapePayment),
        });
    } catch (error) {
        console.error('generate schedule error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ─── Chapa online payment
router.post('/:id/chapa/initialize', authMiddleware, initializeChapaPayment);
router.get('/chapa/verify/:tx_ref', verifyChapaPayment);

// ─── Tenant uploads payment proof — POST /api/v1/payments/:id/pay
router.post('/:id/pay', authMiddleware, roleMiddleware('tenant'), recordPayment);

// ─── Landlord verifies the payment or updates status ───
router.put('/:id/verify', authMiddleware, roleMiddleware('landlord'), wrapList, verifyPayment);
router.put('/:id/status', authMiddleware, roleMiddleware('landlord'), wrapList, verifyPayment);

// ─── Upload real receipt file / proof ───
router.post('/:id/receipt', authMiddleware, documentUpload.single('receipt'), wrapList, uploadPaymentReceipt);

// ─── Landlord nudges the tenant — POST /api/v1/payments/:id/remind
router.post('/:id/remind', authMiddleware, roleMiddleware('landlord'), sendReminder);

// ─── Single payment + generic list
router.get('/:id', authMiddleware, wrapList, getPaymentById);
router.get('/', authMiddleware, wrapList, getPayments);

module.exports = router;
