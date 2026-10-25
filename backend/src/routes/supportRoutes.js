const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { isMockMode, mockStore, persistMockData } = require('../config/db');

// Ensure initial seed support messages for real Ethiopian platform operations
const initSupportMessages = () => {
    if (!mockStore.supportMessages || mockStore.supportMessages.length === 0) {
        mockStore.supportMessages = [
            {
                _id: 'mock-sup-1',
                name: 'Dawit Hailu',
                email: 'dawit.hailu@gmail.com',
                phone: '+251 91 144 8822',
                subject: 'Telebirr payment confirmation inquiry',
                message: 'I completed rent payment via Telebirr for the Bole apartment listing TX-TB-202610-01. When will the official stamped receipt be issued in my dashboard?',
                status: 'open',
                createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
            },
            {
                _id: 'mock-sup-2',
                name: 'Selamawit Tadesse',
                email: 'selam.tadesse@yahoo.com',
                phone: '+251 92 334 5566',
                subject: 'Fayda National ID verification timeline',
                message: 'Hello HomeLink Admin, I submitted my Fayda National ID and Kebele registration card yesterday for my landlord account. How long does the verification review usually take?',
                status: 'new',
                createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
            },
            {
                _id: 'mock-sup-3',
                name: 'Alemayehu Mengistu',
                email: 'alemayehu.m@gmail.com',
                phone: '+251 93 555 7788',
                subject: 'Addis Ababa residential tenancy agreement renewal',
                message: 'Our 1-year residential lease in CMC St. Michael is expiring next month. Both tenant and I agreed to renew at a 10% rent adjustment. How do we update the digital agreement terms on HomeLink?',
                status: 'in_progress',
                createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
            }
        ];
    }
};
initSupportMessages();

// Admin: Get all support requests
router.get('/requests', authMiddleware, roleMiddleware('admin'), (req, res) => {
    initSupportMessages();
    res.status(200).json({ data: mockStore.supportMessages || [] });
});

router.get('/', authMiddleware, roleMiddleware('admin'), (req, res) => {
    initSupportMessages();
    res.status(200).json({ data: mockStore.supportMessages || [] });
});

// Admin: Update support request status
router.put('/requests/:id', authMiddleware, roleMiddleware('admin'), (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    initSupportMessages();
    const item = (mockStore.supportMessages || []).find(m => String(m._id) === String(id));
    if (!item) {
        return res.status(404).json({ message: 'Support request not found' });
    }
    if (status) item.status = status;
    item.updatedAt = new Date().toISOString();
    if (typeof persistMockData === 'function') persistMockData();
    res.status(200).json({ message: 'Support request updated', data: item });
});

// Public / User: Submit a contact / support inquiry
router.post('/requests', (req, res) => {
    initSupportMessages();
    const { name, email, phone, subject, message } = req.body;
    const newItem = {
        _id: 'mock-sup-' + Date.now(),
        name: name || 'HomeLink User',
        email: email || 'user@homelink.test',
        phone: phone || '',
        subject: subject || 'General Inquiry',
        message: message || '',
        status: 'new',
        createdAt: new Date().toISOString()
    };
    mockStore.supportMessages.unshift(newItem);
    if (typeof persistMockData === 'function') persistMockData();
    res.status(201).json({ message: 'Support message received successfully', data: newItem });
});

router.post('/', (req, res) => {
    initSupportMessages();
    const { name, email, phone, subject, message } = req.body;
    const newItem = {
        _id: 'mock-sup-' + Date.now(),
        name: name || 'HomeLink User',
        email: email || 'user@homelink.test',
        phone: phone || '',
        subject: subject || 'General Inquiry',
        message: message || '',
        status: 'new',
        createdAt: new Date().toISOString()
    };
    mockStore.supportMessages.unshift(newItem);
    if (typeof persistMockData === 'function') persistMockData();
    res.status(201).json({ message: 'Support message received successfully', data: newItem });
});

module.exports = router;
