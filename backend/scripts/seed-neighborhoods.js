/**
 * Seed NeighborhoodScore documents for Ethiopian cities.
 * Addis Ababa: all 11 sub-cities + lideta = 12 districts.
 * Regional cities: Hawassa, Dire Dawa, Mekelle, Bahir Dar, Gondar, Adama,
 * Jimma, Dessie, Jijiga, Harar, Arba Minch, Nekemte.
 * Scores are AI-generated heuristics consistent with the rent model.
 * Run: node scripts/seed-neighborhoods.js
 */
const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));

const fs = require('fs');
try {
  const envPath = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '');
  }
} catch (e) { /* .env optional */ }

require(path.join(__dirname, 'doh-preload.js'));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/homelink';

// [name, city, safety, noise(quiet), floodSafety, water, electricity, internet, transport, avgRent60m2]
const N = [
  // ─── Addis Ababa sub-cities ───
  ['Bole', 'Addis Ababa', 82, 55, 74, 72, 78, 85, 90, 28800],
  ['Kazanchis', 'Addis Ababa', 75, 50, 70, 68, 75, 80, 85, 25200],
  ['Old Airport', 'Addis Ababa', 84, 65, 76, 74, 80, 82, 80, 27000],
  ['Sarbet', 'Addis Ababa', 78, 68, 72, 70, 74, 76, 76, 22800],
  ['CMC', 'Addis Ababa', 74, 66, 68, 62, 70, 72, 72, 19200],
  ['Kirkos', 'Addis Ababa', 70, 52, 64, 64, 70, 74, 84, 20400],
  ['Yeka', 'Addis Ababa', 72, 72, 60, 60, 68, 70, 70, 18000],
  ['Arada', 'Addis Ababa', 66, 50, 62, 60, 68, 70, 82, 18600],
  ['Lideta', 'Addis Ababa', 62, 55, 58, 57, 63, 62, 74, 14400],
  ['Nifas Silk-Lafto', 'Addis Ababa', 64, 64, 58, 58, 64, 64, 70, 16200],
  ['Gullele', 'Addis Ababa', 62, 62, 55, 55, 60, 60, 66, 15000],
  ['Kolfe Keranio', 'Addis Ababa', 60, 60, 54, 54, 58, 58, 62, 13800],
  ['Akaky Kaliti', 'Addis Ababa', 58, 58, 50, 52, 56, 56, 60, 12600],

  // ─── Regional cities ───
  ['Hawassa', 'Hawassa', 76, 70, 62, 60, 62, 66, 68, 15600],
  ['Adama', 'Adama', 68, 62, 58, 58, 64, 64, 74, 13200],
  ['Bahir Dar', 'Bahir Dar', 74, 72, 60, 58, 60, 62, 66, 13800],
  ['Dire Dawa', 'Dire Dawa', 64, 62, 54, 54, 60, 60, 68, 12000],
  ['Mekelle', 'Mekelle', 66, 66, 56, 52, 54, 56, 60, 11400],
  ['Gondar', 'Gondar', 68, 68, 56, 54, 56, 58, 62, 12000],
  ['Jimma', 'Jimma', 64, 68, 58, 60, 56, 54, 58, 10800],
  ['Dessie', 'Dessie', 60, 62, 54, 52, 54, 52, 64, 9600],
  ['Jijiga', 'Jijiga', 62, 64, 52, 50, 52, 54, 58, 10200],
  ['Harar', 'Harar', 68, 66, 56, 54, 56, 56, 60, 10800],
  ['Arba Minch', 'Arba Minch', 62, 70, 52, 56, 52, 50, 54, 9000],
  ['Nekemte', 'Nekemte', 60, 66, 52, 54, 52, 50, 56, 8400],
];

const SUMMARIES = {
  'Hawassa': 'Lakeside resort city with Ethiopia\'s best-known lake — tourism drives a calm, green environment. Utilities dip outside the center; lakeside properties command a premium.',
  'Adama': 'Major trade hub on the Djibouti corridor, 90km from Addis. Great highway and rail connections; busy commercial center with moderate noise.',
  'Bahir Dar': 'Lake Tana city — clean, palm-lined avenues and the Blue Nile Falls nearby. Among the most liveable regional cities; utilities improving steadily.',
  'Dire Dawa': 'Historic railway city with a unique mixed identity. Industrial economy keeps rents low; some aging infrastructure.',
  'Mekelle': 'Northern highlands capital. Resilient community with a distinct culture; services are rebuilding — verify water and power before signing.',
  'Gondar': 'Castle-city with rich history and a university. Cool highland climate; growing student rental market.',
  'Jimma': 'Coffee heartland in the green southwest. Lush surroundings and a major university; rainfall is heavy — check drainage.',
  'Dessie': 'Central crossroads town between Addis and the north. Affordable with basic services; transport connections are its strength.',
  'Jijiga': 'Eastern gateway near Somaliland with a fast-growing trade economy. Hot climate; water reliability is the main challenge.',
  'Harar': 'Walled UNESCO heritage city — one of the oldest in Africa. Compact, cultural, and walkable; infrastructure is older.',
  'Arba Minch': 'Twin-lake city in the south with stunning Rift Valley views. Quiet and developing; limited high-speed internet.',
  'Nekemte': 'Western trade town with affordable housing and improving roads. Small but growing rental market.',
};

const HIGHLIGHTS = {
  'Hawassa': ['Lake Hawassa waterfront', 'Tourism economy', 'Amora Gedel park'],
  'Adama': ['Addis–Djibouti railway', 'Highway hub', 'Industrial zone jobs'],
  'Bahir Dar': ['Lake Tana', 'Blue Nile Falls', 'Cleanest regional city'],
  'Dire Dawa': ['Historic railway', 'Industrial economy', 'Low rents'],
  'Mekelle': ['Highland climate', 'University city', 'Rebuilding services'],
  'Gondar': ['Fasil Ghebbi castles', 'University', 'Cool highlands'],
  'Jimma': ['Coffee origin', 'Jimma University', 'Green landscape'],
  'Dessie': ['North-south crossroads', 'Affordable', 'Trade markets'],
  'Jijiga': ['Somaliland trade', 'Fast growth', 'Camel market'],
  'Harar': ['UNESCO walled city', 'Hyena tradition', 'Ancient culture'],
  'Arba Minch': ['Twin lakes', 'Nechisar National Park', 'Rift Valley views'],
  'Nekemte': ['Western trade', 'Improving roads', 'Low rents'],
};

// overall = weighted liveability blend (safety weighted highest)
const overallOf = (s) => Math.round(
  s.safety * 0.22 + s.noise * 0.12 + s.floodRisk * 0.12 +
  s.waterReliability * 0.18 + s.electricityReliability * 0.14 +
  s.internet * 0.10 + s.transport * 0.12
);

const BASE_RATES = {
  'bole': 480, 'kazanchis': 420, 'old airport': 450, 'sarbet': 380, 'cmc': 320,
  'kirkos': 340, 'yeka': 300, 'arada': 310, 'lideta': 240,
  'nifas silk-lafto': 270, 'gullele': 250, 'kolfe keranio': 230, 'akaky kaliti': 210,
  'hawassa': 260, 'adama': 220, 'bahir dar': 230, 'dire dawa': 200, 'mekelle': 190,
  'gondar': 200, 'jimma': 180, 'dessie': 160, 'jijiga': 170, 'harar': 180,
  'arba minch': 150, 'nekemte': 140,
};

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  for (const [name, city, safety, noise, flood, water, elec, net, transport, rent] of N) {
    const scores = {
      safety, noise, floodRisk: flood,
      waterReliability: water, electricityReliability: elec,
      internet: net, transport,
    };
    const overall = overallOf(scores);
    const avgRentEstimate = Math.round(rent / 100) * 100;

    await mongoose.connection.collection('neighborhoodscores').updateOne(
      { name },
      {
        $set: {
          name, city, scores, overall,
          summary: SUMMARIES[name] || `${name} neighborhood in ${city}.`,
          highlights: HIGHLIGHTS[name] || [],
          avgRentEstimate,
        },
      },
      { upsert: true }
    );
    console.log(`  ✓ ${name} (${city}) — overall ${overall}, ~${avgRentEstimate.toLocaleString()} ETB`);
  }

  await mongoose.disconnect();
  console.log(`✅ Seeded ${N.length} neighborhoods across Ethiopia`);
  process.exit(0);
})().catch(err => { console.error('Seed failed:', err); process.exit(1); });
