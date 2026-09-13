const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

const app = express();

// ─── MIDDLEWARE ───
app.use(cors());

// Global JSON & form body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── ROUTES ───
app.use('/api/auth', authRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/v1/viewings', viewingRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/communication', communicationRoutes);

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

// ─── DATABASE ───
connectDB();

// ─── START SERVER ───
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ HomeLink server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🤖 AI microservice expected at: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
});
