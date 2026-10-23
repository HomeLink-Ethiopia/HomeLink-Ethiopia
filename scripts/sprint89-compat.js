/**
 * Sprint 8/9 compatibility codemod — idempotent (marker-guarded).
 * Run: node scripts/sprint89-compat.js
 *
 * Fixes applied:
 *  1. models/Notification.js — add missing notification types used by code:
 *     agreement_terminated, application_withdrawn, viewing_no_show, message_received
 *  2. config/db.js — add conversations/messages/notifications arrays to mockStore
 *     + mockCreateNotification helper (persisted in mock mode).
 *  3. routes/messageRoutes.js — mock-mode branch for the 4 frontend messaging
 *     endpoints (conversations list, history, read, send).
 *  4. routes/maintenanceRoutes.js — mock branch for POST /:id/updates (tenant
 *     "add response") and PUT /:id/confirm (tenant confirms resolution).
 *  5. controller/maintenanceController.js — store `category` in mock tickets.
 *  6. server.js — start overdue-rent sweep job (pending → overdue after due date).
 */
const fs = require('fs');
const path = require('path');

const R = (p) => path.join(__dirname, '..', p);
const read = (p) => fs.readFileSync(R(p), 'utf8');
const write = (p, c) => fs.writeFileSync(R(p), c);

let applied = 0;
function patch(file, marker, build) {
  const src = read(file);
  if (src.includes(marker)) { console.log('  = skip (already applied): ' + file); return; }
  write(file, build(src));
  applied++;
  console.log('  ✔ patched ' + file);
}

console.log('Sprint 8/9 compat codemod');

// ── 1. Notification model enum ──────────────────────────────────────────────
patch('backend/src/models/Notification.js', 'message_received', (s) =>
  s.replace(
    `"viewing_requested" // Adding this because it was missing in the original enum but used in our flow`,
    `"viewing_requested", // Adding this because it was missing in the original enum but used in our flow
      "agreement_terminated", "application_withdrawn", "viewing_no_show", "message_received" // Sprint 8/9: types emitted by code but missing from the original enum`
  )
);

// ── 2. mockStore: conversations / messages / notifications ─────────────────
patch('backend/src/config/db.js', 'sprint89-mock-comms', (s) =>
  s.replace(
    `const isMockMode = () => mockMode || mongoose.connection.readyState !== 1;`,
    `// ─── Sprint 8/9: mock conversations / messages / notifications store ───
// (sprint89-mock-comms) Centralized notification system works offline too.
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

const isMockMode = () => mockMode || mongoose.connection.readyState !== 1;`
  ).replace(
    `module.exports.connectDB = connectDB;`,
    `module.exports.connectDB = connectDB;\nmodule.exports.mockCreateNotification = mockCreateNotification;`
  )
);

// ── 3. messageRoutes.js — mock branches for the frontend messaging contract ─
patch('backend/src/routes/messageRoutes.js', 'sprint89-mock-messaging', (s) =>
  s.replace(
    `const { Conversation, Message } = require('../models/Conversation');`,
    `// ─── Sprint 8/9: mock-mode messaging so tenant ↔ landlord chat works offline ───
// (sprint89-mock-messaging) Mirrors the real-DB branches below using mockStore.
const { isMockMode, mockStore, mockCreateNotification } = require('../config/db');

const mockUser = (id) => {
  const map = mockStore.users;
  let u = map && map.get && map.get(String(id));
  if (!u && map && typeof map.values === 'function') {
    u = Array.from(map.values()).find((x) => x._id === id);
  }
  return u || null;
};

router.post('/sprint89-router-ready', (req, res) => res.json({ ok: true }));

const { Conversation, Message } = require('../models/Conversation');`
  ).replace(
    `router.post('/', authMiddleware, async (req, res) => {`,
    `router.post('/', authMiddleware, async (req, res) => {
  // (sprint89-mock-messaging) mock branch
  if (isMockMode()) {
    const senderId = req.user.id;
    const { conversationId, receiverId, text, body, propertyId } = req.body;
    const text_ = String(text || body || '').trim();
    if (!text_) return res.status(400).json({ message: 'Message cannot be empty' });

    let conv;
    if (conversationId) {
      conv = (mockStore.conversations || []).find((c) => c._id === conversationId);
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (conv.tenantId !== senderId && conv.landlordId !== senderId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    } else {
      if (!receiverId) return res.status(400).json({ message: 'receiverId or conversationId is required' });
      if (String(receiverId) === String(senderId)) return res.status(400).json({ message: 'You cannot message yourself' });
      const other = mockUser(receiverId);
      if (!other) return res.status(404).json({ message: 'Recipient not found' });
      const senderRole = req.user.role;
      if (senderRole !== 'tenant' && senderRole !== 'landlord') {
        return res.status(400).json({ message: 'Conversations are between tenants and landlords' });
      }
      const tenantId = senderRole === 'tenant' ? senderId : receiverId;
      const landlordId = senderRole === 'landlord' ? senderId : receiverId;
      conv = (mockStore.conversations || []).find((c) => c.tenantId === tenantId && c.landlordId === landlordId && (c.propertyId || null) === (propertyId || null));
      if (!conv) {
        conv = {
          _id: 'mock-conv-' + Date.now(),
          tenantId, landlordId,
          propertyId: propertyId || null,
          contextType: 'general',
          createdAt: new Date().toISOString(),
        };
        mockStore.conversations.push(conv);
      }
    }

    const receiverId_ = conv.tenantId === senderId ? conv.landlordId : conv.tenantId;
    const msg = {
      _id: 'mock-msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      conversationId: conv._id,
      senderId,
      receiverId: receiverId_,
      body: text_,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    mockStore.messages.push(msg);
    conv.lastMessage = text_;
    conv.lastMessageAt = msg.createdAt;
    mockCreateNotification(receiverId_, 'message_received', 'New Message', text_.slice(0, 120), 'Conversation', conv._id);

    return res.status(201).json({
      data: { _id: msg._id, conversationId: conv._id, senderId, text: msg.body, createdAt: msg.createdAt, isRead: false },
    });
  }
`
  ).replace(
    `router.get('/conversations', authMiddleware, async (req, res) => {
  try {`,
    `router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    // (sprint89-mock-messaging) mock branch
    if (isMockMode()) {
      const userId = req.user.id;
      const rows = (mockStore.conversations || [])
        .filter((c) => c.tenantId === userId || c.landlordId === userId)
        .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
        .map((c) => {
          const meIsTenant = c.tenantId === userId;
          const otherId = meIsTenant ? c.landlordId : c.tenantId;
          const other = mockUser(otherId);
          const o = other
            ? { _id: other._id, firstName: other.firstName, lastName: other.lastName, email: other.email, role: other.role }
            : { _id: otherId, firstName: 'User', lastName: '', role: meIsTenant ? 'landlord' : 'tenant' };
          const me = { _id: userId };
          return {
            _id: c._id,
            participants: meIsTenant ? [me, o] : [o, me],
            otherUser: o,
            propertyId: c.propertyId || null,
            lastMessage: c.lastMessage || '',
            lastMessageAt: c.lastMessageAt || c.createdAt,
          };
        });
      return res.status(200).json({ data: rows });
    }
`
  ).replace(
    `router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {`,
    `router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    // (sprint89-mock-messaging) mock branch
    if (isMockMode()) {
      const userId = req.user.id;
      const conv = (mockStore.conversations || []).find((c) => c._id === req.params.conversationId);
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (conv.tenantId !== userId && conv.landlordId !== userId) return res.status(403).json({ message: 'Unauthorized' });
      const msgs = (mockStore.messages || [])
        .filter((m) => m.conversationId === conv._id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((m) => ({ _id: m._id, senderId: m.senderId, text: m.body, createdAt: m.createdAt, readAt: m.readAt || null }));
      return res.status(200).json({ data: msgs });
    }
`
  ).replace(
    `router.patch('/:conversationId/read', authMiddleware, async (req, res) => {
  try {`,
    `router.patch('/:conversationId/read', authMiddleware, async (req, res) => {
  try {
    // (sprint89-mock-messaging) mock branch
    if (isMockMode()) {
      const userId = req.user.id;
      (mockStore.messages || []).forEach((m) => {
        if (m.conversationId === req.params.conversationId && m.receiverId === userId && !m.isRead) {
          m.isRead = true;
          m.readAt = new Date().toISOString();
        }
      });
      return res.status(200).json({ message: 'Messages marked as read' });
    }
`
  )
);

// ── 4. maintenanceRoutes.js — mock branches for updates/confirm ────────────
patch('backend/src/routes/maintenanceRoutes.js', 'sprint89-mock-maintenance', (s) =>
  s.replace(
    `} = require('../controller/maintenanceController');`,
    `} = require('../controller/maintenanceController');

// ─── Sprint 8/9: mock-mode branches so tenant updates + confirmation work offline ───
// (sprint89-mock-maintenance) POST /:id/updates (add response) and PUT /:id/confirm.
const { isMockMode, mockStore, mockCreateNotification } = require('../config/db');

const sprint89FindTicket = (id) => (mockStore.maintenance || []).find((t) => t._id === id);

router.post('/:id/updates', authMiddleware, roleMiddleware('tenant', 'landlord'), (req, res) => {
  if (isMockMode()) {
    const t = sprint89FindTicket(req.params.id);
    if (!t) return res.status(404).json({ message: 'Ticket not found' });
    const userId = req.user.id;
    if (t.tenantId !== userId && t.landlordId !== userId) return res.status(403).json({ message: 'Unauthorized' });
    const note = (req.body && (req.body.note || req.body.response)) || '';
    if (!note.trim()) return res.status(400).json({ message: 'Note cannot be empty' });
    t.updates = t.updates || [];
    t.updates.push({ status: t.status, note, updatedBy: userId, timestamp: new Date().toISOString() });
    const other = t.tenantId === userId ? t.landlordId : t.tenantId;
    mockCreateNotification(other, 'maintenance_update', 'New Comment on Maintenance Ticket', note.slice(0, 120), 'MaintenanceRequest', t._id);
    return res.status(201).json({ message: 'Note added to ticket', data: t });
  }
  addUpdateNote(req, res);
});

router.put('/:id/confirm', authMiddleware, roleMiddleware('tenant'), (req, res) => {
  if (isMockMode()) {
    const t = sprint89FindTicket(req.params.id);
    if (!t) return res.status(404).json({ message: 'Ticket not found or unauthorized' });
    if (t.tenantId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });
    if (t.status !== 'resolved') return res.status(400).json({ message: 'Ticket is not in resolved state' });
    t.status = 'closed';
    t.closedAt = new Date().toISOString();
    t.updates = t.updates || [];
    t.updates.push({ status: 'closed', note: 'Tenant confirmed the resolution', updatedBy: req.user.id, timestamp: new Date().toISOString() });
    mockCreateNotification(t.landlordId, 'maintenance_update', 'Resolution Confirmed', 'The tenant has confirmed the repair is complete.', 'MaintenanceRequest', t._id);
    return res.status(200).json({ message: 'Resolution confirmed and ticket closed', data: t });
  }
  confirmResolution(req, res);
});`
  ).replace(
    `// Tenant confirms the resolution
router.put('/:id/confirm', authMiddleware, roleMiddleware('tenant'), confirmResolution);`,
    `// Tenant confirms the resolution (mock branch defined above wins in mock mode)`
  )
);

// ── 5. maintenanceController.js — store category in mock tickets ────────────
patch('backend/src/controller/maintenanceController.js', 'category: category || null', (s) =>
  s.replace(
    `const { propertyId, issue, description, priority } = req.body || {};`,
    `const { propertyId, issue, description, priority, category } = req.body || {};`
  ).replace(
    `issue: issue || "Maintenance request",`,
    `issue: issue || "Maintenance request",\n                category: category || null,`
  )
);

// ── 5b. TenantPayment model — field for overdue-sweep idempotency ──────────
patch('backend/src/models/TenantPayment.js', 'overdueNotifiedAt', (s) =>
  s.replace(
    `  notes: String,`,
    `  notes: String,\n\n  // Sprint 8: set once by the overdue sweep job so it never double-notifies\n  overdueNotifiedAt: Date,`
  )
);

// ── 5c. agreementController.js — mock robustness guards ────────────────────
patch('backend/src/controller/agreementController.js', 'sprint89-agr-guards', (s) =>
  s.replace(
    `        if (isMockMode()) {\n            const prop2 = (mockStore.properties || []).find((x) => x._id === propertyId);`,
    `        if (isMockMode()) {\n            // (sprint89-agr-guards) An agreement without a tenant is invalid — fail loudly.\n            if (!tenantId) {\n                return res.status(400).json({ message: "tenantId is required to create an agreement" });\n            }\n            const prop2 = (mockStore.properties || []).find((x) => x._id === propertyId);`
  ).replace(
    `            const agr3 = (mockStore.agreements || []).find((x) => x._id === id);\n            if (!agr3) return res.status(404).json({ message: "Agreement not found" });\n            if (role === "tenant") agr3.tenantSignedAt = new Date().toISOString();`,
    `            const agr3 = (mockStore.agreements || []).find((x) => x._id === id);\n            if (!agr3) return res.status(404).json({ message: "Agreement not found" });\n            // (sprint89-agr-guards) Mirror the real-DB state machine: only draft/\n            // pending_signatures agreements can be signed.\n            if (agr3.status !== "pending_signatures" && agr3.status !== "draft") {\n                return res.status(400).json({ message: "This agreement is not pending signatures" });\n            }\n            if (role === "tenant") agr3.tenantSignedAt = new Date().toISOString();`
  )
);

// ── 5d. notificationController.js — serve the centralized feed in mock mode ─
patch('backend/src/controller/notificationController.js', 'sprint89-notif-mock', (s) =>
  s.replace(
    `const { isMockMode } = require('../config/db');`,
    `const { isMockMode, mockStore } = require('../config/db'); // sprint89-notif-mock`
  ).replace(
    `        if (isMockMode()) return res.status(200).json({ unreadCount: 0, notifications: [] });`,
    `        if (isMockMode()) {\n            // (sprint89-notif-mock) serve the centralized in-app feed from the mock store\n            const rows = (mockStore.notifications || [])\n                .filter((n) => String(n.userId) === String(req.user.id))\n                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))\n                .slice(0, 50);\n            const unread = rows.filter((n) => !n.isRead).length;\n            return res.status(200).json({ unreadCount: unread, notifications: rows });\n        }`
  ).replace(
    /const markAsRead = async \(req, res\) => \{\r?\n    try \{\r?\n/,
    `const markAsRead = async (req, res) => {\n    try {\n        if (isMockMode()) { // sprint89-notif-read\n            const n = (mockStore.notifications || []).find((x) => x._id === req.params.id && String(x.userId) === String(req.user.id));\n            if (!n) return res.status(404).json({ message: "Notification not found" });\n            n.isRead = true; n.readAt = new Date().toISOString();\n            return res.status(200).json({ message: "Marked as read", notification: n });\n        }\n`
  ).replace(
    /const markAllAsRead = async \(req, res\) => \{\r?\n    try \{\r?\n/,
    `const markAllAsRead = async (req, res) => {\n    try {\n        if (isMockMode()) { // sprint89-notif-read\n            (mockStore.notifications || []).forEach((n) => { if (String(n.userId) === String(req.user.id) && !n.isRead) { n.isRead = true; n.readAt = new Date().toISOString(); } });\n            return res.status(200).json({ message: "All notifications marked as read" });\n        }\n`
  )
);

// ── 5e. Bridge the six controllers' createNotification helpers to the mock store ──
const BRIDGE_FILES = [
  'backend/src/controller/agreementController.js',
  'backend/src/controller/applicationController.js',
  'backend/src/controller/communicationController.js',
  'backend/src/controller/maintenanceController.js',
  'backend/src/controller/paymentController.js',
  'backend/src/controller/viewingController.js',
];
for (const f of BRIDGE_FILES) {
  patch(f, 'sprint89-notify-bridge', (s) =>
    s.replace(
      `const createNotification = async (userId, type, title, body, entityType, entityId) => {\n    try {`,
      `const { isMockMode: s89IsMock, mockCreateNotification: s89Notify } = require('../config/db'); // sprint89-notify-bridge\nconst createNotification = async (userId, type, title, body, entityType, entityId) => {\n    if (s89IsMock && s89IsMock()) { s89Notify(userId, type, title, body, entityType, entityId); return; }\n    try {`
    )
  );
}

// CRLF-tolerant bridge for files where the LF anchor can't match (communicationController.js)
patch('backend/src/controller/communicationController.js', 'sprint89-notify-bridge', (s) =>
  s.replace(
    /const createNotification = async \(userId, type, title, body, entityType, entityId\) => \{\r?\n    try \{\r?\n/,
    `const { isMockMode: s89IsMock, mockCreateNotification: s89Notify } = require('../config/db'); // sprint89-notify-bridge\nconst createNotification = async (userId, type, title, body, entityType, entityId) => {\n    if (s89IsMock && s89IsMock()) { s89Notify(userId, type, title, body, entityType, entityId); return; }\n    try {\n`
  )
);

// ── 5f. Emit spec notifications from mock create/verify branches ────────────
patch('backend/src/controller/agreementController.js', 'sprint89-agr-notify', (s) =>
  s.replace(
    `            mockStore.agreements.push(agr);`,
    `            mockStore.agreements.push(agr);\n            // (sprint89-agr-notify) Spec: agreement created → notify tenant for signature.\n            createNotification((agr.tenantId && agr.tenantId._id) || tenantId, "agreement_ready", "New Rental Agreement", "A new rental agreement is ready for your signature.", "RentalAgreement", agr._id);`
  )
);
patch('backend/src/controller/paymentController.js', 'sprint89-pay-notify', (s) =>
  s.replace(
    `            if (paymentMethod) pay3.paymentMethod = paymentMethod;`,
    `            if (paymentMethod) pay3.paymentMethod = paymentMethod;\n            // (sprint89-pay-notify) Spec: verified payment → receipt notification to tenant.\n            createNotification(pay3.tenantId, "payment_received", "Payment Verified", "Your payment has been verified by the landlord.", "TenantPayment", pay3._id);`
  )
);

// ── 6. server.js — overdue rent sweep job ───────────────────────────────────
patch('backend/server.js', 'sprint89-overdue-sweep', (s) =>
  s.replace(
    `require('./src/jobs/backupJob').startBackupJob();`,
    `require('./src/jobs/backupJob').startBackupJob();

// ─── Sprint 8: overdue rent sweep — flips pending → overdue once the due date passes ───
// (sprint89-overdue-sweep) Runs hourly; also sends rent_overdue notifications.
require('./src/jobs/overdueSweep').startOverdueSweepJob();`
  )
);

console.log(applied === 0 ? 'Nothing to do (all patches already applied).' : applied + ' file(s) patched.');
