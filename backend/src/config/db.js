const mongoose = require("mongoose");

// STRICT MODE: Only use mock if we explicitly say so in .env
const isMockMode = () => process.env.USE_MOCK_DB === "true";

// Minimal mock store just in case you ever need it
const mockStore = {
  users: new Map(),
  landlordProfiles: new Map(),
  tenantPreferences: new Map(),
  properties: [],
  applications: [],
  viewings: [],
  agreements: []
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/homelink";
  
  if (isMockMode()) {
    console.warn("⚠️  [MOCK MODE ENABLED] Using in-memory store (data will NOT persist).");
    return;
  }

  try {
    mongoose.set('bufferCommands', false);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ MongoDB connected successfully to:", uri.split('@')[1] || uri);
  } catch (error) {
    console.error("❌ MongoDB connection FAILED:", error.message);
    console.error("⚠️  The server will start, but database operations will fail.");
    console.error("💡 If you are in Ethiopia, turn on your VPN to connect to Atlas!");
    // DO NOT silently fall back to mock mode. Let it fail loudly.
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.isMockMode = isMockMode;
module.exports.mockStore = mockStore;