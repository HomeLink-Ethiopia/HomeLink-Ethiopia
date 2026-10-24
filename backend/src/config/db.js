const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// ─── IN-MEMORY MOCK STORE FOR OFFLINE / LOCAL DEVELOPMENT ───
let mockMode = false;

// ─── PERSISTENT MOCK USERS (sprint-persist-mock-users) ───
// The in-memory user store is wiped on every backend restart, which made
// accounts registered from the signup page disappear (and sign-in fail with
// "Invalid email or password"). Registered users are now mirrored to disk
// and reloaded at boot so demo signups survive restarts.
const MOCK_USERS_FILE = path.join(__dirname, "..", "..", "mock-users.json");
const MOCK_DATA_FILE = path.join(__dirname, "..", "..", "mock-data.json");

const persistMockUsers = () => {
  try {
    fs.writeFileSync(MOCK_USERS_FILE, JSON.stringify([...mockStore.users.entries()], null, 2));
  } catch (e) {
    console.warn("[MOCK DB] could not persist users:", e.message);
  }
};

const persistMockData = () => {
  try {
    const dataToSave = {
      applications: mockStore.applications || [],
      viewings: mockStore.viewings || [],
      agreements: mockStore.agreements || [],
      properties: mockStore.properties || [],
      payments: mockStore.payments || [],
      conversations: mockStore.conversations || [],
      messages: mockStore.messages || [],
      landlordProfiles: Array.from((mockStore.landlordProfiles || new Map()).entries()),
    };
    fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (e) {
    console.warn("[MOCK DB] could not persist mock data:", e.message);
  }
};

const loadMockUsers = () => {
  try {
    if (fs.existsSync(MOCK_USERS_FILE)) {
      const entries = JSON.parse(fs.readFileSync(MOCK_USERS_FILE, "utf8"));
      for (const [email, user] of entries) {
        if (!mockStore.users.has(email)) mockStore.users.set(email, user);
      }
      console.log(`[MOCK DB] restored ${entries.length} persisted user(s) from mock-users.json`);
    }
  } catch (e) {
    console.warn("[MOCK DB] could not load persisted users:", e.message);
  }
};

const loadMockData = () => {
  try {
    if (fs.existsSync(MOCK_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf8"));
      if (Array.isArray(data.applications)) {
        for (const app of data.applications) {
          if (!mockStore.applications.some((a) => a._id === app._id)) {
            mockStore.applications.push(app);
          }
        }
      }
      if (Array.isArray(data.viewings)) {
        for (const v of data.viewings) {
          if (!mockStore.viewings.some((x) => x._id === v._id)) {
            mockStore.viewings.push(v);
          }
        }
      }
      if (Array.isArray(data.agreements)) {
        for (const agr of data.agreements) {
          if (!mockStore.agreements.some((x) => x._id === agr._id)) {
            mockStore.agreements.push(agr);
          }
        }
      }
      if (Array.isArray(data.properties)) {
        for (const prop of data.properties) {
          if (!mockStore.properties.some((x) => x._id === prop._id)) {
            mockStore.properties.push(prop);
          }
        }
      }
      if (Array.isArray(data.payments)) {
        for (const p of data.payments) {
          if (!mockStore.payments.some((x) => x._id === p._id)) {
            mockStore.payments.push(p);
          }
        }
      }
      if (Array.isArray(data.conversations)) {
        for (const c of data.conversations) {
          if (!mockStore.conversations.some((x) => x._id === c._id)) {
            mockStore.conversations.push(c);
          }
        }
      }
      if (Array.isArray(data.messages)) {
        for (const m of data.messages) {
          if (!mockStore.messages.some((x) => x._id === m._id)) {
            mockStore.messages.push(m);
          }
        }
      }
      if (Array.isArray(data.landlordProfiles)) {
        for (const [key, val] of data.landlordProfiles) {
          if (!mockStore.landlordProfiles.has(key)) {
            mockStore.landlordProfiles.set(key, val);
          }
        }
      }
      console.log(`[MOCK DB] restored persistent applications, viewings, agreements from mock-data.json`);
    }
  } catch (e) {
    console.warn("[MOCK DB] could not load persistent mock data:", e.message);
  }
};
const mockStore = {
  users: new Map(),
  landlordProfiles: new Map(),
  viewings: [],
  applications: [],
  maintenance: [],
  disputes: [],
  auditLogs: [
    {
      _id: "mock-audit-seed-1",
      actorName: "Dev Admin",
      actorRole: "admin",
      action: "landlord.verified",
      targetType: "landlord",
      targetLabel: "HomeLink Verified Landlord (dev.landlord@homelink.test)",
      changes: [{ field: "verificationStatus", from: "pending", to: "verified" }],
      decision: "landlord.verified",
      reason: "Identity document and ownership lease verified.",
      ip: "127.0.0.1",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
  // Support inbox — messages sent from the public /support contact form (sprint-support-inbox)
  supportMessages: [],
    propertyVerifications: [
    {
      _id: "mock-propver-1",
      propertyId: { _id: "66d1f801e12a4b001a444444", title: "Luxury 4BR Residence in Old Airport", address: "Embassy Row, Old Airport, Addis Ababa", price: 95000 },
      landlordProfileId: { _id: "mock-landlord-1", legalName: "HomeLink Verified Landlord", phone: "0911223344" },
      status: "submitted",
      submittedDocuments: [
        { fileKey: "/uploads/ownership-oldairport.pdf", name: "ownership-deed.pdf" },
        { fileKey: "/uploads/id-oldairport.jpg", name: "national-id.jpg" },
      ],
      reviewNotes: "",
      rejectionReason: "",
      auditTrail: [],
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ],
  reviews: [
    {
      _id: "mock-review-1",
      reviewerId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com" },
      revieweeId: "mock-landlord-1",
      propertyId: "66d1f801e12a4b001a111111",
      agreementId: "mock-agreement-1",
      reviewType: "tenant_to_property",
      rating: 5,
      comment: "Bright, clean apartment exactly as listed. The landlord responded within minutes and the handover was smooth.",
      landlordReply: "",
      status: "visible",
      createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
    {
      _id: "mock-review-2",
      reviewerId: { _id: "mock-user-seed-2", firstName: "Mikias", lastName: "Bekele", email: "mikias@example.com" },
      revieweeId: "mock-landlord-1",
      propertyId: "66d1f801e12a4b001a222222",
      agreementId: "mock-agreement-2",
      reviewType: "tenant_to_property",
      rating: 4,
      comment: "Spacious villa in a quiet compound. Water pressure dips occasionally but maintenance fixed it fast.",
      landlordReply: "Thank you Mikias - the water pump has been upgraded since your note.",
      status: "visible",
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      _id: "mock-review-3",
      reviewerId: "mock-landlord-1",
      revieweeId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye" },
      propertyId: "66d1f801e12a4b001a111111",
      agreementId: "mock-agreement-1",
      reviewType: "landlord_to_tenant",
      rating: 5,
      comment: "Punctual with rent and kept the apartment in great condition.",
      landlordReply: "",
      status: "visible",
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
  ],
  fraudReports: [
    {
      _id: "mock-fraud-1",
      reportedBy: { _id: "mock-user-seed-2", firstName: "Mikias", lastName: "Bekele" },
      reportedPropertyId: "66d1f801e12a4b001a333333",
      reportedUserId: null,
      category: "duplicate_listing",
      description: "The same studio photos appear on three different accounts with different prices.",
      evidenceKeys: [],
      aiRiskScore: 0.55,
      aiRiskLevel: "MEDIUM",
      aiSignals: ["multiple_historical_reports (2)", "duplicate_images_detected"],
      status: "open",
      adminNotes: "",
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      history: [{ status: "open", note: "Report filed. AI Risk Assessed as MEDIUM.", at: new Date().toISOString() }],
    },
  ],
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
        { key: "bole-apt-1.jpg", url: "/uploads/homes/apartment-tower.png", isPrimary: true }
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
        { key: "cmc-villa-1.jpg", url: "/uploads/homes/white-villa.png", isPrimary: true }
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
        { key: "kazanchis-studio-1.jpg", url: "/uploads/homes/compound-house.png", isPrimary: true }
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
        { key: "oldairport-1.jpg", url: "/uploads/homes/garden-villa.png", isPrimary: true }
      ],
      landlordId: "mock-landlord-1",
      createdAt: new Date()
    }
  ]
};

// Seed a default landlord profile for tests

// Seed demo workflow rows (viewings, applications, maintenance) for dashboards
const __seedUser = () => {
  const u = Array.from(mockStore.users.values())[0];
  return u ? u._id : "mock-user-seed-1";
};
mockStore.viewings.push(
  { _id: "mock-viewing-1", propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole", location: { subCity: "Bole" } }, tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye" }, landlordId: "mock-landlord-1", requestedSlots: [{ date: new Date(Date.now() + 2 * 86400000).toISOString(), startTime: "10:00" }], preferredDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), preferredTime: "10:00", tenantNote: "Coming with my sister, is parking available?", status: "requested", createdAt: new Date().toISOString() },
);
mockStore.applications.push(
  { _id: "mock-application-1", propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole", rentAmount: 42000 }, tenantId: "mock-user-seed-1", landlordId: "mock-landlord-1", status: "under_review", employmentStatus: "Employed", monthlyIncome: 25000, createdAt: new Date(Date.now() - 86400000).toISOString() },
);
mockStore.maintenance.push(
  { _id: "mock-maintenance-1", propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" }, tenantId: "mock-user-seed-1", landlordId: "mock-landlord-1", issue: "Kitchen faucet dripping", description: "Hot water tap drips continuously.", priority: "medium", status: "in_progress", createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updates: [{ note: "Plumber scheduled for Thursday.", at: new Date().toISOString() }] },
);
// Sprint 10 — demo rental agreements so dashboards, the landlord tenants list,
// and "Rate your tenants" / tenant review flows work offline.
const { STANDARD_RENTAL_TERMS } = require('../utils/rentalTerms');

// Sprint 8 / 10 — digital rental agreements containing tenant, landlord, property, rent, deposit, dates, terms, status
mockStore.agreements = mockStore.agreements || [];
mockStore.agreements.push(
  {
    _id: "mock-agreement-1",
    propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole", rentAmount: 42000, location: { city: "Addis Ababa", subCity: "Bole", neighborhood: "Edna Mall Area" } },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: { _id: "mock-landlord-1", firstName: "Abebe", lastName: "Kebede", email: "dev.landlord@homelink.test", phone: "+251922334455" },
    status: "active",
    rentAmount: 42000,
    depositAmount: 42000,
    paymentDueDay: 5,
    paymentFrequency: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    terms: STANDARD_RENTAL_TERMS,
    specialConditions: "Standard residential lease agreement under Ethiopian law. Quiet hours after 10 PM.",
    tenantSignedAt: "2026-01-01T00:00:00.000Z",
    landlordSignedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    _id: "mock-agreement-2",
    propertyId: { _id: "66d1f801e12a4b001a222222", title: "Spacious 3BR Villa in CMC", rentAmount: 55000, location: { city: "Addis Ababa", subCity: "CMC", neighborhood: "Michael Compound" } },
    tenantId: { _id: "mock-user-seed-2", firstName: "Mikias", lastName: "Bekele", email: "mikias@example.com", phone: "+251933445566" },
    landlordId: { _id: "mock-landlord-1", firstName: "Abebe", lastName: "Kebede", email: "dev.landlord@homelink.test", phone: "+251922334455" },
    status: "active",
    rentAmount: 55000,
    depositAmount: 55000,
    paymentDueDay: 5,
    paymentFrequency: "monthly",
    startDate: "2026-02-01",
    endDate: "2027-01-31",
    terms: STANDARD_RENTAL_TERMS,
    specialConditions: "Tenant responsible for private garden maintenance.",
    tenantSignedAt: "2026-02-01T00:00:00.000Z",
    landlordSignedAt: "2026-02-01T00:00:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z"
  },
  {
    _id: "mock-agreement-3",
    propertyId: { _id: "66d1f801e12a4b001a333333", title: "Executive 1BR Studio in Kazanchis", rentAmount: 30000, location: { city: "Addis Ababa", subCity: "Kazanchis", neighborhood: "UN ECA Area" } },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: { _id: "mock-landlord-1", firstName: "Abebe", lastName: "Kebede", email: "dev.landlord@homelink.test", phone: "+251922334455" },
    status: "pending_signatures",
    rentAmount: 30000,
    depositAmount: 30000,
    paymentDueDay: 5,
    paymentFrequency: "monthly",
    startDate: "2026-11-01",
    endDate: "2027-10-31",
    terms: STANDARD_RENTAL_TERMS,
    specialConditions: "Approved from rental application. Landlord confirmed, awaiting tenant digital signature.",
    tenantSignedAt: null,
    landlordSignedAt: "2026-10-21T09:30:00.000Z", // Landlord has confirmed; tenant confirms next!
    createdAt: "2026-10-21T09:00:00.000Z"
  }
);

// Sprint 15: seed realistic payment history for landlord and tenant dashboards
mockStore.payments = mockStore.payments || [];
mockStore.payments.push(
  {
    _id: "mock-pay-1",
    agreementId: "mock-agreement-1",
    propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-10",
    dueDate: "2026-10-05T00:00:00.000Z",
    amountDue: 42000,
    amountPaid: 42000,
    balance: 0,
    status: "paid",
    paidAt: "2026-10-04T10:30:00.000Z",
    paymentMethod: "chapa",
    transactionReference: "TX-CHP-202610-01",
    receiptNumber: "RCPT-1001",
    receiptKey: "/images/receipts/cbe-receipt.svg",
    receiptUrl: "/images/receipts/cbe-receipt.svg",
    notes: "October rent paid on time via Chapa",
  },
  {
    _id: "mock-pay-2",
    agreementId: "mock-agreement-1",
    propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-09",
    dueDate: "2026-09-05T00:00:00.000Z",
    amountDue: 42000,
    amountPaid: 42000,
    balance: 0,
    status: "paid",
    paidAt: "2026-09-04T14:15:00.000Z",
    paymentMethod: "telebirr",
    transactionReference: "TX-TB-202609-02",
    receiptNumber: "RCPT-0902",
    receiptKey: "/images/receipts/telebirr-receipt.svg",
    receiptUrl: "/images/receipts/telebirr-receipt.svg",
    notes: "September rent settled via Telebirr",
  },
  {
    _id: "mock-pay-3",
    agreementId: "mock-agreement-1",
    propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-08",
    dueDate: "2026-08-05T00:00:00.000Z",
    amountDue: 42000,
    amountPaid: 42000,
    balance: 0,
    status: "paid",
    paidAt: "2026-08-05T09:00:00.000Z",
    paymentMethod: "cbe",
    transactionReference: "TX-CBE-202608-03",
    receiptNumber: "RCPT-0803",
    receiptKey: "/images/receipts/cbe-receipt.svg",
    receiptUrl: "/images/receipts/cbe-receipt.svg",
  },
  {
    _id: "mock-pay-4",
    agreementId: "mock-agreement-2",
    propertyId: { _id: "66d1f801e12a4b001a222222", title: "Spacious 3BR Villa in CMC" },
    tenantId: { _id: "mock-user-seed-2", firstName: "Mikias", lastName: "Bekele", email: "mikias@example.com", phone: "+251922334455" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-10",
    dueDate: "2026-10-01T00:00:00.000Z",
    amountDue: 55000,
    amountPaid: 0,
    balance: 55000,
    status: "overdue",
    paymentMethod: "bank_transfer",
    notes: "Tenant traveling abroad; reminder sent.",
  },
  {
    _id: "mock-pay-5",
    agreementId: "mock-agreement-2",
    propertyId: { _id: "66d1f801e12a4b001a222222", title: "Spacious 3BR Villa in CMC" },
    tenantId: { _id: "mock-user-seed-2", firstName: "Mikias", lastName: "Bekele", email: "mikias@example.com", phone: "+251922334455" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-09",
    dueDate: "2026-09-01T00:00:00.000Z",
    amountDue: 55000,
    amountPaid: 55000,
    balance: 0,
    status: "paid",
    paidAt: "2026-09-01T11:45:00.000Z",
    paymentMethod: "bank_transfer",
    transactionReference: "TX-AWASH-202609-05",
    receiptNumber: "RCPT-0905",
    receiptKey: "/images/receipts/cbe-receipt.svg",
    receiptUrl: "/images/receipts/cbe-receipt.svg",
  },
  {
    _id: "mock-pay-6",
    agreementId: "mock-agreement-2",
    propertyId: { _id: "66d1f801e12a4b001a222222", title: "Spacious 3BR Villa in CMC" },
    tenantId: { _id: "mock-user-seed-2", firstName: "Mikias", lastName: "Bekele", email: "mikias@example.com", phone: "+251922334455" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-08",
    dueDate: "2026-08-01T00:00:00.000Z",
    amountDue: 55000,
    amountPaid: 55000,
    balance: 0,
    status: "paid",
    paidAt: "2026-08-02T16:00:00.000Z",
    paymentMethod: "cbe",
    transactionReference: "TX-CBE-202608-06",
    receiptNumber: "RCPT-0806",
    receiptKey: "/images/receipts/cbe-receipt.svg",
    receiptUrl: "/images/receipts/cbe-receipt.svg",
  },
  {
    _id: "mock-pay-7",
    agreementId: "mock-agreement-3",
    propertyId: { _id: "66d1f801e12a4b001a333333", title: "Executive 1BR Studio in Kazanchis" },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-10",
    dueDate: "2026-10-28T00:00:00.000Z",
    amountDue: 30000,
    amountPaid: 0,
    balance: 30000,
    status: "pending",
    notes: "Invoice dispatched; due end of month.",
  },
  {
    _id: "mock-pay-8",
    agreementId: "mock-agreement-3",
    propertyId: { _id: "66d1f801e12a4b001a333333", title: "Executive 1BR Studio in Kazanchis" },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: "mock-landlord-1",
    paymentType: "rent",
    periodMonth: "2026-09",
    dueDate: "2026-09-28T00:00:00.000Z",
    amountDue: 30000,
    amountPaid: 30000,
    balance: 0,
    status: "paid",
    paidAt: "2026-09-26T17:10:00.000Z",
    paymentMethod: "telebirr",
    transactionReference: "TX-TB-202609-08",
    receiptNumber: "RCPT-0908",
    receiptKey: "/images/receipts/telebirr-receipt.svg",
    receiptUrl: "/images/receipts/telebirr-receipt.svg",
  },
  {
    _id: "mock-pay-9",
    agreementId: "mock-agreement-1",
    propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" },
    tenantId: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" },
    landlordId: "mock-landlord-1",
    paymentType: "deposit",
    periodMonth: "2026-01",
    dueDate: "2026-01-01T00:00:00.000Z",
    amountDue: 84000,
    amountPaid: 84000,
    balance: 0,
    status: "paid",
    paidAt: "2026-01-01T12:00:00.000Z",
    paymentMethod: "bank_transfer",
    receiptNumber: "RCPT-DEP-001",
    receiptKey: "/images/receipts/cbe-receipt.svg",
    receiptUrl: "/images/receipts/cbe-receipt.svg",
    notes: "Security deposit held in escrow (2 months)",
  }
);

mockStore.landlordProfiles.set("mock-landlord-1", {
  _id: "mock-landlord-1",
  accountId: "mock-landlord-1",
  legalName: "HomeLink Landlord",
  verificationStatus: "verified",
  submittedDocuments: [],
  verifiedPropertiesCount: 4
});

// Sprint 11 — a pending landlord profile for the verification workbench
mockStore.landlordProfiles.set("mock-landlord-2", {
  _id: "mock-landlord-2",
  accountId: { _id: "mock-user-seed-2", email: "mikias@example.com" },
  legalName: "Mikias Bekele",
  phone: "0922334455",
  verificationStatus: "pending",
  verifiedPropertiesCount: 0,
  submittedDocuments: [
    { fileKey: "/uploads/id-mikias.jpg", name: "national-id.jpg" },
    { fileKey: "/uploads/lease-mikias.pdf", name: "ownership-lease.pdf" },
  ],
  createdAt: new Date(Date.now() - 86400000).toISOString(),
});

// Sprint 11 — demo dispute (tenant vs landlord over a deposit refund)
mockStore.disputes.push(
  { _id: "mock-dispute-1", raisedBy: { _id: "mock-user-seed-1", firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", role: "tenant" }, againstUserId: { _id: "mock-landlord-1", firstName: "Dev", lastName: "Landlord", email: "dev.landlord@homelink.test", role: "landlord" }, agreementId: "mock-agreement-1", propertyId: { _id: "66d1f801e12a4b001a111111", title: "Modern 2BR Apartment in Bole" }, category: "deposit_refund", reason: "deposit_refund", description: "Move-out inspection was done together and the apartment was left clean, but the one-month deposit has not been returned after 3 weeks.", evidence: ["rent-receipt-march.pdf"], evidenceKeys: [], status: "open", filedByRole: "tenant", communications: [], thread: [], history: [{ status: "open", note: "Dispute opened by user.", at: new Date(Date.now() - 3 * 86400000).toISOString() }], createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
);

// Sprint 11 — record an admin action in the in-memory audit trail.
// Shaped for the admin Audit Logs page (actorName/action/targetType/...).
const pushMockAudit = (req, action, targetType, targetLabel, before, after, reason) => {
  mockStore.auditLogs = mockStore.auditLogs || [];
  mockStore.auditLogs.push({
    _id: "mock-audit-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    actorName: ((((req && req.user && req.user.firstName) || "Admin") + " " + ((req && req.user && req.user.lastName) || "")).trim()),
    actorRole: (req && req.user && req.user.role) || "admin",
    action,
    targetType,
    targetLabel,
    changes: [{ field: "status", from: String(before), to: String(after) }],
    decision: action,
    reason: reason || "",
    ip: (req && req.ip) || "-",
    createdAt: new Date().toISOString(),
  });
};

// ─── Sprint 8/9: mock conversations / messages / notifications store ───
// (sprint89-mock-comms) Centralized notification system works offline too.
// (sprint567-stores) tenant saved-properties + preference profiles
mockStore.favourites = mockStore.favourites || [];
mockStore.tenantPreferences = mockStore.tenantPreferences || {};

// (sprint567-ratings) aggregate ratings for property details (from reviews store)
const mockPropertyRating = (propertyId) => {
  const rows = (mockStore.reviews || []).filter((r) => r.propertyId === propertyId && r.rating);
  if (!rows.length) return { average: null, count: 0 };
  return {
    average: Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10,
    count: rows.length,
  };
};

// (sprint4-property-status) spec availability states on every seeded listing
(mockStore.properties || []).forEach((p) => { p.status = p.status || "active"; });

mockStore.conversations = mockStore.conversations || [];
mockStore.messages = mockStore.messages || [];
mockStore.notifications = mockStore.notifications || [];

// Persist a notification in mock mode; safe no-op if the user row is unknown.
const mockCreateNotification = (userId, type, title, body, entityType, entityId) => {
  if (!userId) return;
  mockStore.notifications.push({
    _id: "mock-notif-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    userId: typeof userId === "object" ? userId._id || userId : userId,
    type,
    title: title || "",
    body: body || "",
    relatedEntity: entityType ? { entityType, entityId } : undefined,
    channels: ["in_app"],
    isRead: false,
    createdAt: new Date().toISOString(),
  });
};

const isMockMode = () => mockMode || mongoose.connection.readyState !== 1;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/homelink";
  try {
    // Disable operation buffering so queries don't hang if disconnected
    mongoose.set('bufferCommands', false);
    // 30s: slow networks (e.g. mobile/DoH-resolved DNS) need more than a few seconds
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    mockMode = false;
    console.log("✅ MongoDB connected successfully to:", uri);
  } catch (error) {
    mockMode = true;
    console.warn("⚠️ MongoDB connection unavailable (" + error.message + ").");
    console.log("⚡ [MOCK DB ACTIVATED] HomeLink is running in in-memory development mode.");
    console.log("💡 All features (Auth, Properties, AI endpoints) will operate in-memory without crashing.");
  }
};

// Sprint 14: schema index sync (unique constraints + query indexes) for prod DB.
connectDB.syncIndexes = async function syncIndexes() {
  if (isMockMode()) return;
  const modelsDir = path.join(__dirname, '..', 'models');
  for (const f of fs.readdirSync(modelsDir).filter((x) => x.endsWith('.js'))) {
    try {
      const model = require(path.join(modelsDir, f));
      if (model && model.syncIndexes) await model.syncIndexes();
    } catch (e) { /* skip non-model files */ }
  }
};

// Periodic mock-store backup (Sprint 14) — snapshot JSON to disk with rotation.
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = 10;
function writeMockBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const snapshot = { createdAt: new Date().toISOString(), collections: {} };
    for (const [key, val] of Object.entries(mockStore)) {
      snapshot.collections[key] = val instanceof Map ? Array.from(val.values()) : val;
    }
    const name = 'mock-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    fs.writeFileSync(path.join(BACKUP_DIR, name), JSON.stringify(snapshot, null, 2));
    const old = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('mock-backup-')).sort();
    while (old.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, old.shift()));
  } catch (e) { /* backup failure must never crash the API */ }
}
connectDB.writeMockBackup = writeMockBackup;
if (!connectDB._backupTimer) {
  connectDB._backupTimer = setInterval(writeMockBackup, 10 * 60 * 1000);
  if (typeof connectDB._backupTimer.unref === 'function') connectDB._backupTimer.unref();
}// restore persisted users after mockStore is defined (sprint-persist-mock-users)
loadMockUsers();
// Seed the three dev demo accounts at boot (sprint-persist-mock-users):
// previously they were only created on the first login attempt, so a JWT
// issued before a restart hit adminGate with an empty user store and every
// admin API returned 403 ("signed in but nothing works").
const seedDevAccounts = () => {
  if (mockStore.users.has("dev.tenant@homelink.test")) return;
  try {
    const bcrypt = require("bcryptjs");
    const demoHash = bcrypt.hashSync("Password123!", 10);
    const mk = (_id, email, role, firstName, lastName) => mockStore.users.set(email, {
      _id, firstName, lastName, email, phone: "0911223344", password: demoHash,
      role, emailVerified: true, identityStatus: "verified",
    });
    mk("mock-user-seed-1", "dev.tenant@homelink.test", "tenant", "Dev", "Tenant");
    mk("mock-landlord-1", "dev.landlord@homelink.test", "landlord", "Dev", "Landlord");
    mk("mock-admin-1", "dev.admin@homelink.test", "admin", "Dev", "Admin");
  } catch (e) {
    console.warn("[MOCK DB] dev account seeding warning:", e.message);
  }
};
seedDevAccounts();
loadMockData();

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.mockCreateNotification = mockCreateNotification;
module.exports.mockPropertyRating = mockPropertyRating;
module.exports.isMockMode = isMockMode;
module.exports.mockStore = mockStore;
module.exports.pushMockAudit = pushMockAudit;
module.exports.persistMockUsers = persistMockUsers;
module.exports.persistMockData = persistMockData;