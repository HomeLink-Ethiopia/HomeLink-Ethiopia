const express = require('express');
const router = express.Router();
const NeighborhoodScore = require('../models/NeighborhoodScore');
const { isMockMode } = require('../config/db');

// Deterministic mock neighborhood scores so the compare page works offline.
const MOCK_NEIGHBORHOODS = [
  ['Bole', 'Addis Ababa', 88, 72, 85, 78, 90, 84, 86, 32000, 426],
  ['Kazanchis', 'Addis Ababa', 82, 58, 80, 74, 86, 80, 92, 28000, 312],
  ['CMC', 'Addis Ababa', 78, 50, 70, 82, 76, 64, 70, 22000, 276],
  ['Piassa', 'Addis Ababa', 70, 42, 62, 68, 74, 70, 88, 18000, 238],
  ['Old Airport', 'Addis Ababa', 90, 78, 88, 80, 92, 86, 80, 38000, 190],
  ['Yeka', 'Addis Ababa', 76, 55, 72, 76, 78, 68, 72, 20000, 210],
  ['Ayat', 'Addis Ababa', 68, 48, 66, 64, 70, 60, 66, 15000, 180],
  ['Saris', 'Addis Ababa', 62, 44, 60, 60, 66, 56, 74, 14000, 160],
].map(([name, city, safety, noise, floodRisk, waterReliability, electricityReliability, internet, transport, avgRentEstimate, listingsCount], i) => ({
  _id: 'mock-nb-' + i, name, city, overall: Math.round((safety + noise + floodRisk + waterReliability + electricityReliability + internet + transport) / 7),
  scores: { safety, noise, floodRisk, waterReliability, electricityReliability, internet, transport },
  summary: name + ' scores are based on resident reports and public infrastructure data (demo).',
  highlights: ['Good transport access', 'Active community', 'Growing rental market'],
  avgRentEstimate, listingsCount,
}));

// Public — tenants compare neighborhoods before choosing

// ─── GET /api/v1/neighborhoods?sort=overall|name
router.get('/', async (req, res) => {
  try {
    const sort = req.query.sort === 'name' ? { name: 1 } : { overall: -1 };
    if (isMockMode()) {
      const data = sort.name ? [...MOCK_NEIGHBORHOODS].sort((a, b) => a.name.localeCompare(b.name)) : MOCK_NEIGHBORHOODS;
      return res.status(200).json({ data });
    }
    const list = await NeighborhoodScore.find({}).sort(sort).lean();
    res.status(200).json({ data: list });
  } catch (error) {
    console.error('neighborhoods list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/v1/neighborhoods/compare?names=Bole,Yeka — side-by-side
router.get('/compare', async (req, res) => {
  try {
    const raw = String(req.query.names || '');
    const names = raw.split(',').map(n => n.trim()).filter(Boolean).slice(0, 4);
    if (isMockMode()) {
      const wanted = names.map((n) => n.toLowerCase());
      const list = MOCK_NEIGHBORHOODS.filter((n) => wanted.includes(n.name.toLowerCase()));
      return res.status(200).json({ data: list, requested: names });
    }
    if (names.length < 2) {
      return res.status(400).json({ message: 'Provide 2-4 neighborhood names, e.g. ?names=Bole,Yeka' });
    }
    const regexes = names.map(n => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    const list = await NeighborhoodScore.find({ name: { $in: regexes } }).sort({ overall: -1 }).lean();
    res.status(200).json({ data: list, requested: names });
  } catch (error) {
    console.error('neighborhoods compare error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/v1/neighborhoods/:name — single
router.get('/:name', async (req, res) => {
  try {
    if (isMockMode()) {
      const doc = MOCK_NEIGHBORHOODS.find((n) => n.name.toLowerCase() === String(req.params.name).toLowerCase());
      if (!doc) return res.status(404).json({ message: 'Neighborhood not found' });
      return res.status(200).json({ data: doc });
    }
    const doc = await NeighborhoodScore.findOne({
      name: new RegExp(`^${req.params.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).lean();
    if (!doc) return res.status(404).json({ message: 'Neighborhood not found' });
    res.status(200).json({ data: doc });
  } catch (error) {
    console.error('neighborhood get error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
