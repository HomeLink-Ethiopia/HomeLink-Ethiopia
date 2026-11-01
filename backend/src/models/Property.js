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
        enum: ["draft", "active", "rented", "inactive", "suspended"],
        default: "draft"
    },
    verificationStatus: {
        type: String,
        enum: ["unverified", "pending", "verified", "rejected", "suspended"],
        default: "unverified"
    },
    fraudRiskScore: { type: Number, min: 0, max: 1 },
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

}, { timestamps: true });

propertySchema.index({ landlordId: 1 });
propertySchema.index({ "location.coordinates": "2dsphere" });
propertySchema.index({ listingStatus: 1, verificationStatus: 1 });
propertySchema.index({ propertyType: 1, rentAmount: 1, bedrooms: 1 });
propertySchema.index({ fraudRiskScore: -1 });

module.exports = mongoose.model('Property', propertySchema);
