const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const RentalAgreement = require('../models/RentalAgreement');
const {
    createAgreement,
    signAgreement,
    getAgreements,
    getAgreementById,
    terminateAgreement,
    renewAgreement,
    proposeRenewal,
    respondToRenewal,
    suggestRenewalPrice,
} = require('../controller/agreementController');

// ─── Response shaping: map backend fields → the fields the frontend parses ───
// (status pending_signatures → pending_tenant/pending_landlord depending on
// who has signed; rentAmount → monthlyRentEtb; tenantSignedAt → tenantSigned)
const { STANDARD_RENTAL_TERMS } = require('../utils/rentalTerms');

const shapeForFrontend = (a) => {
    const raw = a.toObject ? a.toObject() : a;
    let status = raw.status;
    if (status === 'pending_signatures' || !status || status === 'draft') {
        if (!raw.landlordSignedAt) {
            status = 'pending_landlord';
        } else if (!raw.tenantSignedAt) {
            status = 'pending_tenant';
        } else {
            status = 'active';
        }
    }
    const terms = (Array.isArray(raw.terms) && raw.terms.length > 0)
        ? raw.terms
        : (raw.specialConditions ? [raw.specialConditions, ...STANDARD_RENTAL_TERMS.slice(0, 4)] : STANDARD_RENTAL_TERMS);

    return {
        ...raw,
        status,
        terms,
        depositAmount: raw.depositAmount !== undefined ? raw.depositAmount : (raw.rentAmount || 0),
        monthlyRentEtb: raw.rentAmount,
        tenantSigned: Boolean(raw.tenantSignedAt),
        landlordSigned: Boolean(raw.landlordSignedAt),
    };
};

const wrapList = (req, res, next) => {
    const send = res.json.bind(res);
    res.json = (body) => {
        if (Array.isArray(body)) {
            return send({ data: body.map(shapeForFrontend) });
        }
        if (body && body.agreement) {
            return send({ data: shapeForFrontend(body.agreement), message: body.message });
        }
        return send(body);
    };
    next();
};

// ─── Sprint 7: agreement workflow ───

// Tenant's agreements — GET /api/v1/agreements/my
router.get('/my', authMiddleware, roleMiddleware('tenant'), wrapList, (req, res, next) => {
    req.user.role = 'tenant';
    next();
}, getAgreements);

// Landlord's tenant directory — GET /api/v1/agreements/landlord/tenants
router.get('/landlord/tenants', authMiddleware, roleMiddleware('landlord'), async (req, res) => {
    try {
        const { isMockMode, mockStore } = require('../config/db');
        if (isMockMode()) {
            const landlordId = String(req.user.id || '');
            const foundUser = [...mockStore.users.values()].find(u => u._id === landlordId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeed = userEmail === 'dev.landlord@homelink.test';
            const isTsedenia = userEmail?.includes('tsedenia') || userEmail?.includes('kidstekinfe') || landlordId.includes('1793084104793') || landlordId.includes('1792917808150');
            const myAgreements = (mockStore.agreements || []).filter(a => {
                const lId = String((a.landlordId && a.landlordId._id) || a.landlordId || '');
                const isAgrTsedenia = lId.includes('1793084104793') || lId.includes('1792917808150') || (a.landlordId && a.landlordId.email && (a.landlordId.email.includes('tsedenia') || a.landlordId.email.includes('kidstekinfe')));
                return lId === landlordId || (isSeed && (lId === 'mock-landlord-1' || !lId)) || (isTsedenia && isAgrTsedenia);
            });

            const byTenant = new Map();
            for (const a of myAgreements) {
                const tid = String((a.tenantId && a.tenantId._id) || a.tenantId);
                if (!byTenant.has(tid)) {
                    byTenant.set(tid, {
                        _id: tid,
                        firstName: (a.tenantId && a.tenantId.firstName) || 'Tenant',
                        lastName: (a.tenantId && a.tenantId.lastName) || '',
                        email: (a.tenantId && a.tenantId.email) || '',
                        phone: (a.tenantId && a.tenantId.phone) || '',
                        properties: [],
                    });
                }
                byTenant.get(tid).properties.push({
                    _id: String((a.propertyId && a.propertyId._id) || a.propertyId),
                    agreementId: String(a._id),
                    title: (a.propertyId && a.propertyId.title) || 'Property',
                    rentAmount: a.rentAmount,
                    startDate: a.startDate,
                    agreementStatus: a.status,
                });
            }
            return res.status(200).json({ data: Array.from(byTenant.values()) });
        }
        const agreements = await RentalAgreement.find({ landlordId: req.user.id })
            .populate('tenantId', 'firstName lastName email phone')
            .populate('propertyId', 'title rentAmount')
            .sort({ createdAt: -1 });

        const byTenant = new Map();
        for (const a of agreements) {
            const tenantId = String(a.tenantId?._id || a.tenantId || '');
            if (!byTenant.has(tenantId)) {
                byTenant.set(tenantId, {
                    _id: tenantId,
                    firstName: a.tenantId?.firstName || '',
                    lastName: a.tenantId?.lastName || '',
                    email: a.tenantId?.email || '',
                    phone: a.tenantId?.phone || '',
                    properties: [],
                });
            }
            byTenant.get(tenantId).properties.push({
                _id: String(a.propertyId?._id || a.propertyId),
                agreementId: String(a._id),
                title: a.propertyId?.title || 'Property',
                rentAmount: a.rentAmount,
                startDate: a.startDate,
                agreementStatus: a.status,
            });
        }
        return res.status(200).json({ data: Array.from(byTenant.values()) });
    } catch (error) {
        console.error('Landlord tenants directory error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Landlord's agreements — GET /api/v1/agreements/landlord
router.get('/landlord', authMiddleware, roleMiddleware('landlord'), wrapList, (req, res, next) => {
    req.user.role = 'landlord';
    next();
}, getAgreements);

// Suggest a fair renewal price from market data — GET /api/v1/agreements/:id/renewal-price
router.get('/:id/renewal-price', authMiddleware, suggestRenewalPrice);

// Renewal proposals (Smart Lease Renewal — both roles use the same endpoints)
router.post('/:id/renewal', authMiddleware, proposeRenewal);
router.put('/:id/renewal/respond', authMiddleware, respondToRenewal);

// Kept for backwards compatibility with the earlier landlord-only renew
router.put('/:id/renew', authMiddleware, roleMiddleware('landlord'), renewAgreement);

// Confirm a signature (tenant OR landlord) — POST and PUT /api/v1/agreements/:id/confirm or /sign
router.put('/:id/confirm', authMiddleware, wrapList, signAgreement);
router.post('/:id/confirm', authMiddleware, wrapList, signAgreement);
router.put('/:id/sign', authMiddleware, wrapList, signAgreement);
router.post('/:id/sign', authMiddleware, wrapList, signAgreement);

// ─── Sprint 8: CRUD ───
router.post('/', authMiddleware, roleMiddleware('landlord'), wrapList, createAgreement);
router.get('/:id', authMiddleware, wrapList, getAgreementById);
router.delete('/:id', authMiddleware, terminateAgreement);

// List-all fallback (getAgreements infers role from the token)
router.get('/', authMiddleware, wrapList, getAgreements);

module.exports = router;
