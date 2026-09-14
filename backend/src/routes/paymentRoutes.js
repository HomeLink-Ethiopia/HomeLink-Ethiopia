const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload'); // Reuse for receipt images/PDFs

const {
    generateInvoice,
    recordPayment,
    verifyPayment,
    initializeChapaPayment,
    verifyChapaPayment,
    getPayments,
    getPaymentById,
    sendReminder
} = require('../controller/paymentController');

// Landlord generates a rent or deposit invoice
router.post('/invoice', authMiddleware, roleMiddleware('landlord'), generateInvoice);

// Tenant pays via receipt upload or by entering reference code
router.put('/:id/pay', authMiddleware, roleMiddleware('tenant'), documentUpload.single('receipt'), recordPayment);

// Landlord verifies a pending payment (uploaded receipt, rf code, or physical cash)
router.put('/:id/verify', authMiddleware, roleMiddleware('landlord'), verifyPayment);

// Chapa Integration
router.post('/:id/chapa-init', authMiddleware, roleMiddleware('tenant'), initializeChapaPayment);
router.get('/chapa-verify/:tx_ref', authMiddleware, roleMiddleware('tenant'), verifyChapaPayment);

// Both fetch payments
router.get('/', authMiddleware, roleMiddleware('tenant', 'landlord'), getPayments);
router.get('/:id', authMiddleware, roleMiddleware('tenant', 'landlord'), getPaymentById);

// Landlord sends a payment reminder
router.post('/:id/remind', authMiddleware, roleMiddleware('landlord'), sendReminder);

module.exports = router;
