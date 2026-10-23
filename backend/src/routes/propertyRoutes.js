const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require("../middleware/upload");

const {
    createProperty,
    getMyProperties,
    getPropertyById,
    updateProperty,
    deleteProperty,
    uploadPropertyImages,
    deletePropertyImage,
    setPrimaryImage,
    searchProperties,
    favouriteProperty,
    unfavouriteProperty,
    getMyFavourite,        
    savePreferences,        
    getPreferences,         
    updatePreferences,
    getRecommendations,
    estimateRent
} = require('../controller/propertyController');

console.log('✅ Property routes loaded');

// ─── AI PROPERTY ESTIMATION ───
router.post('/estimate-rent', estimateRent);

router.get('/search', searchProperties);

// Admin alias: GET /api/v1/properties/all — every listing for risk monitoring.
router.get('/all', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { isMockMode, mockStore } = require('../config/db');
    if (isMockMode()) return res.status(200).json({ data: mockStore.properties || [] });
    const Property = require('../models/Property');
    const props = await Property.find({}).sort({ createdAt: -1 });
    res.status(200).json({ data: props });
  } catch (error) {
    console.error('Get all properties (admin) error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/my', authMiddleware, roleMiddleware('landlord'), getMyProperties);

router.post('/preferences', authMiddleware, roleMiddleware('tenant'), savePreferences);
router.get('/preferences', authMiddleware, roleMiddleware('tenant'), getPreferences);
router.put('/preferences', authMiddleware, roleMiddleware('tenant'), updatePreferences);


//recommendation
router.get('/recommendations', authMiddleware, roleMiddleware('tenant'), getRecommendations);
router.get('/favourites', authMiddleware, roleMiddleware('tenant'), getMyFavourite);



router.post(
    '/:id/images',
    authMiddleware,
    roleMiddleware('landlord'),
    upload.array('images', 10),
    uploadPropertyImages
);

router.delete(
    '/:id/images/:imageId',
    authMiddleware,
    roleMiddleware('landlord'),
    deletePropertyImage
);

router.put(
    '/:id/images/:imageId/primary',
    authMiddleware,
    roleMiddleware('landlord'),
    setPrimaryImage
);


router.post('/:id/favourite', authMiddleware, roleMiddleware('tenant'), favouriteProperty);
router.delete('/:id/favourite', authMiddleware, roleMiddleware('tenant'), unfavouriteProperty);


router.post('/', authMiddleware, roleMiddleware('landlord'), createProperty);
// Public: tenants browse property details without an account (matches /search)
router.get('/:id', getPropertyById);
router.put('/:id', authMiddleware, roleMiddleware('landlord'), updateProperty);
router.delete('/:id', authMiddleware, roleMiddleware('landlord'), deleteProperty);

module.exports = router;