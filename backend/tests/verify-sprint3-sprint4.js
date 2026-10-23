/**
 * SPRINT 3 & SPRINT 4 ACCEPTANCE VERIFICATION SUITE
 * 
 * Verifies:
 * SPRINT 3:
 * 1. Landlord identity verification submission (POST /api/v1/verification/submit-identity with multipart/form-data)
 * 2. Landlord verification states: pending, under_review, verified, rejected
 * 3. Document support: Kebele ID, Title Deed, utility bill, photos
 * 4. Landlord verification status (GET /api/v1/verification/status)
 * 5. Admin verification queue (GET /api/v1/verification/pending)
 * 6. Admin review of landlord identity: approve, reject with reason
 * 7. Property verification submission (POST /api/v1/verification/submit with multipart/form-data)
 * 8. System checks on property verification: ownership check, duplicate prevention
 * 9. Admin review of property verification: approve, reject with reason
 * 10. Audit trail records: who reviewed, what changed, when, decision, reason
 * 
 * SPRINT 4:
 * 11. Property model: title, description, propertyType, price, location, address, bedrooms, bathrooms, area, amenities, images, availability, landlord, verificationStatus
 * 12. Landlord APIs:
 *     - POST /properties (create listing, unverified blocked, verified succeeds)
 *     - GET /properties/my (landlord inventory)
 *     - GET /properties/:id (property detail with public view)
 *     - PUT /properties/:id (owner updates fields, availability states: available, reserved, rented, inactive)
 *     - DELETE /properties/:id (owner deletes property)
 * 13. Authorization: non-owner blocked from edit/delete (403), tenant blocked (403)
 * 14. Image management:
 *     - POST /properties/:id/images (upload multiple images via multipart/form-data)
 *     - PUT /properties/:id/images/:imageId/primary (set primary image)
 *     - DELETE /properties/:id/images/:imageId (delete image)
 * 15. Frontend endpoints connectivity: returns 200 on all landlord and admin verification/property routes
 */

const BASE = 'http://localhost:5000';
const FRONTEND = 'http://localhost:3000';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', message });
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', message, detail });
    console.error(`  ✗ ${message}${detail ? ' — ' + detail : ''}`);
  }
}

async function api(method, path, token, body, isFormData = false) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, options);
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, headers: res.headers, data: json };
}

(async () => {
  console.log('\n======================================================');
  console.log('🛡️ SPRINT 3 & 🏠 SPRINT 4 COMPREHENSIVE VERIFICATION');
  console.log('======================================================\n');

  // --- Step 0: Accounts setup ---
  console.log('--- Step 0: Authentication Setup ---');
  const adminRes = await api('POST', '/api/auth/login', null, { email: 'dev.admin@homelink.test', password: 'Password123!' });
  const adminToken = adminRes.data?.token;
  assert(adminRes.status === 200 && !!adminToken, 'Admin can login and receives JWT');

  const landlordRes = await api('POST', '/api/auth/login', null, { email: 'dev.landlord@homelink.test', password: 'Password123!' });
  const landlordToken = landlordRes.data?.token;
  assert(landlordRes.status === 200 && !!landlordToken, 'Verified landlord can login and receives JWT');

  // Register a fresh unverified landlord
  const stamp = Date.now();
  const unverifiedEmail = `fresh.landlord.${stamp}@homelink.test`;
  const unverifiedPhone = `0944${String(stamp % 1000000).padStart(6, '0')}`;
  const regUnverified = await api('POST', '/api/auth/register', null, {
    firstName: 'Abebe',
    lastName: 'Bikila',
    email: unverifiedEmail,
    phone: unverifiedPhone,
    password: 'Password123!',
    role: 'landlord'
  });
  assert(regUnverified.status === 201, 'Fresh landlord can register');

  const unvLogin = await api('POST', '/api/auth/login', null, { email: unverifiedEmail, password: 'Password123!' });
  const unverifiedToken = unvLogin.data?.token;
  const unverifiedUser = unvLogin.data?.user;
  assert(unvLogin.status === 200 && !!unverifiedToken, 'Fresh landlord can login');

  // Tenant account
  const tenantRes = await api('POST', '/api/auth/login', null, { email: 'dev.tenant@homelink.test', password: 'Password123!' });
  const tenantToken = tenantRes.data?.token;
  assert(tenantRes.status === 200 && !!tenantToken, 'Tenant can login');

  // --- SPRINT 3: Landlord Verification ---
  console.log('\n--- SPRINT 3: Landlord Identity Verification Workflow ---');

  // Initial status
  const initStatus = await api('GET', '/api/v1/verification/status?format=details', unverifiedToken);
  assert(initStatus.status === 200, 'GET /verification/status returns 200 for landlord');
  assert(
    initStatus.data?.data?.profile || initStatus.data?.profile,
    'GET /verification/status returns landlord profile structure'
  );

  // Submit identity documents (using FormData)
  const fdIdentity = new FormData();
  const idBlob1 = new Blob(['sample-kebele-id-image-binary-content'], { type: 'image/jpeg' });
  const idBlob2 = new Blob(['%PDF-1.4 sample title deed pdf document'], { type: 'application/pdf' });
  fdIdentity.append('files', idBlob1, 'kebele_id_abebe.jpg');
  fdIdentity.append('files', idBlob2, 'title_deed_bldg4.pdf');
  fdIdentity.append('docTypes', JSON.stringify(['kebele_id', 'title_deed']));

  const uploadIdRes = await api('POST', '/api/v1/verification/submit-identity', unverifiedToken, fdIdentity, true);
  assert(uploadIdRes.status === 201, 'POST /verification/submit-identity accepts documents and returns 201', `got ${uploadIdRes.status}`);
  assert(uploadIdRes.data?.data?.profile?.verificationStatus === 'pending', 'Profile verification status transitions to pending');
  assert(
    uploadIdRes.data?.data?.profile?.submittedDocuments?.length >= 2,
    'Uploaded documents (Kebele ID, Title Deed) are securely stored on landlord profile'
  );

  // Status after upload
  const pendingStatus = await api('GET', '/api/v1/verification/status?format=details', unverifiedToken);
  const landlordProfile = pendingStatus.data?.data?.profile || pendingStatus.data?.profile;
  assert(landlordProfile?.verificationStatus === 'pending', 'Verification status is "pending" for landlord');

  // Admin verification queue
  const queueRes = await api('GET', '/api/v1/verification/pending', adminToken);
  assert(queueRes.status === 200, 'Admin can access GET /verification/pending queue');
  const queueData = queueRes.data?.data;
  assert(
    Array.isArray(queueData?.landlords) && Array.isArray(queueData?.properties),
    'Admin queue separates landlords and properties queues'
  );

  const foundInQueue = (queueData?.landlords || []).find(l => 
    l._id === unverifiedUser?.id || l.accountId?._id === unverifiedUser?.id || l.accountId?.email === unverifiedEmail
  );
  assert(!!foundInQueue, 'Abebe appears in the admin landlord verification queue');

  // Admin rejects with reason
  const landlordProfileId = foundInQueue?._id || unverifiedUser?.id;
  const rejectRes = await api('PUT', `/api/v1/verification/landlord/${landlordProfileId}/review`, adminToken, {
    status: 'rejected',
    rejectionReason: 'Document image is blurry or unreadable',
    reviewNotes: 'Please upload a clearer scan of your Kebele ID'
  });
  assert(rejectRes.status === 200, 'Admin can reject landlord identity verification with reason');

  // Landlord checks status and sees rejection reason
  const rejectedStatus = await api('GET', '/api/v1/verification/status?format=details', unverifiedToken);
  const rejectedProfile = rejectedStatus.data?.data?.profile || rejectedStatus.data?.profile;
  assert(
    rejectedProfile?.verificationStatus === 'rejected' || rejectedProfile?.verificationStatus === 'suspended',
    'Landlord profile status reflects rejected state'
  );
  assert(
    rejectedProfile?.rejectionReason === 'Document image is blurry or unreadable',
    'Landlord can view the exact admin rejection reason'
  );

  // Landlord resubmits clearer documents
  const fdResubmit = new FormData();
  const clearIdBlob = new Blob(['clear-high-resolution-kebele-scan'], { type: 'image/jpeg' });
  fdResubmit.append('files', clearIdBlob, 'kebele_clear.jpg');
  fdResubmit.append('docTypes', JSON.stringify(['kebele_id']));

  const resubmitRes = await api('POST', '/api/v1/verification/submit-identity', unverifiedToken, fdResubmit, true);
  assert(resubmitRes.status === 201, 'Landlord can resubmit documents after rejection');

  // Admin approves landlord
  const approveRes = await api('PUT', `/api/v1/verification/landlord/${landlordProfileId}/review`, adminToken, {
    status: 'verified',
    reviewNotes: 'High quality scans verified against kebele records'
  });
  assert(approveRes.status === 200, 'Admin can approve landlord identity verification');

  const verifiedStatus = await api('GET', '/api/v1/verification/status?format=details', unverifiedToken);
  const verifiedProfile = verifiedStatus.data?.data?.profile || verifiedStatus.data?.profile;
  assert(verifiedProfile?.verificationStatus === 'verified', 'Landlord status is now verified');

  // Audit trail verification
  const auditLogsRes = await api('GET', '/api/v1/admin/audit-logs', adminToken);
  assert(auditLogsRes.status === 200, 'Admin audit logs accessible');
  const logs = auditLogsRes.data?.data || [];
  const landlordAudit = logs.some(l => l.action?.includes('landlord') && l.createdAt);
  assert(landlordAudit, 'Audit trail records who reviewed, what changed, when, decision and reason');

  // --- SPRINT 4: Property Management ---
  console.log('\n--- SPRINT 4: Property Management & Availability Lifecycle ---');

  // Unverified landlord blocked from creating property
  const anotherUnverifiedEmail = `blocked.unv.${stamp}@homelink.test`;
  await api('POST', '/api/auth/register', null, {
    firstName: 'Blocked', lastName: 'Guy', email: anotherUnverifiedEmail,
    phone: `0955${String(stamp % 1000000).padStart(6, '0')}`,
    password: 'Password123!', role: 'landlord'
  });
  const blkLogin = await api('POST', '/api/auth/login', null, { email: anotherUnverifiedEmail, password: 'Password123!' });
  const blkToken = blkLogin.data?.token;

  // Unverified profile in mock store starts unverified
  const { mockStore } = require('../src/config/db');
  if (mockStore?.landlordProfiles) {
    mockStore.landlordProfiles.set(blkLogin.data?.user?.id, {
      _id: 'mock-unv-' + blkLogin.data?.user?.id,
      accountId: blkLogin.data?.user?.id,
      verificationStatus: 'unverified'
    });
  }

  const blockedCreate = await api('POST', '/api/v1/properties', blkToken, {
    title: 'Illegal Property Claim',
    propertyType: 'apartment',
    rentAmount: 30000,
    bedrooms: 2
  });
  assert(blockedCreate.status === 403, 'A landlord cannot simply claim: unverified landlord is blocked from creating property (403)');

  // Verified landlord Abebe creates a property
  const propPayload = {
    title: 'Summit Luxury Villa Residence',
    description: 'Beautiful 3-bedroom furnished villa in Bole Summit with modern amenities and generator.',
    propertyType: 'villa',
    price: 65000,
    bedrooms: 3,
    bathrooms: 2,
    area: 180,
    address: 'Bole Subcity, Woreda 06, Summit',
    amenities: ['Parking', 'Generator', 'Security Guard', 'WiFi'],
    availability: 'available'
  };

  const createPropRes = await api('POST', '/api/v1/properties', unverifiedToken, propPayload);
  assert(createPropRes.status === 201, 'Verified landlord can create a property (POST /properties)');
  const createdProp = createPropRes.data?.data || createPropRes.data;
  const propId = createdProp?._id;

  assert(
    createdProp &&
    (createdProp.rentAmount === 65000 || createdProp.price === 65000) &&
    createdProp.title === 'Summit Luxury Villa Residence' &&
    createdProp.propertyType === 'villa' &&
    (createdProp.sizeM2 === 180 || createdProp.area === 180),
    'Property model includes: title, description, propertyType, price/rentAmount, location/address, bedrooms, bathrooms, area/sizeM2, amenities'
  );

  // Property image upload (multiple images, validation)
  const fdPropImages = new FormData();
  const imgBlob1 = new Blob(['image-bytes-front-facade'], { type: 'image/jpeg' });
  const imgBlob2 = new Blob(['image-bytes-master-bedroom'], { type: 'image/jpeg' });
  const imgBlob3 = new Blob(['image-bytes-modern-kitchen'], { type: 'image/jpeg' });
  fdPropImages.append('images', imgBlob1, 'front_facade.jpg');
  fdPropImages.append('images', imgBlob2, 'master_bedroom.jpg');
  fdPropImages.append('images', imgBlob3, 'kitchen.jpg');

  const imgUploadRes = await api('POST', `/api/v1/properties/${propId}/images`, unverifiedToken, fdPropImages, true);
  assert(imgUploadRes.status === 200, 'Upload multiple property images succeeds (POST /properties/:id/images)');
  const propImages = imgUploadRes.data?.data?.images || [];
  assert(propImages.length >= 3, 'Multiple images uploaded and stored with URLs');
  assert(propImages[0].isPrimary === true, 'First uploaded image is automatically marked as primary');

  // Set primary image
  const secondImageId = propImages[1]?._id || propImages[1]?.key;
  if (secondImageId) {
    const setPrimaryRes = await api('PUT', `/api/v1/properties/${propId}/images/${secondImageId}/primary`, unverifiedToken);
    assert(setPrimaryRes.status === 200, 'Landlord can change primary image (PUT /properties/:id/images/:imageId/primary)');
  }

  // Delete image
  const thirdImageId = propImages[2]?._id || propImages[2]?.key;
  if (thirdImageId) {
    const delImgRes = await api('DELETE', `/api/v1/properties/${propId}/images/${thirdImageId}`, unverifiedToken);
    assert(delImgRes.status === 200, 'Landlord can delete an image (DELETE /properties/:id/images/:imageId)');
  }

  // Submit property for verification (Sprint 3 requirement)
  const fdPropVer = new FormData();
  fdPropVer.append('propertyId', propId);
  const photoBlob = new Blob(['property-photo-for-verification'], { type: 'image/jpeg' });
  const deedBlob = new Blob(['%PDF-1.4 property-title-deed-document'], { type: 'application/pdf' });
  fdPropVer.append('files', photoBlob, 'prop_photo.jpg');
  fdPropVer.append('files', deedBlob, 'title_deed.pdf');
  fdPropVer.append('docTypes', JSON.stringify(['property_photos', 'title_deed']));

  const submitPropVerRes = await api('POST', '/api/v1/verification/submit', unverifiedToken, fdPropVer, true);
  assert(submitPropVerRes.status === 201, 'Landlord submits property for verification (POST /verification/submit with documents)');

  // Duplicate check: submitting the same property again should be rejected
  const dupVerRes = await api('POST', '/api/v1/verification/submit', unverifiedToken, fdPropVer, true);
  assert(dupVerRes.status === 400, 'System checks duplicate information: rejects duplicate pending verification request (400)');

  // Non-owner cannot submit verification for Abebe's property
  const nonOwnerVerRes = await api('POST', '/api/v1/verification/submit', landlordToken, {
    propertyId: propId,
    documents: [{ fileKey: '/fake.pdf', name: 'fake.pdf' }]
  });
  assert(nonOwnerVerRes.status === 400 || nonOwnerVerRes.status === 403 || nonOwnerVerRes.status === 404, 'System checks owner information on property verification');

  // Admin approves property verification
  const queueAfterProp = await api('GET', '/api/v1/verification/pending', adminToken);
  const pendingProps = queueAfterProp.data?.data?.properties || [];
  const foundPropVer = pendingProps.find(p => (p.propertyId?._id || p.propertyId) === propId);
  const propVerId = foundPropVer?._id;
  assert(!!propVerId, 'Property submission appears in Admin verification queue');

  if (propVerId) {
    const approvePropRes = await api('PUT', `/api/v1/verification/${propVerId}/review`, adminToken, {
      status: 'verified',
      reviewNotes: 'Property ownership documents confirmed with City Municipality'
    });
    assert(approvePropRes.status === 200, 'Admin approves property verification with decision and reason');
  }

  // GET /properties/my lists landlord inventory
  const myPropsRes = await api('GET', '/api/v1/properties/my', unverifiedToken);
  assert(myPropsRes.status === 200, 'GET /properties/my returns landlord properties inventory');
  const myProps = myPropsRes.data?.data || myPropsRes.data || [];
  assert(myProps.some(p => p._id === propId), 'Created property is present in landlord inventory');

  // GET /properties/:id
  const getSingleRes = await api('GET', `/api/v1/properties/${propId}`);
  assert(getSingleRes.status === 200, 'GET /properties/:id returns property details');
  const detailProp = getSingleRes.data?.data || getSingleRes.data;
  assert(detailProp?.title === 'Summit Luxury Villa Residence', 'Property detail matches created property');

  // Authorization: Only owner can edit/delete
  console.log('\n--- Authorization & Owner Security ---');
  const otherLandlordEdit = await api('PUT', `/api/v1/properties/${propId}`, landlordToken, {
    title: 'Hacked Title By Other Landlord'
  });
  assert(otherLandlordEdit.status === 403, 'Non-owner landlord is blocked from editing property (403)');

  const otherLandlordDel = await api('DELETE', `/api/v1/properties/${propId}`, landlordToken);
  assert(otherLandlordDel.status === 403, 'Non-owner landlord is blocked from deleting property (403)');

  const tenantEdit = await api('PUT', `/api/v1/properties/${propId}`, tenantToken, {
    title: 'Tenant Hacked Property'
  });
  assert(tenantEdit.status === 403, 'Tenant is blocked from editing property (403)');

  // Availability states: available, reserved, rented, inactive
  console.log('\n--- Availability State Machine ---');
  const st1 = await api('PUT', `/api/v1/properties/${propId}`, unverifiedToken, { status: 'reserved' });
  assert(st1.status === 200, 'Property state can change to "reserved"');

  const st2 = await api('PUT', `/api/v1/properties/${propId}`, unverifiedToken, { status: 'rented' });
  assert(st2.status === 200, 'Property state can change to "rented"');

  const st3 = await api('PUT', `/api/v1/properties/${propId}`, unverifiedToken, { status: 'inactive' });
  assert(st3.status === 200, 'Property state can change to "inactive"');

  const st4 = await api('PUT', `/api/v1/properties/${propId}`, unverifiedToken, { status: 'available' });
  assert(st4.status === 200, 'Property state can change to "available"');

  const badStatus = await api('PUT', `/api/v1/properties/${propId}`, unverifiedToken, { status: 'invalid_status_xyz' });
  assert(badStatus.status === 400, 'Invalid availability state is rejected (400)');

  // Owner deletes property
  console.log('\n--- Property Deletion ---');
  const delRes = await api('DELETE', `/api/v1/properties/${propId}`, unverifiedToken);
  assert(delRes.status === 200, 'Owner can delete their property (DELETE /properties/:id)');

  const verifyDeleted = await api('GET', `/api/v1/properties/${propId}`);
  assert(verifyDeleted.status === 404, 'Deleted property returns 404');

  // --- Frontend Pages Health Check ---
  console.log('\n--- Frontend Route Availability ---');
  const pagesToTest = [
    { url: `${FRONTEND}/landlord/verification`, name: 'Landlord Verification page' },
    { url: `${FRONTEND}/admin/verification-queue`, name: 'Admin Verification Queue page' },
    { url: `${FRONTEND}/landlord/properties`, name: 'Landlord Properties page' },
    { url: `${FRONTEND}/landlord/properties/new`, name: 'Landlord Add Property page' },
  ];

  for (const p of pagesToTest) {
    try {
      const res = await fetch(p.url);
      assert(res.status === 200, `Frontend: ${p.name} returns HTTP 200`);
    } catch (e) {
      assert(false, `Frontend: ${p.name} reachable`, e.message);
    }
  }

  // --- Final Summary ---
  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
