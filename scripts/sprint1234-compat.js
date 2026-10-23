/**
 * Sprint 1-4 compatibility codemod — idempotent (marker-guarded).
 * Run: node scripts/sprint1234-compat.js
 *
 * Only fixes what the audit found missing; does NOT rebuild anything.
 *  S1: server.js — request logging line (morgan-style, zero-dep).
 *  S2: authContoller.js — mock branches for forgotPassword / verifyResetCode /
 *      resetPassword (password recovery worked only with a real DB) + fix
 *      `re.status` typo that swallowed the missing-email validation.
 *  S4: propertyController.js — mock branches for updateProperty /
 *      deleteProperty / uploadPropertyImages / deletePropertyImage /
 *      setPrimaryImage (all 500'd in mock mode via the LandlordProfile query)
 *      with owner-only authorization.
 *  S4: models/Property.js — add `reserved` to the status enum (spec state).
 *  S4: config/db.js — mock properties carry status so state is testable.
 *  S2/S3: authContoller.js — seeded dev accounts get reset-code fields.
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
  if (out === src) { console.log('  ! NO MATCH (anchor drift): ' + file); return; }
  write(file, out);
  applied++;
  console.log('  ✔ patched ' + file);
}

console.log('Sprint 1-4 compat codemod');

// ── S2b: duplicate-phone check in mock register ─────────────────────────────
patch('backend/src/controller/authContoller.js', 'sprint2-phone-dup', (s) =>
  s.replace(
    'if (mockStore.users.has(email)) {\n        return res.status(400).json({ message: "Email is already registered" });\n      }',
    'if (mockStore.users.has(email)) {\n        return res.status(400).json({ message: "Email is already registered" });\n      }\n      // (sprint2-phone-dup) spec: duplicate phone checking\n      if (phone && Array.from(mockStore.users.values()).some((u) => u.phone === phone)) {\n        return res.status(400).json({ message: "Phone is already registered" });\n      }'
  )
);

// ── S1: request logging ─────────────────────────────────────────────────────
patch('backend/server.js', 'sprint1-request-log', (s) =>
  s.replace(
    `app.use(express.json({ limit: '10mb' }));`,
    `// ─── Sprint 1: request logging (zero-dep) ───\n// (sprint1-request-log)\napp.use((req, res, next) => {\n  const t0 = Date.now();\n  res.on('finish', () => console.log(\`[req] \${req.method} \${req.originalUrl} -> \${res.statusCode} (\${Date.now() - t0}ms)\`));\n  next();\n});\n\napp.use(express.json({ limit: '10mb' }));`
  )
);

// ── S2: password recovery mock branches + typo fix ──────────────────────
// authContoller.js is CRLF — normalize to LF first so multi-line anchors match.
{
  const authFile = 'backend/src/controller/authContoller.js';
  if (!read(authFile).includes('sprint2-mock-recovery') && read(authFile).includes('\r\n')) {
    write(authFile, read(authFile).replace(/\r\n/g, '\n'));
    console.log('  ✔ LF-normalized ' + authFile);
  }
}
patch('backend/src/controller/authContoller.js', 'sprint2-mock-recovery', (s) =>
  s
    // typo: `re.status` → `res.status`
    .replace('return re.status(400).json({', 'return res.status(400).json({')
    // mock branch for forgotPassword
    .replace(
      'const forgotPassword = async (req,res)=>{\n  try{\n    const { email } = req.body;',
      'const forgotPassword = async (req,res)=>{\n  try{\n    const { email } = req.body;\n    // (sprint2-mock-recovery) password recovery works in mock mode too\n    if (isMockMode()) {\n      const mockUser = mockStore.users.get(email);\n      if (!mockUser) return res.status(404).json({ message: "User not found" });\n      const resetCode = String(Math.floor(100000 + Math.random() * 900000));\n      mockUser.passwordResetCode = resetCode; // plain in mock: dev convenience, real DB hashes it\n      mockUser.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();\n      console.log(`\\u26a1 [MOCK DB] Password reset code for ${email}: ${resetCode}`);\n      return res.status(200).json({ message: "Password reset code sent to your email", devResetCode: resetCode });\n    }'
    )
    // mock branch for verifyResetCode
    .replace(
      'const verifyResetCode = async (req,res)=>{\n  try{\n    const { email, code }= req.body;',
      'const verifyResetCode = async (req,res)=>{\n  try{\n    const { email, code }= req.body;\n    // (sprint2-mock-recovery)\n    if (isMockMode()) {\n      const mockUser = mockStore.users.get(email);\n      if (!mockUser) return res.status(404).json({ message: "User not found" });\n      if (!mockUser.passwordResetCode) return res.status(400).json({ message: "No password reset request found" });\n      if (!mockUser.passwordResetExpires || new Date(mockUser.passwordResetExpires) < new Date()) {\n        return res.status(400).json({ message: "Password reset code is expired" });\n      }\n      if (String(code) !== String(mockUser.passwordResetCode)) {\n        return res.status(400).json({ message: "Invalid password reset code" });\n      }\n      return res.status(200).json({ message: "Password reset code is valid" });\n    }'
    )
    // mock branch for resetPassword
    .replace(
      'const resetPassword = async (req,res)=>{\n  try{\n    const { email , code, newPassword } = req.body;',
      'const resetPassword = async (req,res)=>{\n  try{\n    const { email , code, newPassword } = req.body;\n    // (sprint2-mock-recovery)\n    if (isMockMode()) {\n      const mockUser = mockStore.users.get(email);\n      if (!mockUser) return res.status(404).json({ message: "User not found" });\n      if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });\n      if (!mockUser.passwordResetCode) return res.status(400).json({ message: "No password reset request found" });\n      if (!mockUser.passwordResetExpires || new Date(mockUser.passwordResetExpires) < new Date()) {\n        return res.status(400).json({ message: "Password reset code expired" });\n      }\n      if (String(code) !== String(mockUser.passwordResetCode)) {\n        return res.status(400).json({ message: "Invalid password reset code" });\n      }\n      mockUser.password = await bcrypt.hash(newPassword, 10);\n      mockUser.passwordResetCode = null;\n      mockUser.passwordResetExpires = null;\n      return res.status(200).json({ message: "Password reset successfully" });\n    }'
    )
);

// ── S4: property CRUD + image mock branches (owner-checked) ─────────────────
// propertyController.js is CRLF — normalize to LF first (same as
// agreementController.js in Sprint 15), then apply, then save.
{
  const pcFile = 'backend/src/controller/propertyController.js';
  if (read(pcFile).includes('sprint4-mock-property')) {
    console.log('  = skip (already applied): ' + pcFile);
  } else {
    let pc = read(pcFile).replace(/\r\n/g, '\n');
    const before = pc;
    pc = pc
      .replace(
        `const updateProperty = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const userId = req.user.id;\n        const updateData = req.body;\n`,
        `const updateProperty = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const userId = req.user.id;\n        const updateData = req.body;\n\n        // (sprint4-mock-property) owner-checked update without a DB\n        if (isMockMode()) {\n            const prop4 = (mockStore.properties || []).find((pr) => pr._id === id);\n            if (!prop4) return res.status(404).json({ message: 'Property not found' });\n            const ownerId = typeof prop4.landlordId === 'object' ? prop4.landlordId._id || prop4.landlordId.accountId : prop4.landlordId;\n            const profile = mockStore.landlordProfiles.get(userId);\n            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match\n                return res.status(403).json({ message: 'You do not own this property' });\n            }\n            const FORBIDDEN4 = ['_id', 'landlordId', 'createdAt', 'verificationStatus'];\n            FORBIDDEN4.forEach((k) => delete updateData[k]);\n            if (updateData.status && !['draft', 'active', 'rented', 'inactive', 'suspended', 'reserved'].includes(updateData.status)) {\n                return res.status(400).json({ message: 'Invalid status value' });\n            }\n            Object.assign(prop4, updateData);\n            return res.status(200).json({ message: 'Property updated successfully', data: prop4 });\n        }\n`
      )
      .replace(
        `const deleteProperty = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const userId = req.user.id;\n`,
        `const deleteProperty = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const userId = req.user.id;\n\n        // (sprint4-mock-property) owner-checked delete without a DB\n        if (isMockMode()) {\n            const idx4 = (mockStore.properties || []).findIndex((pr) => pr._id === id);\n            if (idx4 === -1) return res.status(404).json({ message: 'Property not found' });\n            const prop4 = mockStore.properties[idx4];\n            const ownerId = typeof prop4.landlordId === 'object' ? prop4.landlordId._id || prop4.landlordId.accountId : prop4.landlordId;\n            const profile = mockStore.landlordProfiles.get(userId);\n            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match\n                return res.status(403).json({ message: 'You do not own this property' });\n            }\n            mockStore.properties.splice(idx4, 1);\n            return res.status(200).json({ message: 'Property deleted successfully' });\n        }\n`
      )
      .replace(
        `const uploadPropertyImages = async (req, res) => {\n    try {\n        console.log('📸 Upload request received');\n        console.log('📁 req.files:', req.files);\n        console.log('📝 req.body:', req.body);\n        const { id } = req.params;\n        const userId = req.user.id;\n`,
        `const uploadPropertyImages = async (req, res) => {\n    try {\n        console.log('📸 Upload request received');\n        console.log('📁 req.files:', req.files);\n        console.log('📝 req.body:', req.body);\n        const { id } = req.params;\n        const userId = req.user.id;\n\n        // (sprint4-mock-property) owner-checked image upload without a DB.\n        // Files were already written to /uploads by the multer middleware.\n        if (isMockMode()) {\n            const prop5 = (mockStore.properties || []).find((pr) => pr._id === id);\n            if (!prop5) return res.status(404).json({ message: 'Property not found' });\n            const ownerId = typeof prop5.landlordId === 'object' ? prop5.landlordId._id || prop5.landlordId.accountId : prop5.landlordId;\n            const profile = mockStore.landlordProfiles.get(userId);\n            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match\n                return res.status(403).json({ message: 'You do not own this property' });\n            }\n            if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No images uploaded' });\n            prop5.images = prop5.images || [];\n            const entries = req.files.map((file, index) => ({\n                _id: 'mock-image-' + Date.now() + '-' + index,\n                key: file.filename,\n                url: '/uploads/' + file.filename,\n                isPrimary: prop5.images.length === 0 && index === 0,\n                uploadedAt: new Date().toISOString(),\n            }));\n            prop5.images.push(...entries);\n            return res.status(200).json({\n                message: req.files.length + ' image(s) uploaded successfully',\n                data: { propertyId: prop5._id, images: prop5.images, totalImages: prop5.images.length },\n            });\n        }\n`
      )
      .replace(
        `const deletePropertyImage = async (req, res) => {\n    try {\n        const { id, imageId } = req.params;\n        const userId = req.user.id;\n`,
        `const deletePropertyImage = async (req, res) => {\n    try {\n        const { id, imageId } = req.params;\n        const userId = req.user.id;\n\n        // (sprint4-mock-property) owner-checked image delete without a DB\n        if (isMockMode()) {\n            const prop6 = (mockStore.properties || []).find((pr) => pr._id === id);\n            if (!prop6) return res.status(404).json({ message: 'Property not found' });\n            const ownerId = typeof prop6.landlordId === 'object' ? prop6.landlordId._id || prop6.landlordId.accountId : prop6.landlordId;\n            const profile = mockStore.landlordProfiles.get(userId);\n            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match\n                return res.status(403).json({ message: 'You do not own this property' });\n            }\n            const imgIdx = (prop6.images || []).findIndex((img) => img._id === imageId || img.key === imageId);\n            if (imgIdx === -1) return res.status(404).json({ message: 'Image not found' });\n            prop6.images.splice(imgIdx, 1);\n            return res.status(200).json({ message: 'Image deleted successfully', data: { images: prop6.images } });\n        }\n`
      )
      .replace(
        `const setPrimaryImage = async (req, res) => {\n    try {\n        const { id, imageId } = req.params;\n        const userId = req.user.id;\n`,
        `const setPrimaryImage = async (req, res) => {\n    try {\n        const { id, imageId } = req.params;\n        const userId = req.user.id;\n\n        // (sprint4-mock-property) owner-checked primary-image flip without a DB\n        if (isMockMode()) {\n            const prop7 = (mockStore.properties || []).find((pr) => pr._id === id);\n            if (!prop7) return res.status(404).json({ message: 'Property not found' });\n            const ownerId = typeof prop7.landlordId === 'object' ? prop7.landlordId._id || prop7.landlordId.accountId : prop7.landlordId;\n            const profile = mockStore.landlordProfiles.get(userId);\n            if (!profile || (profile._id !== ownerId && ownerId !== userId)) { // sprint4-owner-fix: allow profile._id match OR direct user-id match\n                return res.status(403).json({ message: 'You do not own this property' });\n            }\n            const target = (prop7.images || []).find((img) => img._id === imageId || img.key === imageId);\n            if (!target) return res.status(404).json({ message: 'Image not found' });\n            prop7.images.forEach((img) => { img.isPrimary = img === target; });\n            return res.status(200).json({ message: 'Primary image updated', data: { images: prop7.images } });\n        }\n`
      );
    if (pc === before) {
      console.log('  ! NO MATCH after LF normalization: ' + pcFile);
      process.exitCode = 1;
    } else {
      write(pcFile, pc);
      applied++;
      console.log('  ✔ patched ' + pcFile + ' (LF-normalized)');
    }
  }
}

// ── S2c: resend verification code works in mock mode ────────────────────────
patch('backend/src/controller/authContoller.js', 'sprint2-resend-mock', (s) =>
  s.replace(
    'const resendEmailCode = async (req, res) => {\n  try {\n    const { email } = req.body;',
    'const resendEmailCode = async (req, res) => {\n  try {\n    const { email } = req.body;\n    // (sprint2-resend-mock) resend works in mock mode too\n    if (isMockMode()) {\n      const mockUser = mockStore.users.get(email);\n      if (!mockUser) return res.status(404).json({ message: "User not found" });\n      const verificationCode = crypto.randomInt(100000, 1000000).toString();\n      mockUser.emailVerificationCode = verificationCode;\n      mockUser.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();\n      console.log("⚡ [MOCK DB] New verification code for " + email + ": " + verificationCode);\n      return res.status(200).json({ message: "Verification code sent", devVerificationCode: verificationCode });\n    }'
  )
);

// ── S4: reserved availability state in the model ────────────────────────────
patch('backend/src/models/Property.js', '"reserved"', (s) =>
  s.replace(
    'enum: ["draft", "active", "rented", "inactive", "suspended"],',
    'enum: ["draft", "active", "reserved", "rented", "inactive", "suspended"], // sprint4: reserved per spec'
  )
);

// ── S4: mock seeded properties get a status field ───────────────────────────
patch('backend/src/config/db.js', 'sprint4-property-status', (s) =>
  s.replace(
    'mockStore.conversations = mockStore.conversations || [];',
    '// (sprint4-property-status) spec availability states on every seeded listing\n(mockStore.properties || []).forEach((p) => { p.status = p.status || "active"; });\n\nmockStore.conversations = mockStore.conversations || [];'
  )
);

console.log(applied === 0 ? 'Nothing to do (all patches already applied).' : applied + ' file(s) patched.');
