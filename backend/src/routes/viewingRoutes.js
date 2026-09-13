const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
    requestViewing,
    getTenantViewings,
    getLandlordViewings,
    acceptViewing,
    rejectViewing,
    rescheduleViewing
} = require('../controller/viewingController');

// Tenant Routes
router.post('/', authMiddleware, roleMiddleware('tenant'), requestViewing);
router.get('/my-requests', authMiddleware, roleMiddleware('tenant'), getTenantViewings);

// Landlord Routes
router.get('/my-properties', authMiddleware, roleMiddleware('landlord'), getLandlordViewings);
router.put('/:id/accept', authMiddleware, roleMiddleware('landlord'), acceptViewing);
router.put('/:id/reject', authMiddleware, roleMiddleware('landlord'), rejectViewing);
router.put('/:id/reschedule', authMiddleware, roleMiddleware('landlord'), rescheduleViewing);

module.exports = router;
