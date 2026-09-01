const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const verificationRoutes = require('./src/routes/verificationRoutes');

const app = express();

// ─── MIDDLEWARE ───
app.use(cors());

// ✅ Global JSON parser (this makes login work!)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── ROUTES ───
app.use('/api/auth', authRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/verification', verificationRoutes);

// ─── ROOT ENDPOINT ───
app.get('/', (req, res) => {
    res.json({ message: 'HomeLink API is running' });
});

// ─── DATABASE ───
connectDB();

// ─── START SERVER ───
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ HomeLink server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});