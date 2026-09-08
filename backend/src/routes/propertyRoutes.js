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
    getRecommendations     
} = require('../controller/propertyController');

console.log('✅ Property routes loaded');


router.get('/search', searchProperties);

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
router.get('/:id', authMiddleware, getPropertyById);
router.put('/:id', authMiddleware, roleMiddleware('landlord'), updateProperty);
router.delete('/:id', authMiddleware, roleMiddleware('landlord'), deleteProperty);

module.exports = router;