const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');

const createProperty = async (req, res) => {
    try {
        const userId = req.user.id;
         console.log('📸 Upload request received');
        console.log('📁 req.files:', req.files);
        console.log('📝 req.body:', req.body);
        console.log('📋 req.headers.content-type:', req.headers['content-type']);
        
        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });

        if (!landlordProfile) {
            return res.status(404).json({
                message: 'Landlord profile not found. Please complete your landlord registration.'
            });
        }

        if (landlordProfile.verificationStatus !== 'verified') {
            return res.status(403).json({
                message: 'Your landlord account is not verified. Please complete verification first.'
            });
        }

        const property = await Property.create({
            landlordId: landlordProfile._id,
            ...req.body
        });

        await LandlordProfile.findByIdAndUpdate(
            landlordProfile._id,
            { $inc: { verifiedPropertiesCount: 1 } }
        );

        res.status(201).json({
            message: 'Property created successfully',
            data: property
        });

    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMyProperties = async (req, res) => {
    try {
        const userId = req.user.id;

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });

        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        const properties = await Property.find({ landlordId: landlordProfile._id })
            .sort({ createdAt: -1 });

        res.status(200).json({ data: properties });

    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPropertyById = async (req, res) => {
    try {
        const { id } = req.params;

        const property = await Property.findById(id);

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        res.status(200).json({ data: property });

    } catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const updateData = req.body;

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        if (property.landlordId.toString() !== landlordProfile._id.toString()) {
            return res.status(403).json({ message: 'You do not own this property' });
        }

        const updatedProperty = await Property.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: 'Property updated successfully',
            data: updatedProperty
        });

    } catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        if (property.landlordId.toString() !== landlordProfile._id.toString()) {
            return res.status(403).json({ message: 'You do not own this property' });
        }

        await Property.findByIdAndDelete(id);

        await LandlordProfile.findByIdAndUpdate(
            landlordProfile._id,
            { $inc: { verifiedPropertiesCount: -1 } }
        );

        res.status(200).json({ message: 'Property deleted successfully' });

    } catch (error) {
        console.error('Delete property error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const uploadPropertyImages = async (req, res) => {
    try {
        console.log('📸 Upload request received');
        console.log('📁 req.files:', req.files);
        console.log('📝 req.body:', req.body);
        console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
        const { id } = req.params;
        const userId = req.user.id;

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        if (property.landlordId.toString() !== landlordProfile._id.toString()) {
            return res.status(403).json({ message: 'You do not own this property' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No images uploaded' });
        }

        const imageEntries = req.files.map((file, index) => ({
            key: file.filename,
            url: `/uploads/${file.filename}`,
            isPrimary: property.images.length === 0 && index === 0,
            uploadedAt: new Date()
        }));

        property.images.push(...imageEntries);
        await property.save();

        res.status(200).json({
            message: `${req.files.length} image(s) uploaded successfully`,
            data: {
                propertyId: property._id,
                images: property.images,
                totalImages: property.images.length
            }
        });

    } catch (error) {
        console.error('Upload property images error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deletePropertyImage = async (req, res) => {
    try {
        const { id, imageId } = req.params;
        const userId = req.user.id;

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        if (property.landlordId.toString() !== landlordProfile._id.toString()) {
            return res.status(403).json({ message: 'You do not own this property' });
        }

        const imageIndex = property.images.findIndex(img => img._id.toString() === imageId);
        if (imageIndex === -1) {
            return res.status(404).json({ message: 'Image not found' });
        }

        property.images.splice(imageIndex, 1);

        if (property.images.length > 0 && !property.images.some(img => img.isPrimary)) {
            property.images[0].isPrimary = true;
        }

        await property.save();

        res.status(200).json({
            message: 'Image deleted successfully',
            data: {
                propertyId: property._id,
                images: property.images,
                totalImages: property.images.length
            }
        });

    } catch (error) {
        console.error('Delete property image error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const setPrimaryImage = async (req, res) => {
    try {
        const { id, imageId } = req.params;
        const userId = req.user.id;

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        if (!landlordProfile) {
            return res.status(404).json({ message: 'Landlord profile not found' });
        }

        if (property.landlordId.toString() !== landlordProfile._id.toString()) {
            return res.status(403).json({ message: 'You do not own this property' });
        }

        const image = property.images.find(img => img._id.toString() === imageId);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        property.images.forEach(img => img.isPrimary = false);
        image.isPrimary = true;

        await property.save();

        res.status(200).json({
            message: 'Primary image updated successfully',
            data: {
                propertyId: property._id,
                primaryImage: image.url,
                images: property.images
            }
        });

    } catch (error) {
        console.error('Set primary image error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createProperty,
    getMyProperties,
    getPropertyById,
    updateProperty,
    deleteProperty,
    uploadPropertyImages,
    deletePropertyImage,
    setPrimaryImage
};
