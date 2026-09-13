const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/homelink";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("💡 Troubleshooting Tips:");
    console.error("   1. If using local MongoDB, ensure the mongod service is running (`net start MongoDB` or `mongod`).");
    console.error("   2. If using MongoDB Atlas, set your connection string in `backend/.env`:\n      MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/homelink");
    console.warn("⚠️ HomeLink API will run in offline-DB mode. Endpoints requiring database will return 503 until MongoDB connects.");
  }
};

module.exports = connectDB;