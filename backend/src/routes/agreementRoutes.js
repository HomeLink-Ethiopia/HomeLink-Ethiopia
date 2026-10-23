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

// Confirm a signature (tenant OR landlord) — POST and PUT /api/v1/agreements/:id/confirm
router.put('/:id/confirm', authMiddleware, wrapList, signAgreement);
router.post('/:id/confirm', authMiddleware, wrapList, signAgreement);

// ─── Sprint 8: CRUD ───
router.post('/', authMiddleware, roleMiddleware('landlord'), wrapList, createAgreement);
router.get('/:id', authMiddleware, wrapList, getAgreementById);
router.delete('/:id', authMiddleware, terminateAgreement);

// List-all fallback (getAgreements infers role from the token)
router.get('/', authMiddleware, wrapList, getAgreements);

module.exports = router;
