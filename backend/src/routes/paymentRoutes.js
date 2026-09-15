const express = require('express');
const router = express.Router();

// Placeholder routes for Payments (Sprint 7 WIP)
router.get('/', (req, res) => {
    res.json({ message: 'Payments endpoint ready' });
});

module.exports = router;
