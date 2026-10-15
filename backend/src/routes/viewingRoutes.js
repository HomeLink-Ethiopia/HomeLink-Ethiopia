const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
    requestViewing,
    getTenantViewings,
    getLandlordViewings,
    getMyViewings,
    cancelViewing,
    acceptViewing,
    rejectViewing,
    rescheduleViewing,
    completeViewing,
    markNoShow
} = require('../controller/viewingController');

// Tenant & General Routes
router.post('/', authMiddleware, roleMiddleware('tenant'), requestViewing);
router.get('/my', authMiddleware, getMyViewings);
router.get('/my-requests', authMiddleware, roleMiddleware('tenant'), getTenantViewings);

// Landlord Routes
router.get('/landlord', authMiddleware, roleMiddleware('landlord'), getLandlordViewings);
router.get('/my-properties', authMiddleware, roleMiddleware('landlord'), getLandlordViewings);

// Actions (accept, reject, reschedule, complete, no-show, cancel)
router.post('/:id/cancel', authMiddleware, cancelViewing);
router.put('/:id/cancel', authMiddleware, cancelViewing);

router.put('/:id/accept', authMiddleware, roleMiddleware('landlord'), acceptViewing);
router.post('/:id/accept', authMiddleware, roleMiddleware('landlord'), acceptViewing);

router.put('/:id/reject', authMiddleware, roleMiddleware('landlord'), rejectViewing);
router.post('/:id/reject', authMiddleware, roleMiddleware('landlord'), rejectViewing);

router.put('/:id/reschedule', authMiddleware, roleMiddleware('landlord'), rescheduleViewing);
router.post('/:id/reschedule', authMiddleware, roleMiddleware('landlord'), rescheduleViewing);

router.put('/:id/complete', authMiddleware, roleMiddleware('landlord'), completeViewing);
router.post('/:id/complete', authMiddleware, roleMiddleware('landlord'), completeViewing);

router.put('/:id/no-show', authMiddleware, roleMiddleware('landlord'), markNoShow);
router.post('/:id/no-show', authMiddleware, roleMiddleware('landlord'), markNoShow);

module.exports = router;
