// ============================================================
// 3. LANDLORD PROFILE (FR-01, FR-02)
// One-to-one relationship with the core Account schema. 
// Holds specific business, organizational, and tax compliance data[cite: 1].
// ============================================================
const LandlordProfileSchema = {
  // Unique MongoDB identifier for this profile document
  _id: ObjectId,

  // Links directly to the core Auth Account. 
  // 'unique: true' ensures one account can only have one landlord profile.
  accountId: { type: ObjectId, ref: "Account", required: true, unique: true },

  // The legal name of the person or entity (used for legally binding Rental Agreements)
  legalName: { type: String, required: true },

  // URL or storage key for the landlord or company's profile logo/photo
  profilePhoto: String,

  // ─────────────────────────────────────────────────────────────
  // BUSINESS & ORGANIZATION DETAILS
  // ─────────────────────────────────────────────────────────────
  
  // Categorizes the landlord to determine which legal documents are required
  landlordType: {
    type: String,
    enum: ["individual", "property_management_company", "real_estate_developer"],
    default: "individual",
  },
  
  // Required if the type is 'property_management_company' or 'real_estate_developer'
  managingOrganizationName: String,
  
  // Official business registration number (e.g., from the Ministry of Trade)
  organizationRegistrationNumber: String,

  // ─────────────────────────────────────────────────────────────
  // TAX & LEGAL COMPLIANCE
  // ─────────────────────────────────────────────────────────────
  
  // Ethiopian Tax Identification Number. 
  // 'sparse: true' allows multiple users to have a 'null' TIN during initial signup 
  // without triggering a MongoDB unique index collision.
  taxIdentificationNumber: { type: String, unique: true, sparse: true },
  
  // Tracks whether the admin has verified the landlord's tax clearance certificate
  taxClearanceStatus: {
    type: String,
    enum: ["pending", "verified", "expired", "rejected"],
    default: "pending",
  },

  // Overall platform trust status. If suspended, their properties should be hidden from search[cite: 1].
  verificationStatus: {
    type: String,
    enum: ["unverified", "pending", "verified", "suspended"],
    default: "unverified",
  },
  
  // Cached aggregate count of properties this landlord currently has in the "verified" state.
  // Helps frontend quickly display stats without heavy database queries.
  verifiedPropertiesCount: { type: Number, default: 0 },

  // Standard timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
};

// Indexes: 
// - accountId (unique)
// - taxIdentificationNumber (sparse unique): Crucial for preventing duplicate TINs while allowing nulls.
// - verificationStatus: Speeds up queries when filtering out unverified landlords.