const mongoose = require('mongoose');

const { Schema } = mongoose;

const propertyVerificationSchema = new Schema({
    propertyId: {
        type: Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    landlordProfileId: {
        type: Schema.Types.ObjectId,
        ref: 'LandlordProfile',
        required: true
    },
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Account'
    },
    status: {
        type: String,
        enum: ['submitted', 'under_review', 'verified', 'rejected', 'more_info_needed', 'suspended'],
        default: 'submitted'
    },
    submittedDocuments: [{
        docType: {
            type: String,
            enum: [
                'title_deed',
                'kebele_id',
                'utility_bill',
                'tax_receipt',
                'power_of_attorney',
                'agency_authorization',
                'property_photos'
            ],
            required: true
        },
        fileKey: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    }],
    reviewNotes: { type: String },
    rejectionReason: { type: String },
    verifiedAt: { type: Date },
    auditTrail: [{
        action: { type: String },
        performedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
        notes: { type: String },
        timestamp: { type: Date, default: Date.now }
    }]

}, { timestamps: true });

propertyVerificationSchema.index({ propertyId: 1 });
propertyVerificationSchema.index({ landlordProfileId: 1 });
propertyVerificationSchema.index({ status: 1 });
propertyVerificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PropertyVerification', propertyVerificationSchema);
