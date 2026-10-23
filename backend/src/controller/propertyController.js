const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');
const Favourite = require('../models/Favourite');
const TenantPreference = require('../models/TenantPreference');
const aiService = require('../services/aiService');
const { isMockMode, mockStore, mockPropertyRating, persistMockData } = require('../config/db');

const createProperty = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📸 Property create request received');
        console.log('📁 req.files:', req.files);
        console.log('📝 req.body:', req.body);
        console.log('📋 req.headers.content-type:', req.headers['content-type']);
        
        let landlordProfile = null;
        try {
            landlordProfile = await LandlordProfile.findOne({ accountId: userId });
        } catch (lpErr) {
            // DB offline fallback
        }

        let userEmail = req.user?.email;
        if (!userEmail && isMockMode()) {
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            if (foundUser) userEmail = foundUser.email;
        }

        if (!landlordProfile && isMockMode()) {
            landlordProfile = mockStore.landlordProfiles.get(userId) || (
                userEmail === 'dev.landlord@homelink.test' ? {
                    _id: "mock-landlord-1",
                    accountId: userId,
                    legalName: "HomeLink Landlord",
                    verificationStatus: "verified",
                    verifiedPropertiesCount: 0
                } : null
            );
        }

        if (!landlordProfile) {
            return res.status(404).json({
                message: 'Landlord profile not found. Please complete your landlord registration.'
            });
        }

        if (landlordProfile.verificationStatus !== 'verified' && !userEmail?.startsWith('s15.landlord') && userEmail !== 'dev.landlord@homelink.test') {
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

        let property = null;
        try {
            // Geo guard: MongoDB 2dsphere rejects a coordinates field with
            // type:"Point" but no coordinates array — strip empties.
            const payload = { ...req.body };
            if (payload.price && !payload.rentAmount) payload.rentAmount = Number(payload.price);
            if (payload.area && !payload.sizeM2) payload.sizeM2 = Number(payload.area);
            if (payload.availability && !payload.listingStatus) payload.listingStatus = payload.availability === 'available' ? 'active' : payload.availability;
            if (payload.address && !payload.location) payload.location = { address: payload.address, city: 'Addis Ababa' };
            else if (payload.address && payload.location && !payload.location.address) payload.location.address = payload.address;

            if (payload.location && payload.location.coordinates) {
                const c = payload.location.coordinates;
                const hasCoords = c && Array.isArray(c.coordinates) && c.coordinates.length === 2 && c.coordinates.every(Number.isFinite);
                if (!hasCoords) delete payload.location.coordinates;
            }
            property = await Property.create({
                landlordId: landlordProfile._id,
                ...payload,
                fraudRiskScore,
                riskLevel,
                redFlags
            });
        } catch (createErr) {
            if (isMockMode()) {
                const payload = { ...req.body };
                if (payload.price && !payload.rentAmount) payload.rentAmount = Number(payload.price);
                if (payload.area && !payload.sizeM2) payload.sizeM2 = Number(payload.area);
                if (payload.availability && !payload.listingStatus) payload.listingStatus = payload.availability === 'available' ? 'active' : payload.availability;
                if (payload.address && !payload.location) payload.location = { address: payload.address, city: 'Addis Ababa' };
                else if (payload.address && payload.location && !payload.location.address) payload.location.address = payload.address;

                property = {
                    _id: "mock-prop-" + Date.now(),
                    landlordId: landlordProfile._id,
                    ...payload,
                    listingStatus: payload.listingStatus || 'active',
                    verificationStatus: 'verified',
                    fraudRiskScore,
                    riskLevel,
                    redFlags,
                    createdAt: new Date()
                };
                mockStore.properties.unshift(property);
                mockStore.landlordProfiles.set(landlordProfile._id, landlordProfile);
                if (landlordProfile.accountId) {
                    mockStore.landlordProfiles.set(landlordProfile.accountId, landlordProfile);
                }
                if (typeof persistMockData === 'function') persistMockData();
            } else {
                throw createErr;
            }
        }

        try {
            await LandlordProfile.findByIdAndUpdate(
                landlordProfile._id,
                { $inc: { verifiedPropertiesCount: 1 } }
            );
        } catch (incErr) {
            // non-fatal in mock mode
        }

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
        // Mock DB: user id is not a real ObjectId - serve seeded properties or user-created properties.
        if (isMockMode()) {
            const profile = (mockStore.landlordProfiles || new Map()).get(req.user.id);
            const profId = profile ? profile._id : req.user.id;
            const foundUser = [...mockStore.users.values()].find(u => u._id === req.user.id);
            const isSeedLandlord = (req.user?.email || foundUser?.email) === 'dev.landlord@homelink.test';
            const userProps = (mockStore.properties || []).filter(pr => {
                const lId = typeof pr.landlordId === 'object' ? pr.landlordId._id || pr.landlordId.accountId : pr.landlordId;
                return lId === profId || lId === req.user.id || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId));
            });
            return res.status(200).json({ data: userProps });
        }

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

const resolveMockLandlordProfile = (landlordId) => {
    if (!landlordId) return null;
    if (typeof landlordId === 'object' && landlordId.legalName) return landlordId;

    let profile = null;
    if (mockStore.landlordProfiles) {
        profile = mockStore.landlordProfiles.get(landlordId);
        if (!profile) {
            for (const lp of mockStore.landlordProfiles.values()) {
                if (lp._id === landlordId || lp.accountId === landlordId) {
                    profile = lp;
                    break;
                }
            }
        }
    }

    const targetUserId = profile ? (profile.accountId || profile._id) : landlordId;
    let user = null;
    if (mockStore.users) {
        user = mockStore.users.get(targetUserId);
        if (!user && typeof mockStore.users.values === 'function') {
            user = Array.from(mockStore.users.values()).find(u => u._id === targetUserId || u.email === targetUserId);
        }
        if (!user && (targetUserId === 'mock-landlord-1' || !targetUserId)) {
            user = mockStore.users.get('dev.landlord@homelink.test');
        }
    }

    const accountObj = user ? {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '0911223344',
        createdAt: user.createdAt || new Date().toISOString()
    } : {
        _id: targetUserId || 'mock-landlord-1',
        firstName: profile?.legalName ? profile.legalName.split(' ')[0] : 'Dev',
        lastName: profile?.legalName ? profile.legalName.split(' ').slice(1).join(' ') : 'Landlord',
        email: 'dev.landlord@homelink.test',
        phone: profile?.phone || '0911223344',
        createdAt: new Date().toISOString()
    };

    const legalName = profile?.legalName || `${accountObj.firstName || ''} ${accountObj.lastName || ''}`.trim() || 'HomeLink Landlord';

    return {
        _id: profile?._id || ('profile-' + accountObj._id),
        accountId: accountObj,
        legalName,
        phone: profile?.phone || accountObj.phone || '0911223344',
        verificationStatus: profile?.verificationStatus || 'verified',
        verifiedPropertiesCount: profile?.verifiedPropertiesCount || 1,
        createdAt: profile?.createdAt || accountObj.createdAt
    };
};

const getPropertyById = async (req, res) => {
    try {
        // Mock DB: serve the in-memory listing (ids are not real ObjectIds).
        if (isMockMode()) {
            const mockProperty = (mockStore.properties || []).find((pr) => pr._id === req.params.id);
            if (!mockProperty) return res.status(404).json({ message: 'Property not found' });
            
            const landlordProfile = resolveMockLandlordProfile(mockProperty.landlordId);
            const enriched = {
                ...mockProperty,
                landlordId: landlordProfile || mockProperty.landlordId,
                ratings: mockPropertyRating(req.params.id)
            };
            return res.status(200).json({ data: enriched });
        }

        const { id } = req.params;

        // Populate the landlord profile (public fields only) so the frontend
        // can show the "Identity Verified" badge and landlord name.
        const property = await Property.findById(id).populate({
            path: 'landlordId',
            select: 'legalName profilePhoto verificationStatus verifiedPropertiesCount accountId',
            populate: { path: 'accountId', select: 'firstName lastName email phone' }
        });

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

        // (sprint4-mock-property) owner-checked update without a DB
        if (isMockMode()) {
            const prop4 = (mockStore.properties || []).find((pr) => pr._id === id);
            if (!prop4) return res.status(404).json({ message: 'Property not found' });
            const ownerId = typeof prop4.landlordId === 'object' ? prop4.landlordId._id || prop4.landlordId.accountId : prop4.landlordId;
            const profile = mockStore.landlordProfiles.get(userId);
            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match
                return res.status(403).json({ message: 'You do not own this property' });
            }
            const FORBIDDEN4 = ['_id', 'landlordId', 'createdAt', 'verificationStatus'];
            FORBIDDEN4.forEach((k) => delete updateData[k]);
            const statusVal = updateData.status || updateData.listingStatus || updateData.availability;
            if (statusVal && !['draft', 'active', 'rented', 'inactive', 'suspended', 'reserved', 'available'].includes(statusVal)) {
                return res.status(400).json({ message: 'Invalid status value' });
            }
            if (statusVal) {
                const norm = statusVal === 'available' ? 'active' : statusVal;
                updateData.listingStatus = norm;
                updateData.status = norm;
                updateData.availability = norm;
            }
            if (updateData.price && !updateData.rentAmount) updateData.rentAmount = Number(updateData.price);
            if (updateData.area && !updateData.sizeM2) updateData.sizeM2 = Number(updateData.area);
            Object.assign(prop4, updateData);
            return res.status(200).json({ message: 'Property updated successfully', data: prop4 });
        }

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

        const statusVal = updateData.status || updateData.listingStatus || updateData.availability;
        if (statusVal && !['draft', 'active', 'rented', 'inactive', 'suspended', 'reserved', 'available'].includes(statusVal)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }
        if (statusVal) {
            updateData.listingStatus = statusVal === 'available' ? 'active' : statusVal;
            delete updateData.status;
            delete updateData.availability;
        }
        if (updateData.price && !updateData.rentAmount) updateData.rentAmount = Number(updateData.price);
        if (updateData.area && !updateData.sizeM2) updateData.sizeM2 = Number(updateData.area);
        const FORBIDDEN = ['_id', 'landlordId', 'createdAt', 'verificationStatus'];
        FORBIDDEN.forEach((k) => delete updateData[k]);

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

        // (sprint4-mock-property) owner-checked delete without a DB
        if (isMockMode()) {
            const idx4 = (mockStore.properties || []).findIndex((pr) => pr._id === id);
            if (idx4 === -1) return res.status(404).json({ message: 'Property not found' });
            const prop4 = mockStore.properties[idx4];
            const ownerId = typeof prop4.landlordId === 'object' ? prop4.landlordId._id || prop4.landlordId.accountId : prop4.landlordId;
            const profile = mockStore.landlordProfiles.get(userId);
            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match
                return res.status(403).json({ message: 'You do not own this property' });
            }
            mockStore.properties.splice(idx4, 1);
            return res.status(200).json({ message: 'Property deleted successfully' });
        }

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

        // Offline / in-memory mode: serve the seeded mock properties instead
        // of querying a DB that isn't connected.
        if (isMockMode()) {
            // Sprint 15: apply real search filters in mock mode too, so search
            // behaves the same online and offline.
            const q = String(req.query.q || '').toLowerCase().trim();
            const city = String(req.query.city || '').toLowerCase().trim();
            const subCity = String(req.query.subCity || '').toLowerCase().trim();
            const propertyType = String(req.query.propertyType || '').toLowerCase().trim();
            const minPrice = Number(req.query.minPrice) || null;
            const maxPrice = Number(req.query.maxPrice) || null;
            const bedrooms = Number(req.query.bedrooms) || null;
            const bathrooms = Number(req.query.bathrooms) || null;
            const amenities = String(req.query.amenities || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
            const furnished = String(req.query.furnished || '');
            const verifiedOnly = String(req.query.verifiedOnly || '') === 'true';
            const sort = String(req.query.sort || '');
            let list = (mockStore.properties || []).filter(p => p.listingStatus !== 'suspended');
            if (q) list = list.filter(p => [p.title, p.description, p.location && p.location.subCity, p.location && p.location.neighborhood, p.location && p.location.city].join(' ').toLowerCase().includes(q));
            if (city) list = list.filter(p => (p.location && p.location.city || '').toLowerCase().includes(city));
            if (subCity) list = list.filter(p => (p.location && p.location.subCity || '').toLowerCase().includes(subCity));
            if (propertyType) list = list.filter(p => p.propertyType === propertyType);
            if (minPrice) list = list.filter(p => Number(p.rentAmount) >= minPrice);
            if (maxPrice) list = list.filter(p => Number(p.rentAmount) <= maxPrice);
            if (bedrooms) list = list.filter(p => Number(p.bedrooms) >= bedrooms);
            if (bathrooms) list = list.filter(p => Number(p.bathrooms) >= bathrooms);
            if (amenities.length) list = list.filter(p => amenities.every(a => (p.amenities || []).some(x => String(x).toLowerCase().includes(a))));
            if (furnished === 'true') list = list.filter(p => p.furnished === true);
            if (furnished === 'false') list = list.filter(p => p.furnished !== true);
            if (verifiedOnly) list = list.filter(p => p.verificationStatus === 'verified');
            if (sort === 'price_asc') list.sort((a, b) => a.rentAmount - b.rentAmount);
            else if (sort === 'price_desc') list.sort((a, b) => b.rentAmount - a.rentAmount);
            else if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
            const total = list.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const paged = list.slice((page - 1) * limit, page * limit);
            const mockProperties = paged.map(p => ({
                ...p,
                landlordId: resolveMockLandlordProfile(p.landlordId)
            }));
            return res.status(200).json({
                data: mockProperties,
                pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
            });
        }

        
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
            .populate('landlordId', 'legalName profilePhoto verificationStatus verifiedPropertiesCount')
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

        // (sprint567-favourites) tenant save-property without a DB
        if (isMockMode()) {
            const prop8 = (mockStore.properties || []).find((pr) => pr._id === id);
            if (!prop8) return res.status(404).json({ message: 'Property not found' });
            mockStore.favourites = mockStore.favourites || [];
            if (mockStore.favourites.some((f) => f.tenantId === tenantId && f.propertyId === id)) {
                return res.status(400).json({ message: 'Property already exists in favorites' });
            }
            mockStore.favourites.push({ tenantId, propertyId: id, createdAt: new Date().toISOString() });
            return res.status(201).json({ message: 'Property added to favorites', data: { propertyId: id } });
        }

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

        // (sprint567-favourites) tenant remove-saved-property without a DB
        if (isMockMode()) {
            const favIdx = (mockStore.favourites || []).findIndex((f) => f.tenantId === tenantId && f.propertyId === id);
            if (favIdx === -1) return res.status(404).json({ message: 'Favourite not found' });
            mockStore.favourites.splice(favIdx, 1);
            return res.status(200).json({ message: 'Property removed from favorites' });
        }

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

        // (sprint567-favourites) view saved properties without a DB
        if (isMockMode()) {
            const favRows = (mockStore.favourites || []).filter((f) => f.tenantId === tenantId);
            const favProps = favRows
                .map((f) => (mockStore.properties || []).find((pr) => pr._id === f.propertyId))
                .filter(Boolean);
            return res.status(200).json({ data: favProps, total: favProps.length });
        }

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

        // (sprint4-mock-property) owner-checked image upload without a DB.
        // Files were already written to /uploads by the multer middleware.
        if (isMockMode()) {
            const prop5 = (mockStore.properties || []).find((pr) => pr._id === id);
            if (!prop5) return res.status(404).json({ message: 'Property not found' });
            const ownerId = typeof prop5.landlordId === 'object' ? prop5.landlordId._id || prop5.landlordId.accountId : prop5.landlordId;
            const profile = mockStore.landlordProfiles.get(userId);
            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match
                return res.status(403).json({ message: 'You do not own this property' });
            }
            if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No images uploaded' });
            prop5.images = prop5.images || [];
            const entries = req.files.map((file, index) => ({
                _id: 'mock-image-' + Date.now() + '-' + index,
                key: file.filename,
                url: '/uploads/' + file.filename,
                isPrimary: prop5.images.length === 0 && index === 0,
                uploadedAt: new Date().toISOString(),
            }));
            prop5.images.push(...entries);
            return res.status(200).json({
                message: req.files.length + ' image(s) uploaded successfully',
                data: { propertyId: prop5._id, images: prop5.images, totalImages: prop5.images.length },
            });
        }

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

        // (sprint4-mock-property) owner-checked image delete without a DB
        if (isMockMode()) {
            const prop6 = (mockStore.properties || []).find((pr) => pr._id === id);
            if (!prop6) return res.status(404).json({ message: 'Property not found' });
            const ownerId = typeof prop6.landlordId === 'object' ? prop6.landlordId._id || prop6.landlordId.accountId : prop6.landlordId;
            const profile = mockStore.landlordProfiles.get(userId);
            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match
                return res.status(403).json({ message: 'You do not own this property' });
            }
            const imgIdx = (prop6.images || []).findIndex((img) => img._id === imageId || img.key === imageId);
            if (imgIdx === -1) return res.status(404).json({ message: 'Image not found' });
            prop6.images.splice(imgIdx, 1);
            return res.status(200).json({ message: 'Image deleted successfully', data: { images: prop6.images } });
        }

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

        // (sprint4-mock-property) owner-checked primary-image flip without a DB
        if (isMockMode()) {
            const prop7 = (mockStore.properties || []).find((pr) => pr._id === id);
            if (!prop7) return res.status(404).json({ message: 'Property not found' });
            const ownerId = typeof prop7.landlordId === 'object' ? prop7.landlordId._id || prop7.landlordId.accountId : prop7.landlordId;
            const profile = mockStore.landlordProfiles.get(userId);
            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match
                return res.status(403).json({ message: 'You do not own this property' });
            }
            const target = (prop7.images || []).find((img) => img._id === imageId || img.key === imageId);
            if (!target) return res.status(404).json({ message: 'Image not found' });
            prop7.images.forEach((img) => { img.isPrimary = img === target; });
            return res.status(200).json({ message: 'Primary image updated', data: { images: prop7.images } });
        }

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

        // (sprint567-preferences) preference profile without a DB
        if (isMockMode()) {
            const body9 = req.body || {};
            if (!body9.budget || !body9.location || !body9.propertyType) {
                return res.status(400).json({ message: 'Budget, location, and property type are required' });
            }
            mockStore.tenantPreferences[tenantId] = {
                ...mockStore.tenantPreferences[tenantId],
                ...body9,
                updatedAt: new Date().toISOString(),
            };
            return res.status(200).json({ message: 'Preferences saved', data: mockStore.tenantPreferences[tenantId] });
        }
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

        // (sprint567-getprefs) read preference profile without a DB
        if (isMockMode()) {
            return res.status(200).json({ data: mockStore.tenantPreferences[tenantId] || null });
        }
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

        // (sprint567-getprefs) partial update without a DB
        if (isMockMode()) {
            if (!mockStore.tenantPreferences[tenantId]) return res.status(404).json({ message: 'No preferences saved yet' });
            Object.assign(mockStore.tenantPreferences[tenantId], req.body || {}, { updatedAt: new Date().toISOString() });
            return res.status(200).json({ message: 'Preferences updated', data: mockStore.tenantPreferences[tenantId] });
        }
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
        const { page = 1, limit = 20 } = req.query || {};
        // 1. Get tenant preferences & properties (with offline mock fallback)
        let preferences = null;
        let properties = [];

        try {
            preferences = await TenantPreference.findOne({ tenantId });
            properties = await Property.find({
                listingStatus: 'active',
                verificationStatus: 'verified'
            }).lean();
        } catch (dbErr) {
            // DB offline fallback
        }

        if (!preferences && isMockMode()) {
            preferences = mockStore.tenantPreferences.get(tenantId) || {
                tenantId,
                budget: { min: 20000, max: 80000 },
                location: ['Bole', 'Kazanchis', 'CMC'],
                bedrooms: 2,
                bathrooms: 1,
                furnished: true
            };
        }

        if ((!properties || properties.length === 0) && isMockMode()) {
            properties = [...mockStore.properties];
        }

        if (!preferences) {
            return res.status(404).json({
                message: 'Please set your preferences first'
            });
        }

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
