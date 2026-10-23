const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const verificationRoutes = require('./src/routes/verificationRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const viewingRoutes = require('./src/routes/viewingRoutes');
const applicationRoutes = require('./src/routes/applicationRoutes');
const agreementRoutes = require('./src/routes/agreementRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const maintenanceRoutes = require('./src/routes/maintenanceRoutes');
const communicationRoutes = require('./src/routes/communicationRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const fraudRoutes = require('./src/routes/fraudRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const disputeRoutes = require('./src/routes/disputeRoutes');
const adminRoutes = require('./src/routes/admin/adminRoutes');

const app = express();

// ─── MIDDLEWARE ───
// Sprint 14: strict CORS — explicit frontend-origin allowlist, credentials enabled.
// HOMELOOP_ORIGIN(S) env vars override; localhost dev ports are pre-allowed.
const allowedOrigins = (process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000').split(',').map((o) => o.trim());
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Secure headers. CORP is `cross-origin` because the frontend (different port)
// embeds uploaded images served from this API — `same-origin` silently blocks
// them in the browser.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", 'data:', 'https:'],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'"],
    },
  },
}));

// Global JSON & form body parser
// ─── Sprint 1: request logging (zero-dep) ───
// (sprint1-request-log)
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0}ms)`));
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads (property images and tenant documents)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── ROUTES ───
app.use('/api/auth', authRoutes);
// Additive compat routes (profile, landlord viewings/tenants, review lists)
const extraRoutes = require('./src/routes/extraRoutes');
app.use('/api/v1', extraRoutes);
app.use('/api/auth', extraRoutes);

app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/v1/viewings', viewingRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/communication', communicationRoutes);
// Sprint 9 compat — frontend calls /api/v1/messages/* (see messageRoutes.js header)
app.use('/api/v1/messages', require('./src/routes/messageRoutes'));
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/fraud-reports', fraudRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/admin', adminRoutes);

// ─── Support inbox (public contact form + admin triage) ───
app.use('/api/v1/support', require('./src/routes/supportRoutes'));

// ─── Smart Lease Renewal, Credit Score & Neighborhood Data ───
app.use('/api/v1/credit-score', require('./src/routes/creditScoreRoutes'));
app.use('/api/v1/neighborhoods', require('./src/routes/neighborhoodRoutes'));

// ─── Sprint 8/9 background jobs: lease expiry reminders (60/30/15 days) ───
require('./src/jobs/renewalReminders').startRenewalReminderJob();
require('./src/jobs/backupJob').startBackupJob();

// ─── Sprint 8: overdue rent sweep — flips pending → overdue once the due date passes ───
// (sprint89-overdue-sweep) Runs hourly; also sends rent_overdue notifications.
require('./src/jobs/overdueSweep').startOverdueSweepJob();

// ─── ROOT ENDPOINT ───
app.get('/', (req, res) => {
  res.json({
    message: 'HomeLink API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/v1/properties',
      verification: '/api/v1/verification',
      viewings: '/api/v1/viewings',
      applications: '/api/v1/applications',
      agreements: '/api/v1/agreements',
      payments: '/api/v1/payments',
      maintenance: '/api/v1/maintenance',
      communication: '/api/v1/communication',
      ai_rent: 'POST /api/ai/estimate-rent',
      ai_fraud: 'POST /api/ai/detect-fraud',
      ai_rec: 'POST /api/ai/recommend',
      ai_health: 'GET  /api/ai/health',
    },
  });
});

// ─── 404 + CENTRAL ERROR HANDLER (Sprint 14) ───
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' });
  }
  if (err && (err.type === 'entity.too.large' || /too large|entity/i.test(err.message || ''))) {
    return res.status(413).json({ message: 'Request body too large' });
  }
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'File upload rejected';
    return res.status(400).json({ message: msg });
  }
  if (err && /Only image files|Only images|documents/i.test(err.message || '')) {
    return res.status(400).json({ message: err.message });
  }
  if (err && /before initial connection/i.test(err.message || '')) {
    return res.status(503).json({ message: 'Database unavailable, try again shortly' });
  }
  console.error('Unhandled error:', err && err.message);
  res.status(500).json({ message: 'Internal server error' });
});


// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' });
  }
  if (err && (err.type === 'entity.too.large' || /too large|entity/i.test(err.message || ''))) {
    return res.status(413).json({ message: 'Request body too large' });
  }
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'File upload rejected';
    return res.status(400).json({ message: msg });
  }
  console.error('Unhandled error:', err && err.message);
  res.status(500).json({ message: 'Internal server error' });
});

// ─── DATABASE ───
connectDB();
// Sprint 14: ensure schema indexes (incl. unique constraints) exist in MongoDB.
if (typeof connectDB.syncIndexes === 'function') {
  connectDB.syncIndexes().catch((err) => console.error('Index sync failed:', err.message));
}

// ─── START SERVER ───
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ HomeLink server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🤖 AI microservice expected at: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
});
