/* eslint-disable */
// Sprint 11 test reset — restores seeded verification rows to a reviewable
// state by calling the mock submit endpoint as the landlord (creates a fresh
// pending property request). Run: node scripts/sprint11-reset.js
const BASE = 'http://localhost:5000';

async function login(email) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  const j = await res.json();
  return j.token;
}

(async () => {
  // The seeded mock-propver-1 may already be decided from an earlier run —
  // file a NEW property verification on a seeded property so the review tests
  // always have a pending request to act on.
  const landlord = await login('dev.landlord@homelink.test');
  const res = await fetch(BASE + '/api/v1/verification/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${landlord}` },
    body: JSON.stringify({
      propertyId: '66d1f801e12a4b001a111111',
      documents: [
        { fileKey: '/uploads/deed-bole.pdf', name: 'ownership-deed.pdf', docType: 'ownership_proof' },
        { fileKey: '/uploads/id-landlord.jpg', name: 'national-id.jpg', docType: 'identity_document' },
      ],
    }),
  });
  console.log('seed verification submit:', res.status);
})().catch((e) => { console.error(e.message); process.exit(1); });
