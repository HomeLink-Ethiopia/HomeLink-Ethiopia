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
    setPrimaryImage
} = require('../controller/propertyController');

router.get('/my', authMiddleware, roleMiddleware('landlord'), getMyProperties);

router.post(
    '/:id/images',
    authMiddleware,
    roleMiddleware('landlord'),
    (req, res, next) => {
        console.log('--- UPLOAD DEBUG ---');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Content-Length:', req.headers['content-length']);
        upload.array('images', 10)(req, res, (err) => {
            if (err) {
                console.log('Multer error:', err.message);
                return res.status(400).json({ message: err.message || 'File upload failed' });
            }
            console.log('Files received:', req.files ? req.files.length : 0);
            console.log('Body:', req.body);
            next();
        });
    },
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

router.post('/', authMiddleware, roleMiddleware('landlord'), createProperty);
router.get('/:id', authMiddleware, getPropertyById);
router.put('/:id', authMiddleware, roleMiddleware('landlord'), updateProperty);
router.delete('/:id', authMiddleware, roleMiddleware('landlord'), deleteProperty);

module.exports = router;