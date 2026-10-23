/**
 * Sprint 5-7 compatibility codemod — idempotent (marker-guarded).
 * Run: node scripts/sprint567-compat.js
 *
 * Only fixes what the audit found missing; does NOT rebuild anything.
 *  S5: propertyController.js — mock branches for favourite / unfavourite /
 *      list-favourites (tenant save/remove/view saved properties).
 *  S5: mock details responses carry aggregate ratings (from reviews store).
 *  S6: propertyController.js — mock branches for save/get/update tenant
 *      preferences (budget/location/type/bedrooms/amenities/move-in).
 *  S7: viewingController.js — mock branches for reject / reschedule /
 *      complete (spec landlord actions) + notifications emitted from ALL
 *      mock viewing/application branches (spec notification requirements).
 *  S7: applicationController.js — notification emissions on apply/review.
 *  S6/S7: config/db.js — mockStore.favourites + tenantPreferences stores.
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
  const out = build(src);
  if (out === null) { console.log('  = skip (guard): ' + file); return; }
  if (out === src) { console.log('  ! NO MATCH (anchor drift): ' + file); process.exitCode = 1; return; }
  write(file, out);
  applied++;
  console.log('  ✔ patched ' + file);
}

console.log('Sprint 5-7 compat codemod');

// ── mock stores for favourites + tenant preferences ─────────────────────────
patch('backend/src/config/db.js', 'sprint567-stores', (s) =>
  s.replace(
    '// (sprint4-property-status) spec availability states on every seeded listing',
    `// (sprint567-stores) tenant saved-properties + preference profiles
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

// (sprint4-property-status) spec availability states on every seeded listing`
  ).replace(
    'module.exports.mockCreateNotification = mockCreateNotification;',
    'module.exports.mockCreateNotification = mockCreateNotification;\nmodule.exports.mockPropertyRating = mockPropertyRating;'
  )
);

// ── S5: favourites mock branches ────────────────────────────────────────────
patch('backend/src/controller/propertyController.js', 'sprint567-favourites', (s) =>
  s
    .replace(
      `const favouriteProperty = async (req, res) => {\n\n    try{\n        const {id }= req.params;\n        const tenantId = req.user.id;\n`,
      `const favouriteProperty = async (req, res) => {\n\n    try{\n        const {id }= req.params;\n        const tenantId = req.user.id;\n\n        // (sprint567-favourites) tenant save-property without a DB\n        if (isMockMode()) {\n            const prop8 = (mockStore.properties || []).find((pr) => pr._id === id);\n            if (!prop8) return res.status(404).json({ message: 'Property not found' });\n            mockStore.favourites = mockStore.favourites || [];\n            if (mockStore.favourites.some((f) => f.tenantId === tenantId && f.propertyId === id)) {\n                return res.status(400).json({ message: 'Property already exists in favorites' });\n            }\n            mockStore.favourites.push({ tenantId, propertyId: id, createdAt: new Date().toISOString() });\n            return res.status(201).json({ message: 'Property added to favorites', data: { propertyId: id } });\n        }\n`
    )
    .replace(
      `const unfavouriteProperty = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const tenantId = req.user.id;\n`,
      `const unfavouriteProperty = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const tenantId = req.user.id;\n\n        // (sprint567-favourites) tenant remove-saved-property without a DB\n        if (isMockMode()) {\n            const favIdx = (mockStore.favourites || []).findIndex((f) => f.tenantId === tenantId && f.propertyId === id);\n            if (favIdx === -1) return res.status(404).json({ message: 'Favourite not found' });\n            mockStore.favourites.splice(favIdx, 1);\n            return res.status(200).json({ message: 'Property removed from favorites' });\n        }\n`
    )
    .replace(
      `const getMyFavourite = async (req, res) => {\n    try{\n        const tenantId = req.user.id;\n`,
      `const getMyFavourite = async (req, res) => {\n    try{\n        const tenantId = req.user.id;\n\n        // (sprint567-favourites) view saved properties without a DB\n        if (isMockMode()) {\n            const favRows = (mockStore.favourites || []).filter((f) => f.tenantId === tenantId);\n            const favProps = favRows\n                .map((f) => (mockStore.properties || []).find((pr) => pr._id === f.propertyId))\n                .filter(Boolean);\n            return res.status(200).json({ data: favProps, total: favProps.length });\n        }\n`
    )
);

// ── S5: property details carry ratings (mock detail + search rows) ──────────
patch('backend/src/controller/propertyController.js', 'sprint567-ratings', (s) =>
  s.replace(
    `        // Mock DB: serve the in-memory listing (ids are not real ObjectIds).\n        if (isMockMode()) {\n            const mockProperty = (mockStore.properties || []).find((pr) => pr._id === req.params.id);\n            if (!mockProperty) return res.status(404).json({ message: 'Property not found' });\n            return res.status(200).json({ data: mockProperty });\n        }`,
    `        // Mock DB: serve the in-memory listing (ids are not real ObjectIds).\n        if (isMockMode()) {\n            const mockProperty = (mockStore.properties || []).find((pr) => pr._id === req.params.id);\n            if (!mockProperty) return res.status(404).json({ message: 'Property not found' });\n            // (sprint567-ratings) spec: tenant sees ratings on property details\n            return res.status(200).json({ data: { ...mockProperty, ratings: mockPropertyRating(req.params.id) } });\n        }`
  )
);

// ── S6: tenant preferences mock branches (budget/location/type/beds/amenities/move-in) ──
patch('backend/src/controller/propertyController.js', 'sprint567-rating-import', (s) =>
  s.includes('mockPropertyRating }')
    ? null // already imported (marker-less fix) — nothing to do
    : s.replace(
    "const { isMockMode, mockStore } = require('../config/db');",
    "const { isMockMode, mockStore, mockPropertyRating } = require('../config/db');"
  )
);
patch('backend/src/controller/propertyController.js', 'sprint567-preferences', (s) =>
  s.includes('sprint567-getprefs')
    ? null // GET/PUT branches already applied by the direct fixup
    : s
    .replace(
      `const savePreferences = async (req, res) => {\n    try {\n        const tenantId = req.user.id;\n`,
      `const savePreferences = async (req, res) => {\n    try {\n        const tenantId = req.user.id;\n\n        // (sprint567-preferences) preference profile without a DB\n        if (isMockMode()) {\n            const body9 = req.body || {};\n            if (!body9.budget || !body9.location || !body9.propertyType) {\n                return res.status(400).json({ message: 'Budget, location, and property type are required' });\n            }\n            mockStore.tenantPreferences[tenantId] = {\n                ...mockStore.tenantPreferences[tenantId],\n                ...body9,\n                updatedAt: new Date().toISOString(),\n            };\n            return res.status(200).json({ message: 'Preferences saved', data: mockStore.tenantPreferences[tenantId] });\n        }\n`
    )
    .replace(
      `const getPreferences = async (req, res) => {\n    try{\n        const tenantId = req.user.id;\n`,
      `const getPreferences = async (req, res) => {\n    try{\n        const tenantId = req.user.id;\n\n        // (sprint567-getprefs) read preference profile without a DB\n        if (isMockMode()) {\n            return res.status(200).json({ data: mockStore.tenantPreferences[tenantId] || null });\n        }\n`
    )
    .replace(
      `const updatePreferences = async (req,res) =>{\n    try{\n        const tenantId = req.user.id;\n`,
      `const updatePreferences = async (req,res) =>{\n    try{\n        const tenantId = req.user.id;\n\n        // (sprint567-getprefs) partial update without a DB\n        if (isMockMode()) {\n            if (!mockStore.tenantPreferences[tenantId]) return res.status(404).json({ message: 'No preferences saved yet' });\n            Object.assign(mockStore.tenantPreferences[tenantId], req.body || {}, { updatedAt: new Date().toISOString() });\n            return res.status(200).json({ message: 'Preferences updated', data: mockStore.tenantPreferences[tenantId] });\n        }\n`
    )
);

// ── S7: viewing reject / reschedule / complete mock branches ────────────────
// viewingController.js is LF — plain anchors work.
patch('backend/src/controller/viewingController.js', 'sprint567-viewing-actions', (s) =>
  s
    .replace(
      `const rejectViewing = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const { cancellationReason } = req.body;\n        \n        const viewing = await Viewing.findOneAndUpdate(`,
      `const rejectViewing = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const { cancellationReason } = req.body;\n\n        // (sprint567-viewing-actions) landlord reject without a DB\n        if (isMockMode()) {\n            const v3 = (mockStore.viewings || []).find((x) => x._id === id);\n            if (!v3) return res.status(404).json({ message: "Viewing not found or unauthorized" });\n            v3.status = 'cancelled';\n            v3.cancellationReason = cancellationReason;\n            v3.cancelledBy = 'landlord';\n            createNotification((typeof v3.tenantId === 'object' ? v3.tenantId._id : v3.tenantId), 'viewing_cancelled', 'Viewing Cancelled', 'Your viewing request was declined by the landlord.', 'Viewing', v3._id);\n            return res.status(200).json({ message: "Viewing cancelled", data: v3 });\n        }\n        const viewing = await Viewing.findOneAndUpdate(`
    )
    .replace(
      `const rescheduleViewing = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const { confirmedSlot, landlordNote } = req.body;\n        \n        const viewing = await Viewing.findOneAndUpdate(`,
      `const rescheduleViewing = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const { confirmedSlot, landlordNote } = req.body;\n\n        // (sprint567-viewing-actions) landlord reschedule without a DB\n        if (isMockMode()) {\n            const v4 = (mockStore.viewings || []).find((x) => x._id === id);\n            if (!v4) return res.status(404).json({ message: "Viewing not found or unauthorized" });\n            v4.status = 'rescheduled';\n            if (confirmedSlot) v4.confirmedSlot = confirmedSlot;\n            if (landlordNote) v4.landlordNote = landlordNote;\n            createNotification((typeof v4.tenantId === 'object' ? v4.tenantId._id : v4.tenantId), 'viewing_confirmed', 'Viewing Rescheduled', 'Your viewing was rescheduled by the landlord.', 'Viewing', v4._id);\n            return res.status(200).json({ message: "Viewing rescheduled", data: v4 });\n        }\n        const viewing = await Viewing.findOneAndUpdate(`
    )
    .replace(
      `const completeViewing = async (req, res) => {\n    try {\n        const { id } = req.params;\n`,
      `const completeViewing = async (req, res) => {\n    try {\n        const { id } = req.params;\n\n        // (sprint567-viewing-actions) landlord complete without a DB\n        if (isMockMode()) {\n            const v5 = (mockStore.viewings || []).find((x) => x._id === id);\n            if (!v5) return res.status(404).json({ message: "Viewing not found or unauthorized" });\n            v5.status = 'completed';\n            v5.completedAt = new Date().toISOString();\n            createNotification((typeof v5.tenantId === 'object' ? v5.tenantId._id : v5.tenantId), 'viewing_confirmed', 'Viewing Completed', 'Your viewing was marked completed by the landlord.', 'Viewing', v5._id);\n            return res.status(200).json({ message: "Viewing completed", data: v5 });\n        }\n`
    )
    // notifications from the EXISTING request/accept mock branches (spec S7)
    .replace(
      `            mockStore.viewings.push(viewing);\n            return res.status(201).json({ message: "Viewing requested", data: viewing });`,
      `            mockStore.viewings.push(viewing);\n            // (sprint567-notify) spec: landlord notified when a viewing is requested\n            createNotification(viewing.landlordId, 'viewing_requested', 'New Viewing Request', 'A tenant requested a viewing of your property.', 'Viewing', viewing._id);\n            return res.status(201).json({ message: "Viewing requested", data: viewing });`
    )
    .replace(
      `            if (confirmedSlot) v2.confirmedSlot = confirmedSlot;\n            if (landlordNote) v2.landlordNote = landlordNote;\n            return res.status(200).json({ message: "Viewing confirmed", data: v2 });`,
      `            if (confirmedSlot) v2.confirmedSlot = confirmedSlot;\n            if (landlordNote) v2.landlordNote = landlordNote;\n            // (sprint567-notify) spec: tenant notified on viewing accept\n            createNotification((typeof v2.tenantId === 'object' ? v2.tenantId._id : v2.tenantId), 'viewing_confirmed', 'Viewing Confirmed', 'Your viewing has been confirmed by the landlord.', 'Viewing', v2._id);\n            return res.status(200).json({ message: "Viewing confirmed", data: v2 });`
    )
);

// ── S7: application notifications from mock branches (spec) ─────────────────
patch('backend/src/controller/applicationController.js', 'sprint567-withdraw', (s) =>
  s.includes('(sprint567-withdraw)')
    ? s // already applied
    : s.replace(
    `const withdrawApplication = async (req, res) => {\n    try {\n        const { id } = req.params;\n        \n        const application = await Application.findOneAndUpdate(`,
    `const withdrawApplication = async (req, res) => {\n    try {\n        const { id } = req.params;\n\n        // (sprint567-withdraw) tenant withdraw without a DB\n        if (isMockMode()) {\n            const appW = (mockStore.applications || []).find((x) => x._id === id && (typeof x.tenantId === 'object' ? x.tenantId._id : x.tenantId) === req.user.id);\n            if (!appW) return res.status(404).json({ message: "Application not found or unauthorized" });\n            appW.status = 'withdrawn';\n            appW.decidedAt = new Date().toISOString();\n            return res.status(200).json({ message: "Application withdrawn", data: appW });\n        }\n        const application = await Application.findOneAndUpdate(`
  )
);

patch('backend/src/controller/applicationController.js', 'sprint567-app-notify', (s) =>
  s.includes('(sprint567-notify) spec: landlord notified on application received')
    ? null // notifications already inserted
    : s
    .replace(
      `            mockStore.applications.push(application);\n            return res.status(201).json({ message: "Application submitted", data: application });`,
      `            mockStore.applications.push(application);\n            // (sprint567-notify) spec: landlord notified on application received\n            createNotification(application.landlordId, 'application_received', 'New Application', 'A tenant applied for your property.', 'Application', application._id);\n            return res.status(201).json({ message: "Application submitted", data: application });`
    )
    .replace(
      `            if (status === 'approved' || status === 'rejected') app2.decidedAt = new Date().toISOString();\n            return res.status(200).json({ message: "Application " + status, data: app2 });`,
      `            if (status === 'approved' || status === 'rejected') app2.decidedAt = new Date().toISOString();\n            // (sprint567-notify) spec: tenant notified on application accept/reject\n            createNotification((typeof app2.tenantId === 'object' ? app2.tenantId._id : app2.tenantId),\n                status === 'approved' ? 'application_approved' : 'application_rejected',\n                'Application ' + status,\n                'Your application was ' + status + ' by the landlord.',\n                'Application', app2._id);\n            return res.status(200).json({ message: "Application " + status, data: app2 });`
    )
);

console.log(applied === 0 ? 'Nothing to do (all patches already applied).' : applied + ' file(s) patched.');
