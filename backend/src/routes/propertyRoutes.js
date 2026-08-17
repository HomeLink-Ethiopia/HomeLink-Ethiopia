const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
    createProperty,
    getMyProperties,
    getPropertyById
} = require('../controller/propertyController');

router.post(
    '/',
    authMiddleware,
    roleMiddleware('landlord'),
    createProperty
);

router.get(
    '/my',
    authMiddleware,
    roleMiddleware('landlord'),
    getMyProperties
);

router.get(
    '/:id',
    authMiddleware,
    getPropertyById
);

module.exports = router;
