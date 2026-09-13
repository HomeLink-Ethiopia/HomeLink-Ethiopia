const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const propertyRoutes = require("./src/routes/propertyRoutes");
const verificationRoutes = require("./src/routes/verificationRoutes");
const aiRoutes = require("./src/routes/aiRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// ── Auth routes ────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Property & Verification routes ─────────────────────────────────────────
app.use("/api/v1/properties", propertyRoutes);
app.use("/api/v1/verification", verificationRoutes);

// ── AI microservice proxy routes ───────────────────────────────────────────
app.use("/api/ai", aiRoutes);

connectDB();

app.get("/", (req, res) => {
  res.json({
    message: "HomeLink API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      ai_rent:   "POST /api/ai/estimate-rent",
      ai_fraud:  "POST /api/ai/detect-fraud",
      ai_rec:    "POST /api/ai/recommend",
      ai_health: "GET  /api/ai/health",
    },
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`HomeLink server running on port ${PORT}`);
  console.log(`AI microservice expected at: ${process.env.AI_SERVICE_URL || "http://localhost:8000"}`);
});