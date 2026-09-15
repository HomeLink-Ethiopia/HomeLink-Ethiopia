const mongoose = require("mongoose");

// ─── IN-MEMORY MOCK STORE FOR OFFLINE / LOCAL DEVELOPMENT ───
let mockMode = false;

const mockStore = {
  users: new Map(),
  landlordProfiles: new Map(),
  tenantPreferences: new Map(),
  properties: [
    {
      _id: "66d1f801e12a4b001a111111",
      title: "Modern 2BR Apartment in Bole",
      description: "Bright and spacious apartment near Edna Mall with high-speed internet, backup generator, and water tank.",
      propertyType: "apartment",
      rentAmount: 42000,
      bedrooms: 2,
      bathrooms: 1,
      sizeM2: 85,
      furnished: true,
      location: { city: "Addis Ababa", subCity: "Bole", neighborhood: "Edna Mall Area" },
      amenities: ["generator", "water_tank", "wifi", "elevator", "parking"],
      listingStatus: "active",
      verificationStatus: "verified",
      fraudRiskScore: 4,
      riskLevel: "low",
      redFlags: [],
      images: [
        { key: "bole-apt-1.jpg", url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", isPrimary: true }
      ],
      landlordId: "mock-landlord-1",
      createdAt: new Date()
    },
    {
      _id: "66d1f801e12a4b001a222222",
      title: "Spacious 3BR Villa in CMC",
      description: "Quiet residential villa with private garden, modern kitchen, and 24/7 security in a gated compound.",
      propertyType: "house",
      rentAmount: 55000,
      bedrooms: 3,
      bathrooms: 2,
      sizeM2: 140,
      furnished: false,
      location: { city: "Addis Ababa", subCity: "CMC", neighborhood: "St. Michael" },
      amenities: ["water_tank", "garden", "security", "parking"],
      listingStatus: "active",
      verificationStatus: "verified",
      fraudRiskScore: 6,
      riskLevel: "low",
      redFlags: [],
      images: [
        { key: "cmc-villa-1.jpg", url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800", isPrimary: true }
      ],
      landlordId: "mock-landlord-1",
      createdAt: new Date()
    },
    {
      _id: "66d1f801e12a4b001a333333",
      title: "Executive 1BR Studio in Kazanchis",
      description: "Fully furnished executive studio walking distance to UNECA and luxury hotels. Excellent for expats and professionals.",
      propertyType: "studio",
      rentAmount: 30000,
      bedrooms: 1,
      bathrooms: 1,
      sizeM2: 50,
      furnished: true,
      location: { city: "Addis Ababa", subCity: "Kazanchis", neighborhood: "UNECA area" },
      amenities: ["generator", "water_tank", "elevator", "gym", "security"],
      listingStatus: "active",
      verificationStatus: "verified",
      fraudRiskScore: 3,
      riskLevel: "low",
      redFlags: [],
      images: [
        { key: "kazanchis-studio-1.jpg", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", isPrimary: true }
      ],
      landlordId: "mock-landlord-1",
      createdAt: new Date()
    },
    {
      _id: "66d1f801e12a4b001a444444",
      title: "Luxury 4BR Residence in Old Airport",
      description: "Premium diplomatic residence featuring expansive living rooms, en-suite bathrooms, and generator backup.",
      propertyType: "house",
      rentAmount: 95000,
      bedrooms: 4,
      bathrooms: 3,
      sizeM2: 230,
      furnished: true,
      location: { city: "Addis Ababa", subCity: "Old Airport", neighborhood: "Embassy Row" },
      amenities: ["generator", "water_tank", "garden", "security", "parking"],
      listingStatus: "active",
      verificationStatus: "verified",
      fraudRiskScore: 5,
      riskLevel: "low",
      redFlags: [],
      images: [
        { key: "oldairport-1.jpg", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800", isPrimary: true }
      ],
      landlordId: "mock-landlord-1",
      createdAt: new Date()
    }
  ]
};

// Seed a default landlord profile for tests
mockStore.landlordProfiles.set("mock-landlord-1", {
  _id: "mock-landlord-1",
  accountId: "mock-landlord-1",
  legalName: "HomeLink Verified Landlord",
  verificationStatus: "verified",
  verifiedPropertiesCount: 4
});

const isMockMode = () => mockMode || mongoose.connection.readyState !== 1;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/homelink";
  try {
    // Disable operation buffering so queries don't hang if disconnected
    mongoose.set('bufferCommands', false);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    mockMode = false;
    console.log("✅ MongoDB connected successfully to:", uri);
  } catch (error) {
    mockMode = true;
    console.warn("⚠️ MongoDB connection unavailable (" + error.message + ").");
    console.log("⚡ [MOCK DB ACTIVATED] HomeLink is running in in-memory development mode.");
    console.log("💡 All features (Auth, Properties, AI endpoints) will operate in-memory without crashing.");
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.isMockMode = isMockMode;
module.exports.mockStore = mockStore;