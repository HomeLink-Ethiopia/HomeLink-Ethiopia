const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    roles: [{
        type: String,
        enum: ["tenant", "landlord", "property_manager", "service_provider", "admin"]
    }],
    preferredLanguage: { type: String, enum: ["am", "en"], default: "am" },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: String,
    lastLoginAt: Date,
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: String,
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    suspendedAt: Date,
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: String,
    emailVerificationExpires: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
}, { timestamps: true });

accountSchema.index({ email: 1 }, { unique: true });
accountSchema.index({ phone: 1 }, { unique: true });
accountSchema.index({ roles: 1 });

module.exports = mongoose.model('Account', accountSchema);
