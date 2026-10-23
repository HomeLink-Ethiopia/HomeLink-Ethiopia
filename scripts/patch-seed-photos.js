const fs = require('fs');

// Re-seed the 4 mock property images to the owner-supplied photos (served
// from backend static /uploads) — matches the frontend Verified-homes pool.
let p = 'backend/src/config/db.js';
let s = fs.readFileSync(p, 'utf8');
const pairs = [
  ['https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29.jpg', '/uploads/homes/apartment-tower.png'],
  ['https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Armenian-Style_House_near_National_Museum_-_Addis_Ababa_-_Ethiopia_%288743141067%29.jpg/960px-Armenian-Style_House_near_National_Museum_-_Addis_Ababa_-_Ethiopia_%288743141067%29.jpg', '/uploads/homes/white-villa.png'],
  ['https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/2012_Addis_Ethiopia_6972126881.jpg/960px-2012_Addis_Ethiopia_6972126881.jpg', '/uploads/homes/compound-house.png'],
  ['https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Besmelian_%28Elias%29_Residence_%28Avekian%29.jpg/960px-Besmelian_%28Elias%29_Residence_%28Avekian%29.jpg', '/uploads/homes/garden-villa.png'],
];
let n = 0;
for (const [a, b] of pairs) {
  if (s.includes(a)) { s = s.split(a).join(b); n++; }
}
fs.writeFileSync(p, s);
console.log('replaced', n, 'of', pairs.length);
