const mongoose = require('mongoose');

const { Schema } = mongoose;

const propertySchema = new Schema({
    landlordId: {
        type: Schema.Types.ObjectId,
        ref: 'LandlordProfile',
        required: true
    },
    managedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Account'
    },
    title: { type: String, required: true },
    description: String,
    propertyType: {
        type: String,
        enum: ["apartment", "house", "room", "studio", "villa", "compound", "commercial"],
        required: true
    },
    location: {
        address: String,
        subCity: String,
        woreda: String,
        city: { type: String, default: "Addis Ababa" },
        coordinates: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: [Number]
        }
    },
    bedrooms: Number,
    bathrooms: Number,
    sizeM2: Number,
    floor: Number,
    totalFloors: Number,
    furnished: { type: Boolean, default: false },
    amenities: [String],
    condition: { type: String, enum: ["new", "good", "needs_repair"], default: "good" },
    rentAmount: { type: Number, required: true },
    depositAmount: Number,
    currency: { type: String, default: "ETB" },
    rentFrequency: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
    availableFrom: Date,
    minLeaseDuration: Number,
    images: [{
        key: String,
        url: String,
        isPrimary: Boolean,
        uploadedAt: Date
    }],
    imageHashes: [String],
    documents: [String],
    listingStatus: {
        type: String,
        enum: ["draft", "active", "available", "reserved", "rented", "inactive", "suspended"], // sprint4: reserved and available per spec
        default: "draft"
    },
    verificationStatus: {
        type: String,
        enum: ["unverified", "pending", "verified", "rejected", "suspended"],
        default: "unverified"
    },
    // Accepts both conventions: 0-1 (fallback) and 0-100 (AI risk_score).
    // Normalized on save below.
    fraudRiskScore: { type: Number, min: 0, max: 100 },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    redFlags: [String],
    recommendationFeatureVector: [Number],
    rentEstimateCache: {
        minETB: Number,
        maxETB: Number,
        computedAt: Date
    },
    viewCount: { type: Number, default: 0 },
    favouriteCount: { type: Number, default: 0 },
    deletedAt: Date

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

propertySchema.virtual('price').get(function() { return this.rentAmount; }).set(function(v) { this.rentAmount = v; });
propertySchema.virtual('area').get(function() { return this.sizeM2; }).set(function(v) { this.sizeM2 = v; });
propertySchema.virtual('address').get(function() { return this.location?.address; });
propertySchema.virtual('availability').get(function() { return this.listingStatus === 'active' ? 'available' : this.listingStatus; }).set(function(v) { this.listingStatus = (v === 'available' ? 'active' : v); });
propertySchema.virtual('landlord').get(function() { return this.landlordId; });

propertySchema.index({ landlordId: 1 });
propertySchema.index({ "location.coordinates": "2dsphere" });
propertySchema.index({ listingStatus: 1, verificationStatus: 1 });
propertySchema.index({ propertyType: 1, rentAmount: 1, bedrooms: 1 });
propertySchema.index({ fraudRiskScore: -1 });

// Normalize fraud risk to 0-1 regardless of source convention
propertySchema.pre('validate', async function () {
  if (typeof this.fraudRiskScore === 'number' && this.fraudRiskScore > 1) {
    this.fraudRiskScore = this.fraudRiskScore / 100;
  }
  if (this.listingStatus === 'available') {
    this.listingStatus = 'active';
  }
  // Geo guard: MongoDB 2dsphere rejects coordinates:{type:"Point"} with no
  // coordinates array — remove the empty subdoc entirely.
  if (this.location?.coordinates && !Array.isArray(this.location.coordinates.coordinates)) {
    this.location.coordinates = undefined;
  }
});

module.exports = mongoose.model('Property', propertySchema);
