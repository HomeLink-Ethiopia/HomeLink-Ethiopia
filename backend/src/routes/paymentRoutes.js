const express = require('express');
const router = express.Router();

const paymentController = require('../controller/paymentController');
const authModule = require('../middleware/authMiddleware');

const authenticate =
  typeof authModule === 'function'
    ? authModule
    : authModule.protect || authModule.authenticate || authModule.verifyToken;

if (typeof authenticate !== 'function') {
  throw new Error('Payment routes: check the authentication middleware export in src/middleware');
}

router.use(authenticate);

// ─── 1. SPECIFIC ROUTES (MUST BE FIRST) ───
// This is what your Tenant page is calling!
router.get('/my', paymentController.getPayments); 
router.get('/landlord', paymentController.getPayments); 
router.post('/invoices', paymentController.generateInvoice);
router.get('/agreement/:id', async (req, res, next) => {
    try {
        const TenantPayment = require('../models/TenantPayment');
        const payments = await TenantPayment.find({ agreementId: req.params.id });
        res.status(200).json({ data: payments });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching rent schedule' });
    }
});

// ─── 2. CHAPA INTEGRATION ───
router.post('/:id/chapa/initialize', paymentController.initializeChapaPayment);
router.get('/chapa/verify/:tx_ref', paymentController.verifyChapaPayment);

// ─── 3. MANUAL PAYMENTS ───
router.post('/:id/record', paymentController.recordPayment);
router.post('/:id/verify', paymentController.verifyPayment);
router.put('/:id/verify', paymentController.verifyPayment); 
router.post('/:id/reminder', paymentController.sendReminder);

// ─── 4. GENERIC ROUTES (MUST BE LAST) ───
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentById);

module.exports = router;