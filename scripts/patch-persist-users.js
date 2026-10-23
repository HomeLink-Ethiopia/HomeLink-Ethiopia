const fs = require('fs');

// ─── 1. db.js: load-on-boot + persist helper ───
let p = 'backend/src/config/db.js';
let raw = fs.readFileSync(p, 'utf8');
let eol = raw.includes('\r\n') ? '\r\n' : '\n';
let s = raw.replace(/\r\n/g, '\n');

if (!s.includes('MOCK_USERS_FILE')) {
  const anchor = 'const mockStore = {';
  if (!anchor) throw new Error('mockStore anchor not found');
  const prelude = [
    '// ─── PERSISTENT MOCK USERS (sprint-persist-mock-users) ───',
    '// The in-memory user store is wiped on every backend restart, which made',
    '// accounts registered from the signup page disappear (and sign-in fail with',
    '// "Invalid email or password"). Registered users are now mirrored to disk',
    '// and reloaded at boot so demo signups survive restarts.',
    'const MOCK_USERS_FILE = path.join(__dirname, "..", "..", "mock-users.json");',
    'const persistMockUsers = () => {',
    '  try {',
    '    fs.writeFileSync(MOCK_USERS_FILE, JSON.stringify([...mockStore.users.entries()], null, 2));',
    '  } catch (e) {',
    '    console.warn("[MOCK DB] could not persist users:", e.message);',
    '  }',
    '};',
    'const loadMockUsers = () => {',
    '  try {',
    '    if (fs.existsSync(MOCK_USERS_FILE)) {',
    '      const entries = JSON.parse(fs.readFileSync(MOCK_USERS_FILE, "utf8"));',
    '      for (const [email, user] of entries) {',
    '        if (!mockStore.users.has(email)) mockStore.users.set(email, user);',
    '      }',
    '      console.log(`[MOCK DB] restored ${entries.length} persisted user(s) from mock-users.json`);',
    '    }',
    '  } catch (e) {',
    '    console.warn("[MOCK DB] could not load persisted users:", e.message);',
    '  }',
    '};',
    'loadMockUsers();',
    '',
  ].join('\n');
  s = s.replace(anchor, prelude + anchor);
  s = s.replace('module.exports.pushMockAudit = pushMockAudit;', 'module.exports.pushMockAudit = pushMockAudit;\nmodule.exports.persistMockUsers = persistMockUsers;');
  fs.writeFileSync(p, s);
  console.log('db.js patched (persist/load mock users)');
} else {
  console.log('db.js already patched');
}

// ─── 2. authContoller.js: persist after mutations ───
p = 'backend/src/controller/authContoller.js';
raw = fs.readFileSync(p, 'utf8');
s = raw.replace(/\r\n/g, '\n');
let n = 0;

if (!s.includes('persistMockUsers')) {
  // import
  const impAnchor = "const { isMockMode, mockStore } = require(\"../config/db\");";
  if (s.includes(impAnchor)) {
    s = s.replace(impAnchor, impAnchor + '\nconst { persistMockUsers } = require("../config/db"); // sprint-persist-mock-users');
    n++;
  } else {
    // maybe destructured differently; find first isMockMode require
    const m = s.match(/const \{[^}]*isMockMode[^}]*\} = require\("\.\.\/config\/db"\);/);
    if (!m) throw new Error('no isMockMode require found in authContoller');
    s = s.replace(m[0], m[0] + '\nconst { persistMockUsers } = require("../config/db"); // sprint-persist-mock-users');
    n++;
  }

  const eolC = '\n';
  // a) registerUser mock: after console.log register line
  const regAnchor = 'console.log(`⚡ [MOCK DB] User registered: ${email} (${assignedRole}) | Verification Code: ${verificationCode}`);';
  if (s.includes(regAnchor)) {
    s = s.replace(regAnchor, regAnchor + '\n      persistMockUsers(); // sprint-persist-mock-users');
    n++;
  } else { throw new Error('register mock anchor not found'); }

  // b) verifyEmail mock: after the console.log with new verification code
  const verAnchor = 'console.log("⚡ [MOCK DB] New verification code for " + email + ": " + verificationCode);';
  if (s.includes(verAnchor)) {
    s = s.replace(verAnchor, verAnchor + '\n      persistMockUsers(); // sprint-persist-mock-users');
    n++;
  } else { console.warn('verify mock anchor not found (skipped)'); }

  // c) forgotPassword mock: after reset code console.log
  const fpAnchor = 'console.log(`\\u26a1 [MOCK DB] Password reset code for ${email}: ${resetCode}`);';
  if (s.includes(fpAnchor)) {
    s = s.replace(fpAnchor, fpAnchor + '\n      persistMockUsers(); // sprint-persist-mock-users');
    n++;
  } else { console.warn('forgot-password mock anchor not found (skipped)'); }

  fs.writeFileSync(p, s);
  console.log('authContoller.js patched (' + n + ' insertion points)');
} else {
  console.log('authContoller.js already patched');
}

// ─── 3. .gitignore: keep mock-users.json out of git ───
const gi = '.gitignore';
if (fs.existsSync(gi)) {
  let g = fs.readFileSync(gi, 'utf8');
  if (!g.includes('mock-users.json')) {
    g = g.replace(/\r\n/g, '\n').replace(/\n?$/, '\n') + '\n# mock-mode persisted users (demo data)\nmock-users.json\n';
    fs.writeFileSync(gi, g);
    console.log('.gitignore updated');
  }
}
