const fs = require('fs');
let p = 'backend/server.js';
let s = fs.readFileSync(p, 'utf8');
const anchor = "app.use('/api/v1/admin', adminRoutes);";
if (!s.includes(anchor)) throw new Error('server.js anchor not found');
if (s.includes('supportRoutes')) { console.log('already patched'); process.exit(0); }
s = s.replace(
  anchor,
  anchor + "\n\n// ─── Support inbox (public contact form + admin triage) ───\napp.use('/api/v1/support', require('./src/routes/supportRoutes'));"
);
fs.writeFileSync(p, s);
console.log('server.js patched (support route mounted)');
