const fs = require('fs');

let p = 'backend/src/routes/extraRoutes.js';
let raw = fs.readFileSync(p, 'utf8');
let s = raw.replace(/\r\n/g, '\n');

const oldBlock = `router.post('/ai/rent-estimate', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const loc = body.location || {};
    if (!loc.subCity && !loc.city && !body.sizeM2) {
      return res.status(400).json({ message: 'Provide a location (subCity or city) and property details for a rent estimate.' });
    }
    return res.status(200).json({ data: { estimate: mockEstimate(body) } });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});`;

const newBlock = `router.post('/ai/rent-estimate', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const loc = body.location || {};
    // The landlord form sends city/subCity flat (not nested) — accept both
    // shapes, and only reject when there is truly nothing to estimate from
    // (sprint-fix-rent-estimate).
    const city = loc.city || body.city || '';
    const subCity = loc.subCity || body.subCity || body.subcity || '';
    if (!city && !subCity && !body.sizeM2 && !body.bedrooms && !body.propertyType) {
      return res.status(400).json({ message: 'Provide a city or sub-city (and property details) for a rent estimate.' });
    }
    const normalized = {
      ...body,
      city,
      subCity,
      location: { ...loc, city, subCity },
    };
    return res.status(200).json({ data: { estimate: mockEstimate(normalized) } });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});`;

if (!s.includes(oldBlock)) throw new Error('rent-estimate block not found');
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(p, s);
console.log('rent-estimate endpoint patched (accepts flat fields)');
