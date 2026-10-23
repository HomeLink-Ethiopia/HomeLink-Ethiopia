/**
 * Demo-data shaper (final): produces a realistic good-standing tenant.
 *  - Future rent invoices that were accidentally paid early → reset to pending
 *  - All past-due rent invoices → paid exactly on their due date
 * Run: node scripts/shape-demo-payments.js
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

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  const col = mongoose.connection.collection('tenantpayments');
  const now = new Date();

  // 1. Reset future invoices that my test accidentally paid early
  const r1 = await col.updateMany(
    { paymentType: 'rent', dueDate: { $gt: now }, status: 'paid' },
    { $set: { status: 'pending', amountPaid: 0 }, $unset: { paidAt: '', transactionReference: '' } }
  );
  console.log(`✓ reset ${r1.modifiedCount} future invoice(s) back to pending`);

  // 2. All past-due invoices → paid exactly on time
  const due = await col.find({ paymentType: 'rent', dueDate: { $lte: now } }).toArray();
  let fixed = 0;
  for (const p of due) {
    if (p.status === 'paid' && p.paidAt && p.paidAt <= p.dueDate) continue;
    await col.updateOne(
      { _id: p._id },
      { $set: { status: 'paid', amountPaid: p.amountDue, balance: 0, paidAt: p.dueDate, paymentMethod: p.paymentMethod || 'cbe' } }
    );
    fixed += 1;
  }
  console.log(`✓ ${fixed} due invoice(s) marked paid-on-time`);

  await mongoose.disconnect();
  console.log('✅ Done');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
