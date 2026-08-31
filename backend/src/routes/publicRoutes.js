const express = require('express');
const router = express.Router();
const Property = require('../models/Property');

// Public property listing — no auth required
// GET /api/public/properties
// Supports: neighborhood, minPrice, maxPrice, beds, verifiedOnly, page, limit
router.get('/properties', async (req, res) => {
  try {
    const {
      neighborhood,
      minPrice,
      maxPrice,
      beds,
      verifiedOnly,
      page = 1,
      limit = 20
    } = req.query;

    const query = { listingStatus: 'active' };

    // Only show verified properties on public listing
    if (verifiedOnly === 'true') {
      query.verificationStatus = 'verified';
    }

    // Filter by neighborhood (subCity)
    if (neighborhood) {
      query['location.subCity'] = neighborhood;
    }

    // Price range
    if (minPrice || maxPrice) {
      query.rentAmount = {};
      if (minPrice) query.rentAmount.$gte = Number(minPrice);
      if (maxPrice) query.rentAmount.$lte = Number(maxPrice);
    }

    // Minimum bedrooms
    if (beds) {
      query.bedrooms = { $gte: Number(beds) };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-imageHashes -documents -deletedAt -fraudRiskScore -recommendationFeatureVector'),
      Property.countDocuments(query)
    ]);

    res.status(200).json({
      data: properties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Get public properties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public single property — no auth required
// GET /api/public/properties/:id
router.get('/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id)
      .select('-imageHashes -documents -deletedAt -fraudRiskScore -recommendationFeatureVector');

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Increment view count
    await Property.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    res.status(200).json({ data: property });

  } catch (error) {
    console.error('Get public property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
