const express = require('express');
const router = express.Router();

const paymentController = require('../controller/paymentController');
const authModule = require('../middleware/authMiddleware');

const authenticate =
    typeof authModule === 'function'
        ? authModule
        : authModule.protect || authModule.authenticate || authModule.verifyToken;

if (typeof authenticate !== 'function') {
    throw new Error('Payment routes: could not resolve auth middleware export.');
}

router.use(authenticate);

// ─── 1. SPECIFIC / STATIC ROUTES FIRST ──────────────────────────────────────

// GET  /api/v1/payments/                 — list all payments for the caller
router.get('/', paymentController.getPayments);

// POST /api/v1/payments/invoices          — landlord creates an invoice
router.post('/invoices', paymentController.generateInvoice);

// GET  /api/v1/payments/chapa/verify/:tx_ref  — verify a Chapa payment by tx_ref
// NOTE: Must be registered BEFORE /:id to avoid tx_ref being captured as id
router.get('/chapa/verify/:tx_ref', paymentController.verifyChapaPayment);

// ─── 2. PARAMETERISED ID ROUTES LAST ────────────────────────────────────────

// GET  /api/v1/payments/:id              — get a specific payment
router.get('/:id', paymentController.getPaymentById);

// POST /api/v1/payments/:id/chapa/initialize  — tenant starts a Chapa checkout
router.post('/:id/chapa/initialize', paymentController.initializeChapaPayment);

// POST /api/v1/payments/:id/record       — tenant uploads manual payment proof
router.post('/:id/record', paymentController.recordPayment);

// POST /api/v1/payments/:id/verify       — landlord confirms manual payment
router.post('/:id/verify', paymentController.verifyPayment);

// POST /api/v1/payments/:id/reminder     — landlord sends payment reminder
router.post('/:id/reminder', paymentController.sendReminder);

module.exports = router;
