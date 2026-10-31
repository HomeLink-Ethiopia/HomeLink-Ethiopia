const express = require('express');
const router = express.Router();

const NEIGHBORHOODS_DATA = [
  // ─── ADDIS ABABA ──────────────────────────────────────────────────────────
  {
    _id: 'neigh-bole',
    name: 'Bole',
    city: 'Addis Ababa',
    overall: 89,
    scores: {
      safety: 88,
      noise: 62,
      floodRisk: 85,
      waterReliability: 82,
      electricityReliability: 86,
      internet: 92,
      transport: 94,
    },
    summary: 'Addis Ababa’s premier commercial and residential hub. Bustling nightlife, top international restaurants, embassies, and excellent airport proximity with reliable 4G/5G coverage.',
    highlights: ['Edna Mall & Medhanialem area', 'Direct airport highway access', 'High concentration of backup water tanks & generators', 'Safe well-lit pedestrian corridors'],
    avgRentEstimate: 42000,
    listingsCount: 24,
  },
  {
    _id: 'neigh-kazanchis',
    name: 'Kazanchis',
    city: 'Addis Ababa',
    overall: 84,
    scores: {
      safety: 83,
      noise: 58,
      floodRisk: 88,
      waterReliability: 79,
      electricityReliability: 84,
      internet: 90,
      transport: 96,
    },
    summary: 'The diplomatic and financial nerve center hosting UNECA, major international hotels, and government agencies. Unbeatable central location with walking access to business offices.',
    highlights: ['UNECA & ECA compound', 'Walking distance to Meskel Square', 'Abundant public transport and taxis', 'High security zone'],
    avgRentEstimate: 36000,
    listingsCount: 18,
  },
  {
    _id: 'neigh-cmc',
    name: 'CMC',
    city: 'Addis Ababa',
    overall: 86,
    scores: {
      safety: 89,
      noise: 82,
      floodRisk: 80,
      waterReliability: 76,
      electricityReliability: 80,
      internet: 84,
      transport: 81,
    },
    summary: 'A peaceful, tree-lined residential district in eastern Addis Ababa popular with families and returning diaspora. Characterized by gated compounds, clean streets, and light-rail transit access.',
    highlights: ['Quiet gated compounds & villas', 'Addis Light Rail transit stops', 'Good private schools & clinics', 'Low evening noise levels'],
    avgRentEstimate: 32000,
    listingsCount: 20,
  },
  {
    _id: 'neigh-old-airport',
    name: 'Old Airport',
    city: 'Addis Ababa',
    overall: 91,
    scores: {
      safety: 93,
      noise: 86,
      floodRisk: 88,
      waterReliability: 85,
      electricityReliability: 88,
      internet: 89,
      transport: 82,
    },
    summary: 'Prestigious expat and diplomatic residential neighborhood adjacent to the International Community School (ICS), the Golf Club, and European embassies. Very safe and quiet.',
    highlights: ['Beside ICS & Bisrate Gabriel', 'High 24/7 private security presence', 'Spacious compound homes with gardens', 'Minimal through-traffic noise'],
    avgRentEstimate: 55000,
    listingsCount: 12,
  },
  {
    _id: 'neigh-sarbet',
    name: 'Sarbet',
    city: 'Addis Ababa',
    overall: 85,
    scores: {
      safety: 86,
      noise: 71,
      floodRisk: 84,
      waterReliability: 80,
      electricityReliability: 83,
      internet: 88,
      transport: 90,
    },
    summary: 'A vibrant midtown district bridging Kirkos and Nifas Silk. Close to the African Union headquarters, Karl Square, and leading private healthcare institutions.',
    highlights: ['Proximity to African Union HQ', 'Bustling café culture & bakeries', 'Fast access to Ring Road', 'Reliable telecommunications'],
    avgRentEstimate: 35000,
    listingsCount: 15,
  },
  {
    _id: 'neigh-gerji',
    name: 'Gerji',
    city: 'Addis Ababa',
    overall: 80,
    scores: {
      safety: 79,
      noise: 68,
      floodRisk: 78,
      waterReliability: 74,
      electricityReliability: 78,
      internet: 82,
      transport: 86,
    },
    summary: 'An accessible, diverse eastern sub-city neighborhood featuring modern condominium complexes (Mebrat Hail, Sunshine) and direct links to Bole Medhanialem and Gurd Shola.',
    highlights: ['Affordable quality condominiums', 'Near Unity University & commercial strips', 'Frequent minibus and taxi connections', 'Family-friendly parks'],
    avgRentEstimate: 24000,
    listingsCount: 22,
  },
  {
    _id: 'neigh-summit',
    name: 'Summit',
    city: 'Addis Ababa',
    overall: 82,
    scores: {
      safety: 84,
      noise: 85,
      floodRisk: 77,
      waterReliability: 72,
      electricityReliability: 76,
      internet: 80,
      transport: 76,
    },
    summary: 'Modern planned residential area beyond CMC known for spacious real estate developments (Ayat, Safari) with scenic surrounding mountain views and serene surroundings.',
    highlights: ['Serene low-noise environment', 'Newly built apartments with parking', 'Lower rent per square meter', 'Growing shopping & grocery plazas'],
    avgRentEstimate: 22000,
    listingsCount: 16,
  },
  {
    _id: 'neigh-piassa',
    name: 'Piassa',
    city: 'Addis Ababa',
    overall: 78,
    scores: {
      safety: 76,
      noise: 52,
      floodRisk: 90,
      waterReliability: 78,
      electricityReliability: 82,
      internet: 86,
      transport: 95,
    },
    summary: 'The historic heart of modern Ethiopia, recently revitalized with expansive pedestrian boulevards, cultural heritage centers, and central government district access.',
    highlights: ['Newly renovated pedestrian corridors', 'Direct access to Arat Kilo & Churchill Ave', 'Historic cafés and jewelry quarters', 'Abundant public transport'],
    avgRentEstimate: 28000,
    listingsCount: 10,
  },

  // ─── HAWASSA ──────────────────────────────────────────────────────────────
  {
    _id: 'neigh-hawassa-haik-dar',
    name: 'Piazza & Haik Dar',
    city: 'Hawassa',
    overall: 88,
    scores: {
      safety: 90,
      noise: 86,
      floodRisk: 82,
      waterReliability: 86,
      electricityReliability: 84,
      internet: 85,
      transport: 88,
    },
    summary: 'Hawassa’s prime lakeside district with lush palm avenues, world-class resort hotels, peaceful evening walking tracks, and fresh Lake Hawassa breezes.',
    highlights: ['Direct Lake Hawassa shoreline access', 'Walking distance to Amora Gedel Park', 'Extremely low crime rate & family safe', 'Abundant fresh local fish markets'],
    avgRentEstimate: 19000,
    listingsCount: 14,
  },
  {
    _id: 'neigh-hawassa-millennium',
    name: 'Millennium District',
    city: 'Hawassa',
    overall: 85,
    scores: {
      safety: 87,
      noise: 84,
      floodRisk: 86,
      waterReliability: 82,
      electricityReliability: 81,
      internet: 83,
      transport: 80,
    },
    summary: 'A fast-growing, well-planned residential suburb in Hawassa featuring new villa homes, wide asphalt roadways, and good access to Hawassa Industrial Park.',
    highlights: ['Wide paved avenues & parking', 'Peaceful residential living', 'Near Hawassa University referral center', 'Consistent municipal services'],
    avgRentEstimate: 16500,
    listingsCount: 11,
  },

  // ─── BAHIR DAR ────────────────────────────────────────────────────────────
  {
    _id: 'neigh-bahirdar-tana',
    name: 'Lake Tana Waterfront',
    city: 'Bahir Dar',
    overall: 89,
    scores: {
      safety: 91,
      noise: 88,
      floodRisk: 83,
      waterReliability: 85,
      electricityReliability: 82,
      internet: 84,
      transport: 86,
    },
    summary: 'Bahir Dar’s renowned palm-lined avenue overlooking Lake Tana and the source of the Blue Nile. Clean, peaceful, and celebrated for scenic natural beauty.',
    highlights: ['Spectacular Lake Tana views & boat jetties', 'Wide palm-tree pedestrian promenade', 'Top resorts, cafés, and cultural centers', 'Quiet evening atmosphere'],
    avgRentEstimate: 18000,
    listingsCount: 12,
  },
  {
    _id: 'neigh-bahirdar-felege-hiwot',
    name: 'Felege Hiwot / Kebele 3',
    city: 'Bahir Dar',
    overall: 83,
    scores: {
      safety: 85,
      noise: 76,
      floodRisk: 85,
      waterReliability: 81,
      electricityReliability: 80,
      internet: 82,
      transport: 90,
    },
    summary: 'Central Bahir Dar district offering prime access to Felege Hiwot Hospital, regional commerce, schools, and quick transport across the city.',
    highlights: ['Walking distance to major hospitals & clinics', 'Frequent bajaj and taxi links', 'Family-friendly residential streets', 'Reliable commercial services'],
    avgRentEstimate: 14500,
    listingsCount: 9,
  },

  // ─── DIRE DAWA ────────────────────────────────────────────────────────────
  {
    _id: 'neigh-diredawa-kezira',
    name: 'Kezira',
    city: 'Dire Dawa',
    overall: 90,
    scores: {
      safety: 92,
      noise: 87,
      floodRisk: 88,
      waterReliability: 84,
      electricityReliability: 85,
      internet: 86,
      transport: 90,
    },
    summary: 'The historic, grid-planned European railway quarter of Dire Dawa. Distinguished by lush giant neem trees, French colonial architecture, and high safety standards.',
    highlights: ['Historic Franco-Ethiopian railway heritage', 'Shaded tree-lined boulevards', 'Very clean and exceptionally safe', 'Proximity to Dire Dawa International Airport'],
    avgRentEstimate: 17000,
    listingsCount: 13,
  },
  {
    _id: 'neigh-diredawa-sabian',
    name: 'Sabian',
    city: 'Dire Dawa',
    overall: 82,
    scores: {
      safety: 83,
      noise: 78,
      floodRisk: 84,
      waterReliability: 80,
      electricityReliability: 81,
      internet: 82,
      transport: 85,
    },
    summary: 'An established residential quarter popular with local professionals and civil servants. Quiet, neighborhood-focused, and well serviced by local markets.',
    highlights: ['Affordable compound homes & villas', 'Quality private and government schools', 'Close community feel', 'Good transit links'],
    avgRentEstimate: 13500,
    listingsCount: 8,
  },

  // ─── ADAMA (NAZRET) ───────────────────────────────────────────────────────
  {
    _id: 'neigh-adama-bole',
    name: 'Bole Adama',
    city: 'Adama',
    overall: 84,
    scores: {
      safety: 85,
      noise: 78,
      floodRisk: 88,
      waterReliability: 80,
      electricityReliability: 82,
      internet: 85,
      transport: 92,
    },
    summary: 'Adama’s premier modern residential district along the Addis-Adama Expressway corridor. Excellent commercial activity and fast 45-minute highway access to the capital.',
    highlights: ['Direct Addis-Adama Expressway access', 'Modern commercial banks & dining', 'Spacious residential compounds', 'Rapidly appreciating rental values'],
    avgRentEstimate: 15000,
    listingsCount: 15,
  },

  // ─── BISHOFTU (DEBRE ZEYIT) ───────────────────────────────────────────────
  {
    _id: 'neigh-bishoftu-kuriftu',
    name: 'Kuriftu Lakefront',
    city: 'Bishoftu',
    overall: 91,
    scores: {
      safety: 93,
      noise: 90,
      floodRisk: 89,
      waterReliability: 85,
      electricityReliability: 86,
      internet: 87,
      transport: 82,
    },
    summary: 'Serene lakeside living around famous volcanic crater lakes. Pristine air quality, mild year-round climate, luxury weekend villas, and fast highway link to Addis Ababa.',
    highlights: ['Crater lake views & resort amenities', 'Tranquil retreat living with high safety', 'Fast 35-min expressway commute to Addis Ababa', 'Ideal for remote workers & families'],
    avgRentEstimate: 23000,
    listingsCount: 10,
  },

  // ─── MEKELLE ──────────────────────────────────────────────────────────────
  {
    _id: 'neigh-mekelle-ayder',
    name: 'Ayder',
    city: 'Mekelle',
    overall: 83,
    scores: {
      safety: 84,
      noise: 80,
      floodRisk: 86,
      waterReliability: 79,
      electricityReliability: 80,
      internet: 81,
      transport: 86,
    },
    summary: 'The educational and medical epicenter of Mekelle, hosting Ayder Comprehensive Hospital and Mekelle University campuses with wide paved avenues.',
    highlights: ['Beside Ayder Referral Hospital & University', 'Modern apartment housing', 'Reliable commercial center', 'Wide planned road networks'],
    avgRentEstimate: 15500,
    listingsCount: 9,
  },
];

// GET /api/v1/neighborhoods
router.get('/', (req, res) => {
  const { city } = req.query;
  let result = NEIGHBORHOODS_DATA;
  if (city && city.toLowerCase() !== 'all') {
    result = result.filter((n) => n.city.toLowerCase() === city.toLowerCase());
  }
  const cities = Array.from(new Set(NEIGHBORHOODS_DATA.map((n) => n.city)));
  res.status(200).json({
    success: true,
    count: result.length,
    cities,
    data: result,
  });
});

// GET /api/v1/neighborhoods/:id
router.get('/:id', (req, res) => {
  const item = NEIGHBORHOODS_DATA.find(
    (n) => n._id === req.params.id || n.name.toLowerCase() === req.params.id.toLowerCase()
  );
  if (!item) {
    return res.status(404).json({ success: false, message: 'Neighborhood not found' });
  }
  res.status(200).json({ success: true, data: item });
});

module.exports = router;
