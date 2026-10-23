const fs = require('fs');

// 1. creditScoreRoutes.js — fix TDZ bug (tenantId used before declaration) + mock branch for /batch
let p = 'backend/src/routes/creditScoreRoutes.js';
let s = fs.readFileSync(p, 'utf8');
const tdzOld = "    if (isMockMode()) return res.status(200).json({ data: MOCK_CREDIT_SCORE(tenantId) });\n    const { tenantId } = req.params;";
const tdzNew = "    const { tenantId } = req.params;\n    if (isMockMode()) return res.status(200).json({ data: MOCK_CREDIT_SCORE(tenantId) });";
if (!s.includes(tdzOld)) throw new Error('TDZ pattern not found');
s = s.replace(tdzOld, tdzNew);
const batchOld = "    const results = {};\n    for (const tid of tenantIds) {";
const batchNew = "    if (isMockMode()) {\n      const results = {};\n      for (const tid of tenantIds) results[tid] = { score: MOCK_CREDIT_SCORE(tid).score, tier: 'good', computedAt: new Date().toISOString() };\n      return res.status(200).json({ data: results });\n    }\n    const results = {};\n    for (const tid of tenantIds) {";
if (!s.includes(batchOld)) throw new Error('batch pattern not found');
s = s.replace(batchOld, batchNew);
fs.writeFileSync(p, s);
console.log('1. creditScoreRoutes.js patched (TDZ fix + batch mock)');

// 2. neighborhoodRoutes.js — mock branches for /compare and /:name
p = 'backend/src/routes/neighborhoodRoutes.js';
s = fs.readFileSync(p, 'utf8');
const lines = s.split('\n');
// Insert mock branch at start of /compare try block (after 'router.get('/compare'...try {')
const cmpTryIdx = lines.findIndex((l, i) => l.includes("router.get('/compare'") && lines[i + 1] && lines[i + 1].includes('try {'));
if (cmpTryIdx === -1) throw new Error('compare route not found');
const tryOpenIdx = cmpTryIdx + 1;
const mockCompare = [
  "    if (isMockMode()) {",
  "      const wanted = names.map((n) => n.toLowerCase());",
  "      const list = MOCK_NEIGHBORHOODS.filter((n) => wanted.includes(n.name.toLowerCase()));",
  "      return res.status(200).json({ data: list, requested: names });",
  "    }",
];
lines.splice(tryOpenIdx + 1, 0, ...mockCompare);
s = lines.join('\n');
// /:name route — add mock lookup before findOne
const nameIdx = lines.findIndex((l) => l.includes("router.get('/:name'"));
if (nameIdx === -1) throw new Error('name route not found');
const nameTryIdx = nameIdx + 1;
if (!lines[nameTryIdx].includes('try {')) throw new Error('name route try not found');
const mockName = [
  "    if (isMockMode()) {",
  "      const doc = MOCK_NEIGHBORHOODS.find((n) => n.name.toLowerCase() === String(req.params.name).toLowerCase());",
  "      if (!doc) return res.status(404).json({ message: 'Neighborhood not found' });",
  "      return res.status(200).json({ data: doc });",
  "    }",
];
lines.splice(nameTryIdx + 1, 0, ...mockName);
s = lines.join('\n');
fs.writeFileSync(p, s);
console.log('2. neighborhoodRoutes.js patched (mock compare + by-name)');

// 3. db.js — add supportMessages to mockStore
p = 'backend/src/config/db.js';
s = fs.readFileSync(p, 'utf8');
if (!s.includes('supportMessages:')) {
  const anchor = '  propertyVerifications: [';
  if (!s.includes(anchor)) throw new Error('db.js anchor not found');
  s = s.replace(
    anchor,
    "  // Support inbox — messages sent from the public /support contact form (sprint-support-inbox)\n  supportMessages: [],\n  " + anchor
  );
  fs.writeFileSync(p, s);
  console.log('3. db.js patched (supportMessages store)');
} else {
  console.log('3. db.js already has supportMessages');
}
