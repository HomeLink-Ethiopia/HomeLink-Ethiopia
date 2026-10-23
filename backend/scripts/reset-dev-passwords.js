/**
 * One-off: reset all dev account passwords to known values.
 * Run from the backend folder: node scripts/reset-dev-passwords.js
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
const bcrypt = require(path.join(B, 'node_modules', 'bcryptjs'));

const PASSWORDS = {
  'dev.admin@homelink.test': 'Admin@123',
  'dev.landlord@homelink.test': 'Landlord@123',
  'dev.tenant@homelink.test': 'Tenant@123',
};

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    const users = mongoose.connection.collection('users');
    for (const [email, pw] of Object.entries(PASSWORDS)) {
      const h = await bcrypt.hash(pw, 10);
      const r = await users.updateOne({ email }, { $set: { password: h } });
      console.log(email, r.modifiedCount === 1 ? '→ OK' : '→ NOT FOUND');
    }
    await mongoose.disconnect();
  })
  .catch((e) => {
    console.error('DB ERR', e.message);
    process.exit(1);
  });
