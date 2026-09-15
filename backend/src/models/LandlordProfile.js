const mongoose = require('mongoose');

const { Schema } = mongoose;

const landlordProfileSchema = new Schema({
    accountId: {
        type: Schema.Types.ObjectId,
        ref: 'Account',
        required: true,
        unique: true
    },
    legalName: { type: String, required: true },
    profilePhoto: String,
    landlordType: {
        type: String,
        enum: ["individual", "property_management_company", "real_estate_developer"],
        default: "individual"
    },
    managingOrganizationName: String,
    organizationRegistrationNumber: String,
    taxIdentificationNumber: { type: String, unique: true, sparse: true },
    taxClearanceStatus: {
        type: String,
        enum: ["pending", "verified", "expired", "rejected"],
        default: "pending"
    },
    verificationStatus: {
        type: String,
        enum: ["unverified", "pending", "verified", "suspended"],
        default: "unverified"
    },
    verifiedPropertiesCount: { type: Number, default: 0 }
}, { timestamps: true });

landlordProfileSchema.index({ accountId: 1 }, { unique: true });
landlordProfileSchema.index({ taxIdentificationNumber: 1 }, { unique: true, sparse: true });
landlordProfileSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('LandlordProfile', landlordProfileSchema);
