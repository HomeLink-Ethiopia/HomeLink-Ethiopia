# 🏠 HOMELINK — COMPLETE API DOCUMENTATION

## 📚 TABLE OF CONTENTS
- [Authentication Endpoints](#authentication-endpoints)
- [Property Endpoints](#property-endpoints)
- [Verification Endpoints](#verification-endpoints)
- [Middleware Flow](#middleware-flow)
- [Complete End-to-End Flow](#complete-end-to-end-flow)

---

## 🔐 AUTHENTICATION ENDPOINTS

---

### 1. User Registration

**Endpoint:** `POST /api/auth/register`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `registerUser()` function
- `models/User.js` → User schema
- `validators/authValidators.js` → Joi validation
- `utils/emailService.js` → Resend email integration

**How It Works:**
```
POST /api/auth/register
   → authController.registerUser()
   → Validates input using Joi schema
   → Checks if email already exists in database
   → Checks if phone number already exists
   → Generates 6-digit verification code using crypto.randomInt()
   → Hashes verification code using bcrypt (10 rounds)
   → Sets verification code expiry to 10 minutes from now
   → Hashes password using bcrypt (10 rounds)
   → Creates User in database with role: "tenant"
   → Calls sendVerificationEmail() to send code via Resend
   → Returns success response with user data (excluding password)
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "firstName": "Kidist",
  "lastName": "Kinfe",
  "email": "Kid@example.com",
  "phone": "0912345678",
  "password": "Secure@1234"
}
```

**Sample Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "6a80ae64f1fcf7e3455440b5",
    "firstName": "Kidist",
    "lastName": "Kinfe",
    "email": "Kidist@gmail.com",
    "phone": "0912345678",
    "role": "tenant",
    "identityStatus": "pending",
    "emailVerified": false
  }
}
```

---

### 2. Email Verification

**Endpoint:** `POST /api/auth/verify-email`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `verifyEmail()` function
- `models/User.js` → User schema

**How It Works:**
```
POST /api/auth/verify-email
   → authController.verifyEmail()
   → Finds user by email in database
   → Checks if email is already verified
   → Checks if verification code has expired
   → Compares provided code with stored hashed code using bcrypt.compare()
   → If code matches:
      → Sets emailVerified: true
      → Removes emailVerificationCode from database
      → Removes emailVerificationExpires from database
      → Saves user
   → Returns success response
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/verify-email
Content-Type: application/json

{
"email": "Kidist@gmail.com",
  "code": "483920"
}
```

**Sample Response:**
```json
{
  "message": "Email verified successfully"
}
```

---

### 3. Resend Verification Code

**Endpoint:** `POST /api/auth/resend-email-code`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `resendEmailCode()` function
- `models/User.js` → User schema
- `utils/emailService.js` → Resend email integration

**How It Works:**
```
POST /api/auth/resend-email-code
   → authController.resendEmailCode()
   → Finds user by email
   → Checks if email is already verified
   → Generates new 6-digit verification code
   → Hashes new code using bcrypt
   → Sets new expiry to 10 minutes from now
   → Sends new code via email
   → Returns success response
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/resend-email-code
Content-Type: application/json

{
  "email": "Kidist@gmail.com"
}
```

**Sample Response:**
```json
{
  "message": "A new verification code has been sent to your email"
}
```

---

### 4. User Login

**Endpoint:** `POST /api/auth/login`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `loginUser()` function
- `models/User.js` → User schema
- `middleware/rateLimiter.js` → Login rate limiting

**How It Works:**
```
POST /api/auth/login
   → loginLimiter checks rate limit (5 attempts per 15 minutes)
   → authController.loginUser()
   → Finds user by email
   → Checks if account is active (isActive: true)
   → Compares password with stored hash using bcrypt.compare()
   → If password matches:
      → Generates JWT token with user id and role
      → Token expires in 1 day (24 hours)
   → Returns token and user data (excluding password)
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "Kidist@example.com",
  "password": "Secure@1234"
}
```

**Sample Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6a80ae64f1fcf7e3455440b5",
    "firstName": "Kidist",
    "lastName": "Kinfe",
    "email": "Kidist@gmail.com",
    "phone": "0912345678",
    "role": "tenant",
    "identityStatus": "pending",
    "emailVerified": true
  }
}
```

---

### 5. Forgot Password

**Endpoint:** `POST /api/auth/forgot-password`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `forgotPassword()` function
- `models/User.js` → User schema
- `utils/emailService.js` → Resend email integration

**How It Works:**
```
POST /api/auth/forgot-password
   → passwordResetLimiter checks rate limit (3 attempts per 15 minutes)
   → authController.forgotPassword()
   → Finds user by email
   → Generates 6-digit reset code using crypto.randomInt()
   → Hashes reset code using bcrypt
   → Sets reset code expiry to 10 minutes from now
   → Sends reset code via email
   → Returns success response
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/forgot-password
Content-Type: application/json

{
  "email": "Kidist@gmail.com"
}
```

**Sample Response:**
```json
{
  "message": "Password reset code sent to your email"
}
```

---

### 6. Verify Reset Code

**Endpoint:** `POST /api/auth/verify-reset-code`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `verifyResetCode()` function
- `models/User.js` → User schema

**How It Works:**
```
POST /api/auth/verify-reset-code
   → verificationLimiter checks rate limit
   → authController.verifyResetCode()
   → Finds user by email
   → Checks if reset code exists
   → Checks if reset code has expired
   → Compares provided code with stored hash using bcrypt.compare()
   → If code matches, returns success
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/verify-reset-code
Content-Type: application/json

{
"email": "Kidist@gmail.com",
  "code": "583920"
}
```

**Sample Response:**
```json
{
  "message": "Password reset code is valid"
}
```

---

### 7. Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `resetPassword()` function
- `models/User.js` → User schema

**How It Works:**
```
POST /api/auth/reset-password
   → authController.resetPassword()
   → Finds user by email
   → Checks if reset code exists
   → Checks if reset code has expired
   → Compares provided code with stored hash using bcrypt.compare()
   → If code matches:
      → Hashes new password using bcrypt (10 rounds)
      → Updates user password
      → Removes passwordResetCode from database
      → Removes passwordResetExpires from database
      → Saves user
   → Returns success response
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/reset-password
Content-Type: application/json

{
 "email": "Kidist@gmail.com",
  "code": "583920",
  "newPassword": "NewSecure@1234"
}
```

**Sample Response:**
```json
{
  "message": "Password reset successfully"
}
```

---

### 8. Logout

**Endpoint:** `POST /api/auth/logout`

**Files Involved:**
- `routes/authRoutes.js` → Routes definition
- `controllers/authController.js` → `logoutUser()` function
- `middleware/authMiddleware.js` → JWT verification

**How It Works:**
```
POST /api/auth/logout
   → authMiddleware verifies JWT token
   → authController.logoutUser()
   → Returns success response (client should discard token)
```

**Sample Request:**
```json
POST http://localhost:5000/api/auth/logout
Authorization: Bearer YOUR_TOKEN
```

**Sample Response:**
```json
{
  "message": "Logout successful"
}
```

---

## 🏠 PROPERTY ENDPOINTS

---

### 9. Create Property

**Endpoint:** `POST /api/v1/properties`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `createProperty()` function
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
POST /api/v1/properties
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → propertyController.createProperty()
   → Finds LandlordProfile by accountId (req.user.id)
   → Checks if landlord is verified (verificationStatus: "verified")
   → Creates Property with:
      - landlordId: LandlordProfile._id
      - verificationStatus: "unverified" (default)
      - listingStatus: "draft" (default)
   → Increments verifiedPropertiesCount in LandlordProfile
   → Returns created property data
```

**Sample Request:**
```json
POST http://localhost:5000/api/v1/properties
Authorization: Bearer LANDLORD_TOKEN
Content-Type: application/json

{
  "title": "Bole Luxury 2BR Apartment",
  "description": "Fully furnished apartment with generator and 24/7 security",
  "propertyType": "apartment",
  "location": {
    "address": "Bole, near Friendship Mall",
    "city": "Addis Ababa",
    "subCity": "Bole",
    "coordinates": {
      "type": "Point",
      "coordinates": [38.7996, 9.0084]
    }
  },
  "bedrooms": 2,
  "bathrooms": 2,
  "sizeM2": 120,
  "furnished": true,
  "amenities": ["generator", "water_tank", "wifi", "security"],
  "rentAmount": 25000,
  "currency": "ETB",
  "rentFrequency": "monthly",
  "listingStatus": "draft"
}
```

**Sample Response:**
```json
{
  "message": "Property created successfully",
  "data": {
    "_id": "6a80bcd5879d77f9fb72a50d",
    "landlordId": "6a80b53e736a5034bc2c871f",
    "title": "Bole Luxury 2BR Apartment",
    "rentAmount": 25000,
    "listingStatus": "draft",
    "verificationStatus": "unverified",
    "createdAt": "2026-08-15T19:24:05.758Z"
  }
}
```

---

### 10. Get My Properties

**Endpoint:** `GET /api/v1/properties/my`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `getMyProperties()` function
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/properties/my
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → propertyController.getMyProperties()
   → Finds LandlordProfile by accountId (req.user.id)
   → Finds all Properties where landlordId matches
   → Returns list of properties
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/my
Authorization: Bearer LANDLORD_TOKEN
```

**Sample Response:**
```json
{
  "data": [
    {
      "_id": "6a80bcd5879d77f9fb72a50d",
      "title": "Bole Luxury 2BR Apartment",
      "rentAmount": 25000,
      "verificationStatus": "verified",
      "listingStatus": "active"
    }
  ]
}
```

---

### 11. Get Property by ID

**Endpoint:** `GET /api/v1/properties/:id`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `getPropertyById()` function
- `models/Property.js` → Property schema
- `middleware/authMiddleware.js` → JWT verification

**How It Works:**
```
GET /api/v1/properties/:id
   → authMiddleware verifies JWT token
   → propertyController.getPropertyById()
   → Finds Property by _id
   → Returns property data
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d
Authorization: Bearer USER_TOKEN
```

**Sample Response:**
```json
{
  "data": {
    "_id": "6a80bcd5879d77f9fb72a50d",
    "title": "Bole Luxury 2BR Apartment",
    "description": "Fully furnished apartment with generator and 24/7 security",
    "propertyType": "apartment",
    "rentAmount": 25000,
    "verificationStatus": "verified"
  }
}
```

---

## 🔍 VERIFICATION ENDPOINTS

---

### 12. Submit Property for Verification

**Endpoint:** `POST /api/v1/verification/submit`

**Files Involved:**
- `routes/verificationRoutes.js` → Routes definition
- `controllers/verificationController.js` → `submitVerification()` function
- `models/PropertyVerification.js` → PropertyVerification schema
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
POST /api/v1/verification/submit
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → verificationController.submitVerification()
   → Finds Property by propertyId
   → Checks if property exists
   → Finds LandlordProfile by accountId (req.user.id)
   → Checks if LandlordProfile exists
   → Checks if property already has pending verification
   → Creates PropertyVerification with:
      - propertyId: Property._id
      - landlordProfileId: LandlordProfile._id
      - status: "submitted"
      - submittedDocuments: array of documents
      - auditTrail: [{ action: "SUBMITTED", ... }]
   → Updates Property.verificationStatus to "pending"
   → Returns success response
```

**Sample Request:**
```json
POST http://localhost:5000/api/v1/verification/submit
Authorization: Bearer LANDLORD_TOKEN
Content-Type: application/json

{
  "propertyId": "6a80bcd5879d77f9fb72a50d",
  "documents": [
    { "docType": "title_deed", "fileKey": "uploads/title_deed_123.pdf" },
    { "docType": "kebele_id", "fileKey": "uploads/kebele_456.jpg" },
    { "docType": "utility_bill", "fileKey": "uploads/utility_789.jpg" }
  ]
}
```

**Sample Response:**
```json
{
  "message": "Property verification submitted successfully. Awaiting admin review.",
  "data": {
    "id": "6a80bf26c95dc4c80bf7ff93",
    "status": "submitted",
    "propertyId": "6a80bcd5879d77f9fb72a50d",
    "submittedAt": "2026-08-15T19:33:58.816Z"
  }
}
```

---

### 13. Get Verification Status

**Endpoint:** `GET /api/v1/verification/status`

**Files Involved:**
- `routes/verificationRoutes.js` → Routes definition
- `controllers/verificationController.js` → `getVerificationStatus()` function
- `models/PropertyVerification.js` → PropertyVerification schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/verification/status
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → verificationController.getVerificationStatus()
   → Finds LandlordProfile by accountId (req.user.id)
   → Finds all PropertyVerifications where landlordProfileId matches
   → Populates propertyId with title, address, price
   → Returns list of verification requests with statuses
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/verification/status
Authorization: Bearer LANDLORD_TOKEN
```

**Sample Response:**
```json
{
  "data": [
    {
      "id": "6a80bf26c95dc4c80bf7ff93",
      "property": {
        "_id": "6a80bcd5879d77f9fb72a50d",
        "title": "Bole Luxury 2BR Apartment",
        "price": 25000
      },
      "status": "verified",
      "submittedAt": "2026-08-15T19:33:58.816Z",
      "reviewedAt": "2026-08-15T19:40:00.000Z",
      "rejectionReason": null
    }
  ]
}
```

---

### 14. Get Pending Verifications (Admin)

**Endpoint:** `GET /api/v1/verification/pending`

**Files Involved:**
- `routes/verificationRoutes.js` → Routes definition
- `controllers/verificationController.js` → `getPendingVerifications()` function
- `models/PropertyVerification.js` → PropertyVerification schema
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/verification/pending
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "admin" role
   → verificationController.getPendingVerifications()
   → Finds all PropertyVerifications with status "submitted" or "under_review"
   → Populates propertyId with title, address, price, images
   → Populates landlordProfileId with legalName, phone, address
   → Populates reviewedBy with userId
   → Sorts by createdAt (newest first)
   → Returns list of pending verifications
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/verification/pending
Authorization: Bearer ADMIN_TOKEN
```

**Sample Response:**
```json
{
  "data": [
    {
      "_id": "6a80bf26c95dc4c80bf7ff93",
      "propertyId": {
        "_id": "6a80bcd5879d77f9fb72a50d",
        "title": "Bole Luxury 2BR Apartment",
        "images": []
      },
      "landlordProfileId": {
        "_id": "6a80b53e736a5034bc2c871f",
        "legalName": "Yirgalem Test PLC"
      },
      "status": "submitted",
      "submittedDocuments": [
        {
          "docType": "title_deed",
          "fileKey": "uploads/title_deed_123.pdf",
          "uploadedAt": "2026-08-15T19:33:58.778Z"
        }
      ],
      "createdAt": "2026-08-15T19:33:58.816Z"
    }
  ]
}
```

---

### 15. Review Verification (Admin)

**Endpoint:** `PUT /api/v1/verification/:id/review`

**Files Involved:**
- `routes/verificationRoutes.js` → Routes definition
- `controllers/verificationController.js` → `reviewVerification()` function
- `models/PropertyVerification.js` → PropertyVerification schema
- `models/Property.js` → Property schema
- `models/Account.js` → Account schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
PUT /api/v1/verification/:id/review
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "admin" role
   → verificationController.reviewVerification()
   → Validates status input (verified, rejected, more_info_needed, suspended)
   → Finds PropertyVerification by :id
   → Checks if verification exists
   → Checks if already reviewed
   → Finds admin Account by userId (req.user.id)
   → Updates PropertyVerification:
      - status: new status
      - reviewedBy: admin._id
      - reviewedAt: new Date()
      - reviewNotes: provided notes
      - rejectionReason: if rejected
      - verifiedAt: if verified
   → Adds entry to auditTrail
   → Updates Property.verificationStatus to match
   → Returns success response
```

**Sample Request:**
```json
PUT http://localhost:5000/api/v1/verification/6a80bf26c95dc4c80bf7ff93/review
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "status": "verified",
  "reviewNotes": "All documents are valid. Property verified successfully."
}
```

**Sample Response:**
```json
{
  "message": "Verification verified successfully",
  "data": {
    "id": "6a80bf26c95dc4c80bf7ff93",
    "status": "verified"
  }
}
```

---

### 16. Get Verification Details (Admin)

**Endpoint:** `GET /api/v1/verification/:id`

**Files Involved:**
- `routes/verificationRoutes.js` → Routes definition
- `controllers/verificationController.js` → `getVerificationDetails()` function
- `models/PropertyVerification.js` → PropertyVerification schema
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/verification/:id
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "admin" role
   → verificationController.getVerificationDetails()
   → Finds PropertyVerification by :id
   → Populates propertyId with full details
   → Populates landlordProfileId with full details
   → Populates reviewedBy with userId
   → Returns full verification details
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/verification/6a80bf26c95dc4c80bf7ff93
Authorization: Bearer ADMIN_TOKEN
```

**Sample Response:**
```json
{
  "data": {
    "_id": "6a80bf26c95dc4c80bf7ff93",
    "propertyId": {
      "_id": "6a80bcd5879d77f9fb72a50d",
      "title": "Bole Luxury 2BR Apartment",
      "description": "Fully furnished apartment...",
      "rentAmount": 25000
    },
    "landlordProfileId": {
      "_id": "6a80b53e736a5034bc2c871f",
      "legalName": "Yirgalem Test PLC",
      "verificationStatus": "verified"
    },
    "status": "verified",
    "submittedDocuments": [
      {
        "docType": "title_deed",
        "fileKey": "uploads/title_deed_123.pdf"
      }
    ],
    "auditTrail": [
      {
        "action": "SUBMITTED",
        "notes": "Landlord submitted property for verification",
        "timestamp": "2026-08-15T19:33:58.803Z"
      },
      {
        "action": "STATUS_CHANGED_TO_VERIFIED",
        "notes": "All documents are valid",
        "timestamp": "2026-08-15T19:40:00.000Z"
      }
    ],
    "createdAt": "2026-08-15T19:33:58.816Z",
    "verifiedAt": "2026-08-15T19:40:00.000Z"
  }
}
```

---

## 🛡️ MIDDLEWARE FLOW

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MIDDLEWARE CHAIN                            │
└─────────────────────────────────────────────────────────────────────┘

1. authMiddleware (JWT Verification)
   ├─► Extracts token from Authorization header
   ├─► Verifies token using JWT_SECRET
   ├─► Decodes user data (id, role)
   └─► Attaches user to req.user

2. roleMiddleware (Role-based Access)
   ├─► Checks if user exists on req.user
   ├─► Compares user.role with allowed roles
   ├─► If match → proceed to controller
   └─► If no match → return 403 Forbidden

3. rateLimiter (Brute-force Protection)
   ├─► Applied to login endpoint (5 attempts/15 min)
   ├─► Applied to verification endpoints (5 attempts/10 min)
   └─► Applied to password reset endpoints (3 attempts/15 min)
```

---

## 🔄 COMPLETE END-TO-END FLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPLETE END-TO-END FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: REGISTER USER
        └─► POST /api/auth/register
            └─► User created with role: "tenant"

STEP 2: VERIFY EMAIL
        └─► POST /api/auth/verify-email
            └─► emailVerified: true

STEP 3: LOGIN
        └─► POST /api/auth/login
            └─► JWT token received

STEP 4: UPGRADE TO LANDLORD (Manual or Admin)
        └─► Update role: "landlord" in MongoDB
        └─► Create LandlordProfile

STEP 5: CREATE PROPERTY
        └─► POST /api/v1/properties
            └─► Property created with verificationStatus: "unverified"

STEP 6: SUBMIT VERIFICATION
        └─► POST /api/v1/verification/submit
            └─► PropertyVerification created (status: "submitted")
            └─► Property.verificationStatus: "pending"

STEP 7: ADMIN REVIEW
        └─► GET /api/v1/verification/pending
            └─► Sees verification request
        └─► PUT /api/v1/verification/:id/review
            └─► status: "verified"
            └─► Property.verificationStatus: "verified"

STEP 8: PROPERTY IS VERIFIED ✅
        └─► Tenants can now see verified badge
        └─► Trust layer is active
```

---

## 📊 API QUICK REFERENCE TABLE

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | Login and get JWT token | Public |
| `POST` | `/api/auth/verify-email` | Verify email with code | Public |
| `POST` | `/api/auth/resend-email-code` | Resend verification code | Public |
| `POST` | `/api/auth/forgot-password` | Request password reset | Public |
| `POST` | `/api/auth/verify-reset-code` | Verify reset code | Public |
| `POST` | `/api/auth/reset-password` | Reset password | Public |
| `POST` | `/api/auth/logout` | Logout user | Private |
| `POST` | `/api/v1/properties` | Create new property | Landlord |
| `GET` | `/api/v1/properties/my` | Get landlord's properties | Landlord |
| `GET` | `/api/v1/properties/:id` | Get property details | All |
| `POST` | `/api/v1/verification/submit` | Submit property for verification | Landlord |
| `GET` | `/api/v1/verification/status` | Check verification status | Landlord |
| `GET` | `/api/v1/verification/pending` | Get pending verifications | Admin |
| `PUT` | `/api/v1/verification/:id/review` | Approve/reject verification | Admin |
| `GET` | `/api/v1/verification/:id` | Get verification details | Admin |

---

