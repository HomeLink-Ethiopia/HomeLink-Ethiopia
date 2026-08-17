const Property = require('../models/Property');
const LandlordProfile = require('../models/LandlordProfile');

const createProperty = async (req, res) => {
    try {
        const userId = req.user.id;

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
        res.status(500).json({
            message: 'Server error'
        });
    }
};

const getMyProperties = async (req, res) => {
    try {
        const userId = req.user.id;

        const landlordProfile = await LandlordProfile.findOne({ accountId: userId });

        if (!landlordProfile) {
            return res.status(404).json({
                message: 'Landlord profile not found'
            });
        }

        const properties = await Property.find({ landlordId: landlordProfile._id });

        res.status(200).json({
            data: properties
        });

    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
};

const getPropertyById = async (req, res) => {
    try {
        const { id } = req.params;

        const property = await Property.findById(id);

        if (!property) {
            return res.status(404).json({
                message: 'Property not found'
            });
        }

        res.status(200).json({
            data: property
        });

    } catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
};

module.exports = {
    createProperty,
    getMyProperties,
    getPropertyById
};
