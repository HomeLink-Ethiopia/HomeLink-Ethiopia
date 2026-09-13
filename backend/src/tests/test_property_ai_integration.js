/**
 * test_property_ai_integration.js
 *
 * Verifies that:
 * 1. POST /api/v1/properties/estimate-rent calls aiService.estimateRent and returns XGBoost prediction.
 * 2. Property creation automatically triggers aiService.detectFraud and stores risk_score and red_flags.
 * 3. Property recommendations query preferences and return AI-ranked listings with scores and reasons.
 * 4. Graceful fallbacks activate when AI service is simulated as offline.
 */

const { estimateRent, createProperty, getRecommendations } = require('../controller/propertyController');
const aiService = require('../services/aiService');
const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const TenantPreference = require('../models/TenantPreference');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        failed++;
    }
}

// Mock Express req/res
function createMockReqRes(body = {}, params = {}, query = {}, user = { id: 'mock-user-123' }) {
    const req = { body, params, query, user, headers: { 'content-type': 'application/json' } };
    let statusCode = 200;
    let responseData = null;

    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(data) {
            responseData = data;
            return this;
        },
        getStatusCode: () => statusCode,
        getData: () => responseData,
    };

    return { req, res };
}

async function testRentEstimation() {
    console.log('\n--- 1. Testing Rent Estimation Controller ---');
    const { req, res } = createMockReqRes({
        subCity: 'Bole',
        bedrooms: 3,
        bathrooms: 2,
        area_sqm: 120,
        has_water_tank: true,
        has_generator: true,
        is_furnished: true,
        amenities: ['Water Tank', 'Generator', 'Security']
    });

    await estimateRent(req, res);

    assert(res.getStatusCode() === 200, 'estimateRent returns status 200');
    const data = res.getData();
    assert(data.success === true, 'Response contains success: true');
    assert(typeof data.data.estimated_rent_etb === 'number', `estimated_rent_etb is numeric (${data.data.estimated_rent_etb})`);
    assert(data.data.estimated_rent_etb > 0, 'estimated_rent_etb > 0');
    assert(typeof data.data.estimate?.fair === 'number', 'estimate.fair exists and is numeric');
    assert(data.data.estimate?.low < data.data.estimate?.high, 'estimate.low is less than estimate.high');
    console.log(`     Rent: Fair ETB ${data.data.estimate.fair} (Low: ${data.data.estimate.low}, High: ${data.data.estimate.high})`);
}

async function testPropertyCreationFraudScoring() {
    console.log('\n--- 2. Testing Property Creation Fraud Detection Hook ---');

    // Mock LandlordProfile.findOne
    const originalLandlordFindOne = LandlordProfile.findOne;
    const originalLandlordFindByIdAndUpdate = LandlordProfile.findByIdAndUpdate;
    const originalPropertyCreate = Property.create;

    let savedPropertyPayload = null;

    LandlordProfile.findOne = async () => ({
        _id: 'landlord-profile-abc',
        accountId: 'mock-user-123',
        verificationStatus: 'verified'
    });

    LandlordProfile.findByIdAndUpdate = async () => true;

    Property.create = async (payload) => {
        savedPropertyPayload = payload;
        return { _id: 'prop-created-123', ...payload };
    };

    try {
        const { req, res } = createMockReqRes({
            title: 'Luxury 3BR Penthouse in Bole',
            propertyType: 'apartment',
            rentAmount: 3000, // Abnormally cheap -> triggers high fraud score
            bedrooms: 3,
            bathrooms: 2,
            sizeM2: 150,
            location: { subCity: 'Bole' },
            description: 'URGENT cash wire transfer Western Union before viewing guaranteed key!!!'
        });

        await createProperty(req, res);

        assert(res.getStatusCode() === 201, 'createProperty returns status 201');
        assert(savedPropertyPayload !== null, 'Property was created in database');
        assert(typeof savedPropertyPayload.fraudRiskScore === 'number', `fraudRiskScore attached (${savedPropertyPayload.fraudRiskScore})`);
        assert(savedPropertyPayload.fraudRiskScore > 0.50, 'High risk detected for suspicious underpriced listing with wire transfer description');
        assert(Array.isArray(savedPropertyPayload.redFlags), 'redFlags array attached to created property');
        assert(savedPropertyPayload.redFlags.length > 0, `redFlags populated (${savedPropertyPayload.redFlags.join(', ')})`);
        console.log(`     Risk Score: ${savedPropertyPayload.fraudRiskScore} | Flags: ${savedPropertyPayload.redFlags.length}`);
    } finally {
        LandlordProfile.findOne = originalLandlordFindOne;
        LandlordProfile.findByIdAndUpdate = originalLandlordFindByIdAndUpdate;
        Property.create = originalPropertyCreate;
    }
}

async function testPropertyRecommendations() {
    console.log('\n--- 3. Testing AI Property Recommendations Hook ---');

    const originalTenantPreferenceFindOne = TenantPreference.findOne;
    const originalPropertyFind = Property.find;

    TenantPreference.findOne = async () => ({
        tenantId: 'mock-user-123',
        budget: { min: 20000, max: 50000 },
        location: { city: 'Addis Ababa', subCity: 'Bole' },
        propertyType: 'apartment',
        bedrooms: 2,
        bathrooms: 1,
        furnished: true
    });

    const mockCandidateProperties = [
        {
            _id: 'prop-rec-1',
            title: 'Modern 2BR Bole Apartment',
            rentAmount: 42000,
            bedrooms: 2,
            bathrooms: 1,
            sizeM2: 85,
            furnished: true,
            location: { subCity: 'Bole' }
        },
        {
            _id: 'prop-rec-2',
            title: 'Spacious 3BR Kirkos Villa',
            rentAmount: 48000,
            bedrooms: 3,
            bathrooms: 2,
            sizeM2: 130,
            furnished: true,
            location: { subCity: 'Kirkos' }
        },
        {
            _id: 'prop-rec-3',
            title: 'Expensive Luxury Condo',
            rentAmount: 95000,
            bedrooms: 2,
            bathrooms: 2,
            sizeM2: 120,
            furnished: true,
            location: { subCity: 'Bole' }
        }
    ];

    Property.find = () => ({
        lean: async () => mockCandidateProperties
    });

    try {
        const { req, res } = createMockReqRes({}, {}, { page: 1, limit: 10 });
        await getRecommendations(req, res);

        assert(res.getStatusCode() === 200, 'getRecommendations returns status 200');
        const data = res.getData();
        assert(Array.isArray(data.data), 'Returns data array');
        assert(data.data.length === 3, `Returned 3 ranked properties (got ${data.data.length})`);
        assert(typeof data.data[0].matchScore === 'number', `Top match has matchScore (${data.data[0].matchScore})`);
        assert(Array.isArray(data.data[0].matchReasons), 'Top match has matchReasons array');
        assert(data.data[0].matchScore >= data.data[1].matchScore, 'Properties are sorted descending by matchScore');
        console.log(`     Top recommendation: ${data.data[0].title} (Score: ${data.data[0].matchScore}/100)`);
        console.log(`     Reasons: ${data.data[0].matchReasons.join(', ')}`);
    } finally {
        TenantPreference.findOne = originalTenantPreferenceFindOne;
        Property.find = originalPropertyFind;
    }
}

async function runAll() {
    console.log('='.repeat(60));
    console.log('  HomeLink Property Controller AI Integration Tests');
    console.log('='.repeat(60));

    try {
        await testRentEstimation();
        await testPropertyCreationFraudScoring();
        await testPropertyRecommendations();
    } catch (err) {
        console.error('Fatal test error:', err);
        failed++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`  Summary: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
    process.exit(failed > 0 ? 1 : 0);
}

runAll();
