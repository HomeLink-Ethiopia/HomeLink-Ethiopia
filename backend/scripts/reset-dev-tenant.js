/**
 * One-off: reset the dev tenant account password so API tests can log in.
 * Run from the backend folder: node scripts/reset-dev-tenant.js
 */
const path = require('path');
const B = path.resolve(__dirname, '..');

require(path.join(B, 'scripts', 'doh-preload.js'));

const mongoose = require(path.join(B, 'node_modules', 'mongoose'));
const bcrypt = require(path.join(B, 'node_modules', 'bcryptjs'));

// Load .env (simple KEY=VALUE parser — server uses a dotenvx shim, so parse manually)
const fs = require('fs');
try {
  const raw = fs.readFileSync(path.join(B, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
} catch (err) {
  console.error('env load failed:', err.message);
}

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    const users = mongoose.connection.collection('users');
    const devs = await users
      .find({ email: /dev\.(tenant|landlord|admin)@homelink/ })
      .project({ email: 1, role: 1 })
      .toArray();
    console.log('dev accounts:', JSON.stringify(devs));

    const h = await bcrypt.hash('Tenant@123', 10);
    const r = await users.updateOne(
      { email: 'dev.tenant@homelink.test' },
      { $set: { password: h } }
    );
    console.log('tenant password reset:', r.modifiedCount === 1 ? 'OK' : 'NOT FOUND');
    await mongoose.disconnect();
  })
  .catch((e) => {
    console.error('DB ERR', e.message);
    process.exit(1);
  });
