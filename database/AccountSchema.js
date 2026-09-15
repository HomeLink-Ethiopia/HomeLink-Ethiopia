// ============================================================
// 1. ACCOUNT & IDENTITY (FR-01)
// Core authentication collection. This handles ONLY login credentials and security.
// Business details (like income, TIN, or ID cards) belong in separate Profile schemas.
// ============================================================
const AccountSchema = {
  // Unique MongoDB identifier
  _id: ObjectId,

  // Primary contact and login identifiers
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },

  // Securely hashed password (e.g., using argon2id for high security)
  passwordHash: { type: String, required: true },

  // Array allows a single user to act as multiple roles (e.g., both tenant AND landlord)
  roles: [{
    type: String,
    enum: ["tenant", "landlord", "property_manager", "service_provider", "admin"],
  }],

  // UI localization preference (Amharic or English)
  preferredLanguage: { type: String, enum: ["am", "en"], default: "am" },

  // ─────────────────────────────────────────────────────────────
  // SECURITY & MFA (Multi-Factor Authentication)
  // ─────────────────────────────────────────────────────────────

  // Flag checked during login. If true, backend requires a 6-digit TOTP code.
  mfaEnabled: { type: Boolean, default: false },

  // The seed string used to generate/verify the 6-digit codes (e.g., via Google Authenticator).
  // Must be encrypted at rest in the database.
  mfaSecret: String,

  // Audit timestamp for the last successful authentication
  lastLoginAt: Date,

  // Brute-force protection: Tracks consecutive failed login attempts
  loginAttempts: { type: Number, default: 0 },

  // Brute-force protection: Temporarily disables login if attempts exceed the limit
  lockedUntil: Date,

  // ─────────────────────────────────────────────────────────────
  // ACCOUNT STATE & MODERATION
  // ─────────────────────────────────────────────────────────────

  // Soft delete flag. If false, the user cannot log in.
  isActive: { type: Boolean, default: true },

  // Admin moderation flag. True if the account is temporarily or permanently banned.
  isSuspended: { type: Boolean, default: false },

  // Explanation provided by the admin for the suspension
  suspensionReason: String,

  // Audit trail: Reference to the Admin account that issued the suspension
  suspendedBy: { type: ObjectId, ref: "Account" },

  // Audit trail: When the suspension occurred
  suspendedAt: Date,

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// Indexes: email (unique), phone (unique), roles (multikey), isSuspended