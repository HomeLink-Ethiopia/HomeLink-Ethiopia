const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Favourite = require('../models/Favourite');
const TenantPreference = require('../models/TenantPreference');



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

const searchProperties = async (req, res) => {
    try {
        console.log('🔍 Search called with query:', req.query);
        
        const {
            city,
            subCity,
            propertyType,
            minPrice,
            maxPrice,
            bedrooms,
            bathrooms,
            amenities,
            furnished,
            verifiedOnly,
            sort,
            page,
            limit
        } = req.query;

        // ─── FIX: Convert and validate pagination ───
        const pageNum = parseInt(page) || 1;      // Default to 1
        const limitNum = parseInt(limit) || 10;   // Default to 10
        
        // ─── FIX: Validate numbers ───
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ message: 'Invalid page number' });
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ message: 'Limit must be between 1 and 100' });
        }

        // ─── BUILD QUERY ───
        const query = { listingStatus: 'active' };

        if (city) {
            query['location.city'] = { $regex: city, $options: 'i' };
        }
        if (subCity) {
            query['location.subCity'] = { $regex: subCity, $options: 'i' };
        }
        if (propertyType) {
            query.propertyType = propertyType;
        }
        if (minPrice || maxPrice) {
            query.rentAmount = {};
            if (minPrice) query.rentAmount.$gte = parseInt(minPrice);
            if (maxPrice) query.rentAmount.$lte = parseInt(maxPrice);
        }
        if (bedrooms) {
            query.bedrooms = parseInt(bedrooms);
        }
        if (bathrooms) {
            query.bathrooms = parseInt(bathrooms);
        }
        if (furnished !== undefined) {
            query.furnished = furnished === 'true';
        }
        if (verifiedOnly === 'true') {
            query.verificationStatus = 'verified';
        }

        // ─── SORTING ───
        let sortOption = { createdAt: -1 };
        switch (sort) {
            case 'price_low': sortOption = { rentAmount: 1 }; break;
            case 'price_high': sortOption = { rentAmount: -1 }; break;
            case 'newest': sortOption = { createdAt: -1 }; break;
            case 'oldest': sortOption = { createdAt: 1 }; break;
            default: sortOption = { createdAt: -1 };
        }

        // ─── PAGINATION ───
        const skip = (pageNum - 1) * limitNum;

        // ─── EXECUTE ───
        console.log('📊 Pagination:', { page: pageNum, limit: limitNum, skip });

        const properties = await Property.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await Property.countDocuments(query);

        res.status(200).json({
            data: properties,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasNext: skip + limitNum < total,
                hasPrev: pageNum > 1
            }
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
};

const favouriteProperty = async (req, res) => {

    try{
        const {id }= req.params;
        const tenantId = req.user.id;

        //check if the property exists

        const property = await Property.findById(id);
        if(!property){
            return res.status(404).json({
                message: 'Property not found'
            })
        }

        //check if already favourited

        const existingFavourite = await Favourite.findOne({
            tenantId,
            propertyId:id
        });

        if(existingFavourite){
            return res.status(400).json({
                message: 'Property already exists in favorites'
            });
        }

        await Favourite.create({
            tenantId,
            propertyId:id
        });

        await Property.findByIdAndUpdate(id, {
            $inc: {favouriteCount:1}
        });

        res.status(201).json({
            message: 'Property added to favorites',
            data: { propertyId: id }
        });
    } catch(error){
        console.error('Favourite property error:', error);
        res.status(500).json({message:'Server error'});
    }
};

const mongoose = require('mongoose');

const unfavouriteProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id;

        // ─── VALIDATE ID ───
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid property ID format' });
        }

        // Find and delete favourite
        const result = await Favourite.findOneAndDelete({
            tenantId: tenantId,
            propertyId: id
        });

        if (!result) {
            return res.status(404).json({ message: 'Favourite not found' });
        }

        // Decrement favourite count
        await Property.findByIdAndUpdate(id, { $inc: { favouriteCount: -1 } });

        res.status(200).json({
            message: 'Property unfavourited successfully',
            data: { propertyId: id }
        });

    } catch (error) {
        console.error('Unfavourite error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
const getMyFavourite = async (req, res) => {
    try{
        const tenantId = req.user.id;

        const favourites = await Favourite.find({tenantId})
            .populate('propertyId')
            .sort({ createdAt: -1 });
            
        const properties = favourites.map(f => f.propertyId);

        res.status(200).json({
            data: properties,
            total: properties.length
        });
    } catch(error){
        console.error('Get favourite properties error:', error);    
        res.status(500).json({message:'Server error'});
    }
}

const uploadPropertyImages = async (req, res) => {
    try {
        console.log('📸 Upload request received');
        console.log('📁 req.files:', req.files);
        console.log('📝 req.body:', req.body);
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



const savePreference = async (req ,res) =>{
    try{
        const tenantId= req.user.id;
        const {
            budget,
            location,
            propertyType,
            bedrooms,
            bathrooms,
            amenities,
            furnished,
            moveInDate
        } = req.body;

        if(!budget || !location || !propertyType){
            return res.status(400).json({
                message: 'Budget, location and property type are required'
            });
        }

        const preferences = await TenantPreference.findByIdAndUpdate(
            {tenantId},
            {
                tenantId,
                budget,
                location,
                propertyType,
                bedrooms: bedrooms || 0,
                bathrooms: bathrooms || 0,
                amenities: amenities || [],
                furnished: furnished || false,
                moveInDate: moveInDate || null,
                updatedAt: new Date()
            },

            {upsert: true, new: true, runValidators: true}
        );

        res.status(200).json({
            message: 'Preference saved successfully',
            data: preferences
        });
    }  catch(error){
        console.error('save preference error:', error);
        res.status(500).json({message:'Server error' });
    }
}


const getPreference = async (req, res) => {
    try{
        const tenantId = req.user.id;
        const preferences = await TenantPreference.findOne({ tenantId });

        if(!preferences){
            return res.status(404).json({
                message: 'No preferences found. Plese set your preferences'
            });
        }

        res.status(200).json({
            data: preferences
        });
    } catch(error){
        console.error('Get Preference error:', error);
        res.status(500).json({
            message:'Server error'
        });
    }
}


const updatePreference = async (req,res) =>{
    try{
        const tenantId = req.user.id;
        const updates = req.body;

        //find existing preference

        const existing =  await TenantPreference.findOne({ tenantId});

        if(!existing){
            return res.status(404).json({
                message:'No preference found. Please save preference first.'
            });
 } 
            //update only provided preference

            const updated =  await TenantPreference.findByIdAndUpdate(
                existing._id,
                {...updates, updatedAt: new Date()},
                {new: true, runValidators:true}
            );

            res.status(200).json({
                message:'Preference update successfully',
                date: updated
            });
       
    } catch(error){
        console.error('Update Preference error: ', error);
        res.status(500).json({
            message:'Seerver error'
        });
    }
}

module.exports = {
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
    savePreference,
    getPreference,
    updatePreference
};
