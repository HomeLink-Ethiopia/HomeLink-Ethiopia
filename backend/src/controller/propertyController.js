const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Favourite = require('../models/Favourite');
const TenantPreference = require('../models/TenantPreference');
const aiService = require('../services/aiService');

const createProperty = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📸 Property create request received');
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

        // ─── AI FRAUD DETECTION HOOK ───
        let fraudRiskScore = 0.05;
        let riskLevel = 'low';
        let redFlags = [];

        try {
            const subCity = req.body.location?.subCity || req.body.subCity || 'Bole';
            const fraudResult = await aiService.detectFraud({
                listing_id: `prop-${Date.now()}`,
                price_etb: Number(req.body.rentAmount || 0),
                bedrooms: Number(req.body.bedrooms || 1),
                bathrooms: Number(req.body.bathrooms || 1),
                area_sqm: Number(req.body.sizeM2 || req.body.area_sqm || 50),
                subcity: subCity,
                description: req.body.description || '',
                contact_info: req.user?.email || ''
            });

            if (fraudResult && typeof fraudResult.risk_score === 'number') {
                fraudRiskScore = fraudResult.risk_score;
                riskLevel = fraudResult.risk_level || 'low';
                redFlags = fraudResult.red_flags || [];
                console.log(`🛡️ AI Fraud Check: risk_score=${fraudRiskScore} (${riskLevel})`);
            }
        } catch (aiErr) {
            console.warn('⚠️ AI Fraud Detection fallback (service offline or error):', aiErr.message);
        }

        const property = await Property.create({
            landlordId: landlordProfile._id,
            ...req.body,
            fraudRiskScore,
            riskLevel,
            redFlags
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


// =========================
// SAVE PREFERENCES
// =========================

const savePreferences = async (req, res) => {
    try {
        const tenantId = req.user.id;
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

        console.log('📝 Saving preferences for tenant:', tenantId);

        // Validate required fields
        if (!budget || !location || !propertyType) {
            return res.status(400).json({
                message: 'Budget, location, and property type are required'
            });
        }

        // ─── CHECK IF PREFERENCES EXIST ───
        let preferences = await TenantPreference.findOne({ tenantId });

        if (preferences) {
            // ─── UPDATE EXISTING ───
            preferences.budget = budget;
            preferences.location = location;
            preferences.propertyType = propertyType;
            preferences.bedrooms = bedrooms || 0;
            preferences.bathrooms = bathrooms || 0;
            preferences.amenities = amenities || [];
            preferences.furnished = furnished || false;
            preferences.moveInDate = moveInDate || null;
            preferences.updatedAt = new Date();

            await preferences.save();

            console.log('✅ Preferences updated for tenant:', tenantId);

            return res.status(200).json({
                message: 'Preferences updated successfully',
                data: preferences
            });
        }

        // ─── CREATE NEW ───
        preferences = await TenantPreference.create({
            tenantId,
            budget,
            location,
            propertyType,
            bedrooms: bedrooms || 0,
            bathrooms: bathrooms || 0,
            amenities: amenities || [],
            furnished: furnished || false,
            moveInDate: moveInDate || null
        });

        console.log('✅ Preferences created for tenant:', tenantId);

        res.status(201).json({
            message: 'Preferences saved successfully',
            data: preferences
        });

    } catch (error) {
        console.error('❌ Save preferences error:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
};

const getPreferences = async (req, res) => {
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


const updatePreferences = async (req,res) =>{
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

// =========================
// ESTIMATE RENT (AI MICROSERVICE)
// =========================
const estimateRent = async (req, res) => {
    try {
        const {
            subCity,
            subcity,
            bedrooms,
            bathrooms,
            area_sqm,
            sizeM2,
            has_water_tank,
            has_generator,
            is_furnished,
            furnished,
            amenities
        } = req.body;

        const resolvedSubcity = subCity || subcity || (req.body.location && req.body.location.subCity) || 'Bole';
        const resolvedBeds = Number(bedrooms !== undefined ? bedrooms : 2);
        const resolvedBaths = Number(bathrooms !== undefined ? bathrooms : 1);
        const resolvedArea = Number(area_sqm !== undefined ? area_sqm : (sizeM2 || 75));

        const amenityList = Array.isArray(amenities) ? amenities.map(a => String(a).toLowerCase()) : [];
        const resolvedWaterTank = has_water_tank !== undefined 
            ? Boolean(has_water_tank) 
            : (amenityList.some(a => a.includes('water')) || false);
        const resolvedGenerator = has_generator !== undefined 
            ? Boolean(has_generator) 
            : (amenityList.some(a => a.includes('generator')) || false);
        const resolvedFurnished = is_furnished !== undefined 
            ? Boolean(is_furnished) 
            : (furnished !== undefined ? Boolean(furnished) : false);

        const prediction = await aiService.estimateRent({
            subcity: resolvedSubcity,
            bedrooms: resolvedBeds,
            bathrooms: resolvedBaths,
            area_sqm: resolvedArea,
            has_water_tank: resolvedWaterTank,
            has_generator: resolvedGenerator,
            is_furnished: resolvedFurnished
        });

        const fairRent = prediction.estimated_rent_etb;
        const lowRent = Math.round(fairRent * 0.88);
        const highRent = Math.round(fairRent * 1.15);

        res.status(200).json({
            success: true,
            data: {
                ...prediction,
                low_etb: lowRent,
                fair_etb: fairRent,
                high_etb: highRent,
                estimate: {
                    low: lowRent,
                    fair: fairRent,
                    high: highRent
                }
            }
        });
    } catch (error) {
        console.warn('⚠️ AI Rent Estimation fallback:', error.message);
        const resolvedArea = Number(req.body.area_sqm || req.body.sizeM2 || 75);
        const fallbackRent = Math.round(resolvedArea * 280);
        res.status(200).json({
            success: true,
            data: {
                estimated_rent_etb: fallbackRent,
                confidence: 0.50,
                model_used: "Heuristic Fallback (AI Offline)",
                model_version: "fallback-1.0",
                low_etb: Math.round(fallbackRent * 0.85),
                fair_etb: fallbackRent,
                high_etb: Math.round(fallbackRent * 1.15),
                estimate: {
                    low: Math.round(fallbackRent * 0.85),
                    fair: fallbackRent,
                    high: Math.round(fallbackRent * 1.15)
                }
            }
        });
    }
};

// =========================
// GET AI RECOMMENDATIONS
// =========================
const getRecommendations = async (req, res) => {
    try {
        const tenantId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        // 1. Get tenant preferences
        const preferences = await TenantPreference.findOne({ tenantId });

        if (!preferences) {
            return res.status(404).json({
                message: 'Please set your preferences first'
            });
        }

        // 2. Get all active, verified properties
        const properties = await Property.find({
            listingStatus: 'active',
            verificationStatus: 'verified'
        }).lean();

        if (properties.length === 0) {
            return res.status(200).json({
                data: [],
                total: 0,
                message: 'No properties available'
            });
        }

        // 3. Attempt AI microservice recommendation scoring with candidate properties
        let scoredProperties = [];

        try {
            const candidateList = properties.map(p => ({
                property_id: String(p._id),
                price_etb: p.rentAmount || 0,
                bedrooms: p.bedrooms || 1,
                bathrooms: p.bathrooms || 1,
                area_sqm: p.sizeM2 || 50,
                subcity: p.location?.subCity || p.subCity || 'Bole',
                is_furnished: Boolean(p.furnished)
            }));

            let preferredSubcities = [];
            if (preferences.location) {
                if (Array.isArray(preferences.location)) {
                    preferredSubcities = preferences.location;
                } else if (typeof preferences.location === 'string') {
                    preferredSubcities = [preferences.location];
                } else if (preferences.location.subCity) {
                    preferredSubcities = [preferences.location.subCity];
                } else if (preferences.location.city) {
                    preferredSubcities = [preferences.location.city];
                }
            }

            const maxBudget = (preferences.budget && preferences.budget.max) || 100000;

            const aiResponse = await aiService.getRecommendations({
                max_budget_etb: maxBudget,
                preferred_subcities: preferredSubcities,
                min_bedrooms: preferences.bedrooms || 1,
                min_bathrooms: preferences.bathrooms || 1,
                require_furnished: preferences.furnished,
                limit: properties.length,
                candidate_properties: candidateList
            });

            if (aiResponse && Array.isArray(aiResponse.recommendations) && aiResponse.recommendations.length > 0) {
                const propertyMap = new Map(properties.map(p => [String(p._id), p]));
                scoredProperties = aiResponse.recommendations
                    .map(rec => {
                        const original = propertyMap.get(String(rec.property_id));
                        if (!original) return null;
                        return {
                            ...original,
                            matchScore: Math.round(rec.match_score),
                            matchReasons: rec.match_reasons || ['AI matched listing']
                        };
                    })
                    .filter(Boolean);
            }
        } catch (aiErr) {
            console.warn('⚠️ AI Recommendation Service fallback to heuristic scoring:', aiErr.message);
        }

        // 4. Fallback to heuristic scoring if AI returned no scored items
        if (scoredProperties.length === 0) {
            scoredProperties = properties.map(property => {
                let score = 0;
                const reasons = [];

                // BUDGET MATCH (25%) ───
                if (preferences.budget) {
                    const price = property.rentAmount;
                    const min = preferences.budget.min || 0;
                    const max = preferences.budget.max || 100000;

                    if (price >= min && price <= max) {
                        score += 0.25;
                        reasons.push('✅ Within budget');
                    } else if (price < min) {
                        score += 0.10;
                        reasons.push('💰 Below budget');
                    } else if (price > max) {
                        score += 0.05;
                        reasons.push('⚠️ Above budget');
                    }
                }

                // LOCATION MATCH (25%) ───
                if (preferences.location && preferences.location.city) {
                    const prefCity = preferences.location.city.toLowerCase();
                    const propCity = property.location?.city?.toLowerCase() || '';

                    if (propCity === prefCity) {
                        score += 0.25;
                        reasons.push('📍 Preferred city');
                    } else if (propCity.includes(prefCity) || prefCity.includes(propCity)) {
                        score += 0.15;
                        reasons.push('📍 Nearby preferred city');
                    }
                }

                // PROPERTY TYPE MATCH (15%) ───
                if (preferences.propertyType && property.propertyType === preferences.propertyType) {
                    score += 0.15;
                    reasons.push('🏠 Preferred property type');
                }

                // BEDROOMS MATCH (15%) ───
                if (preferences.bedrooms && property.bedrooms === preferences.bedrooms) {
                    score += 0.15;
                    reasons.push('🛏️ Matches bedroom requirement');
                } else if (preferences.bedrooms && property.bedrooms >= preferences.bedrooms) {
                    score += 0.08;
                    reasons.push(`🛏️ ${property.bedrooms} bedrooms (needed ${preferences.bedrooms})`);
                }

                // AMENITIES MATCH (10%) ───
                if (preferences.amenities && preferences.amenities.length > 0) {
                    const matched = property.amenities.filter(a =>
                        preferences.amenities.includes(a)
                    ).length;
                    const ratio = matched / preferences.amenities.length;
                    score += ratio * 0.10;
                    if (ratio > 0) {
                        reasons.push(`🔧 ${Math.round(ratio * 100)}% of amenities matched`);
                    }
                }

                // FURNISHED MATCH (BONUS 5%) ───
                if (preferences.furnished !== undefined && property.furnished === preferences.furnished) {
                    score += 0.05;
                    reasons.push(preferences.furnished ? '🛋️ Furnished' : '🪑 Unfurnished');
                }

                score = Math.min(score, 1);

                return {
                    ...property,
                    matchScore: Math.round(score * 100),
                    matchReasons: reasons.length > 0 ? reasons : ['Available now']
                };
            });

            scoredProperties.sort((a, b) => b.matchScore - a.matchScore);
        }

        // 5. Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const paginated = scoredProperties.slice(skip, skip + limitNum);

        res.status(200).json({
            data: paginated,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: scoredProperties.length,
                totalPages: Math.ceil(scoredProperties.length / limitNum)
            }
        });

    } catch (error) {
        console.error('❌ Recommendations error:', error);
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
    setPrimaryImage,
    searchProperties,
    favouriteProperty,
    unfavouriteProperty,
    getMyFavourite,
    savePreferences,
    getPreferences,
    updatePreferences,
    getRecommendations,
    estimateRent,
};
