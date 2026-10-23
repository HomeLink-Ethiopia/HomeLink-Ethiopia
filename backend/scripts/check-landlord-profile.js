/**
 * One-off diagnostic: inspect a property's landlord profile + accountId linkage.
 */
const path = require('path');
const fs = require('fs');
const B = path.resolve(__dirname, '..');

require(path.join(B, 'scripts', 'doh-preload.js'));

for (const line of fs.readFileSync(path.join(B, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const mongoose = require(path.join(B, 'node_modules', 'mongoose'));
const PROPERTY_ID = process.argv[2] || '6aad984f7329848d31411dad';

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    const db = mongoose.connection;
    const { ObjectId } = require('mongodb');
    const p = await db.collection('properties').findOne({ _id: new ObjectId(PROPERTY_ID) });
    console.log('property.landlordId:', p.landlordId);
    const lp = await db.collection('landlordprofiles').findOne({ _id: p.landlordId });
    console.log('landlordProfile:', JSON.stringify(lp, null, 1).slice(0, 500));
    await mongoose.disconnect();
  })
  .catch((e) => {
    console.error('ERR', e.message);
    process.exit(1);
  });
