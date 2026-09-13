const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const verificationRoutes = require('./src/routes/verificationRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

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

// ─── ROOT ENDPOINT ───
app.get('/', (req, res) => {
  res.json({
    message: 'HomeLink API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/v1/properties',
      verification: '/api/v1/verification',
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
