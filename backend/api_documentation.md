# 🏠 HOMELINK —  API DOCUMENTATION



---

## 📋 SPRINT SUMMARY

| Sprint | Features | Status |
|--------|----------|--------|
| **Sprint 1** | Foundation & System Architecture | ✅ Complete |
| **Sprint 2** | Authentication & Authorization | ✅ Complete |
| **Sprint 3** | Landlord & Property Verification | ✅ Complete |
| **Sprint 4** | Property Management & Image Upload | ✅ Complete |
| **Sprint 5** | Property Discovery & Favourites | ✅ Complete |
| **Sprint 6** | AI Matching & Recommendations | ✅ Complete |

---

## 📚 TABLE OF CONTENTS
1. [Authentication Endpoints](#authentication-endpoints)
2. [Property Management Endpoints](#property-management-endpoints)
3. [Image Upload Endpoints](#image-upload-endpoints)
4. [Property Discovery Endpoints](#property-discovery-endpoints)
5. [Favourites Endpoints](#favourites-endpoints)
6. [Tenant Preferences Endpoints](#tenant-preferences-endpoints)
7. [AI Recommendations Endpoints](#ai-recommendations-endpoints)
8. [Verification Endpoints](#verification-endpoints)
9. [Middleware Flow](#middleware-flow)
10. [Complete End-to-End Flow](#complete-end-to-end-flow)

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
  "email": "kidist@example.com",
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
    "email": "kidist@example.com",
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
  "email": "kidist@example.com",
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
  "email": "kidist@example.com"
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
  "email": "kidist@example.com",
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
    "email": "kidist@example.com",
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
  "email": "kidist@example.com"
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
  "email": "kidist@example.com",
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
  "email": "kidist@example.com",
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

## 🏠 PROPERTY MANAGEMENT ENDPOINTS

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

### 12. Update Property

**Endpoint:** `PUT /api/v1/properties/:id`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `updateProperty()` function
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
PUT /api/v1/properties/:id
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → propertyController.updateProperty()
   → Finds Property by :id
   → Finds LandlordProfile by accountId (req.user.id)
   → Checks if user owns this property
   → Updates Property with provided data
   → Returns updated property
```

**Sample Request:**
```json
PUT http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d
Authorization: Bearer LANDLORD_TOKEN
Content-Type: application/json

{
  "title": "Updated Luxury Apartment",
  "rentAmount": 30000,
  "listingStatus": "active"
}
```

**Sample Response:**
```json
{
  "message": "Property updated successfully",
  "data": {
    "_id": "6a80bcd5879d77f9fb72a50d",
    "title": "Updated Luxury Apartment",
    "rentAmount": 30000,
    "listingStatus": "active"
  }
}
```

---

### 13. Delete Property

**Endpoint:** `DELETE /api/v1/properties/:id`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `deleteProperty()` function
- `models/Property.js` → Property schema
- `models/LandlordProfile.js` → LandlordProfile schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
DELETE /api/v1/properties/:id
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → propertyController.deleteProperty()
   → Finds Property by :id
   → Finds LandlordProfile by accountId (req.user.id)
   → Checks if user owns this property
   → Deletes Property
   → Decrements verifiedPropertiesCount in LandlordProfile
   → Returns success response
```

**Sample Request:**
```json
DELETE http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d
Authorization: Bearer LANDLORD_TOKEN
```

**Sample Response:**
```json
{
  "message": "Property deleted successfully"
}
```

---

## 🖼️ IMAGE UPLOAD ENDPOINTS

---

### 14. Upload Property Images

**Endpoint:** `POST /api/v1/properties/:id/images`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `uploadPropertyImages()` function
- `middleware/upload.js` → Multer configuration
- `models/Property.js` → Property schema

**How It Works:**
```
POST /api/v1/properties/:id/images
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → upload.array('images', 10) processes files
   → propertyController.uploadPropertyImages()
   → Finds Property by :id
   → Checks if user owns this property
   → Processes uploaded images:
      - Saves files to /uploads folder
      - Creates image entries with URLs
      - First image becomes primary
   → Adds images to property.images array
   → Returns success response with image details
```

**Sample Request:**
```
POST http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d/images
Authorization: Bearer LANDLORD_TOKEN
Content-Type: multipart/form-data

Body (form-data):
  - images: [Select image files]
```

**Sample Response:**
```json
{
  "message": "2 image(s) uploaded successfully",
  "data": {
    "propertyId": "6a80bcd5879d77f9fb72a50d",
    "images": [
      {
        "key": "property-1697654321000-123456789.jpg",
        "url": "/uploads/property-1697654321000-123456789.jpg",
        "isPrimary": true,
        "uploadedAt": "2026-09-01T17:17:47.956Z",
        "_id": "6a9708bbd6998e948dc6206c"
      },
      {
        "key": "property-1697654322000-987654321.jpg",
        "url": "/uploads/property-1697654322000-987654321.jpg",
        "isPrimary": false,
        "uploadedAt": "2026-09-01T17:18:45.792Z",
        "_id": "6a9708f5d6998e948dc6206e"
      }
    ],
    "totalImages": 2
  }
}
```

---

### 15. Delete Property Image

**Endpoint:** `DELETE /api/v1/properties/:id/images/:imageId`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `deletePropertyImage()` function
- `models/Property.js` → Property schema

**How It Works:**
```
DELETE /api/v1/properties/:id/images/:imageId
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → propertyController.deletePropertyImage()
   → Finds Property by :id
   → Checks if user owns this property
   → Finds image by imageId
   → Removes image from property.images array
   → If primary image was deleted, sets new primary
   → Returns success response
```

**Sample Request:**
```json
DELETE http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d/images/6a9708f5d6998e948dc6206e
Authorization: Bearer LANDLORD_TOKEN
```

**Sample Response:**
```json
{
  "message": "Image deleted successfully",
  "data": {
    "propertyId": "6a80bcd5879d77f9fb72a50d",
    "images": [...],
    "totalImages": 1
  }
}
```

---

### 16. Set Primary Image

**Endpoint:** `PUT /api/v1/properties/:id/images/:imageId/primary`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `setPrimaryImage()` function
- `models/Property.js` → Property schema

**How It Works:**
```
PUT /api/v1/properties/:id/images/:imageId/primary
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "landlord" role
   → propertyController.setPrimaryImage()
   → Finds Property by :id
   → Checks if user owns this property
   → Finds image by imageId
   → Sets all images to isPrimary: false
   → Sets selected image to isPrimary: true
   → Returns success response
```

**Sample Request:**
```json
PUT http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d/images/6a9708f5d6998e948dc6206e/primary
Authorization: Bearer LANDLORD_TOKEN
```

**Sample Response:**
```json
{
  "message": "Primary image updated successfully",
  "data": {
    "propertyId": "6a80bcd5879d77f9fb72a50d",
    "primaryImage": "/uploads/property-1697654322000-987654321.jpg",
    "images": [...]
  }
}
```

---

## 🔍 PROPERTY DISCOVERY ENDPOINTS

---

### 17. Search Properties

**Endpoint:** `GET /api/v1/properties/search`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `searchProperties()` function
- `models/Property.js` → Property schema

**How It Works:**
```
GET /api/v1/properties/search
   → propertyController.searchProperties()
   → Extracts query parameters (city, price, type, bedrooms, etc.)
   → Builds MongoDB query with filters
   → Applies sorting based on sort parameter
   → Applies pagination (page, limit)
   → Returns matching properties with pagination metadata
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `city` | string | Filter by city |
| `subCity` | string | Filter by sub-city |
| `propertyType` | string | Filter by property type |
| `minPrice` | number | Minimum rent amount |
| `maxPrice` | number | Maximum rent amount |
| `bedrooms` | number | Filter by bedrooms |
| `bathrooms` | number | Filter by bathrooms |
| `furnished` | boolean | Filter by furnished status |
| `verifiedOnly` | boolean | Show only verified properties |
| `sort` | string | Sort order (price_low, price_high, newest) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10) |

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/search?city=Addis+Ababa&minPrice=10000&maxPrice=30000&propertyType=apartment&bedrooms=2&sort=newest&page=1&limit=10
Authorization: Bearer USER_TOKEN
```

**Sample Response:**
```json
{
  "data": [
    {
      "_id": "6a80bcd5879d77f9fb72a50d",
      "title": "Bole Luxury 2BR Apartment",
      "rentAmount": 25000,
      "location": {
        "city": "Addis Ababa",
        "subCity": "Bole"
      },
      "bedrooms": 2,
      "verificationStatus": "verified"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## ⭐ FAVOURITES ENDPOINTS

---

### 18. Favourite a Property

**Endpoint:** `POST /api/v1/properties/:id/favourite`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `favouriteProperty()` function
- `models/Favourite.js` → Favourite schema
- `models/Property.js` → Property schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
POST /api/v1/properties/:id/favourite
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.favouriteProperty()
   → Finds Property by :id
   → Checks if already favourited
   → Creates Favourite document
   → Increments favouriteCount on Property
   → Returns success response
```

**Sample Request:**
```json
POST http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d/favourite
Authorization: Bearer TENANT_TOKEN
```

**Sample Response:**
```json
{
  "message": "Property favourited successfully",
  "data": {
    "propertyId": "6a80bcd5879d77f9fb72a50d"
  }
}
```

---

### 19. Unfavourite a Property

**Endpoint:** `DELETE /api/v1/properties/:id/favourite`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `unfavouriteProperty()` function
- `models/Favourite.js` → Favourite schema
- `models/Property.js` → Property schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
DELETE /api/v1/properties/:id/favourite
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.unfavouriteProperty()
   → Finds and deletes Favourite document
   → Decrements favouriteCount on Property
   → Returns success response
```

**Sample Request:**
```json
DELETE http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d/favourite
Authorization: Bearer TENANT_TOKEN
```

**Sample Response:**
```json
{
  "message": "Property unfavourited successfully",
  "data": {
    "propertyId": "6a80bcd5879d77f9fb72a50d"
  }
}
```

---

### 20. Get My Favourites

**Endpoint:** `GET /api/v1/properties/favourites`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `getMyFavourites()` function
- `models/Favourite.js` → Favourite schema
- `models/Property.js` → Property schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/properties/favourites
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.getMyFavourites()
   → Finds all Favourites for this tenant
   → Populates property data
   → Returns list of favourited properties
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/favourites
Authorization: Bearer TENANT_TOKEN
```

**Sample Response:**
```json
{
  "data": [
    {
      "_id": "6a80bcd5879d77f9fb72a50d",
      "title": "Bole Luxury 2BR Apartment",
      "rentAmount": 25000,
      "location": {
        "city": "Addis Ababa",
        "subCity": "Bole"
      },
      "images": [...]
    }
  ],
  "total": 1
}
```

---

### 21. Check if Favourited

**Endpoint:** `GET /api/v1/properties/:id/favourite`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `isFavourited()` function
- `models/Favourite.js` → Favourite schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/properties/:id/favourite
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.isFavourited()
   → Checks if Favourite exists for this tenant and property
   → Returns boolean
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/6a80bcd5879d77f9fb72a50d/favourite
Authorization: Bearer TENANT_TOKEN
```

**Sample Response:**
```json
{
  "isFavourited": true
}
```

---

## 👤 TENANT PREFERENCES ENDPOINTS

---

### 22. Save Preferences

**Endpoint:** `POST /api/v1/properties/preferences`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `savePreferences()` function
- `models/TenantPreference.js` → TenantPreference schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
POST /api/v1/properties/preferences
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.savePreferences()
   → Validates required fields
   → Creates or updates TenantPreference document
   → Returns saved preferences
```

**Sample Request:**
```json
POST http://localhost:5000/api/v1/properties/preferences
Authorization: Bearer TENANT_TOKEN
Content-Type: application/json

{
  "budget": {
    "min": 10000,
    "max": 30000
  },
  "location": {
    "city": "Addis Ababa",
    "subCity": "Bole"
  },
  "propertyType": "apartment",
  "bedrooms": 2,
  "bathrooms": 1,
  "amenities": ["generator", "wifi", "security"],
  "furnished": true,
  "moveInDate": "2026-10-01"
}
```

**Sample Response:**
```json
{
  "message": "Preferences saved successfully",
  "data": {
    "_id": "...",
    "tenantId": "...",
    "budget": {
      "min": 10000,
      "max": 30000
    },
    "location": {
      "city": "Addis Ababa",
      "subCity": "Bole"
    },
    "propertyType": "apartment",
    "bedrooms": 2,
    "bathrooms": 1,
    "amenities": ["generator", "wifi", "security"],
    "furnished": true,
    "moveInDate": "2026-10-01T00:00:00.000Z",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 23. Get Preferences

**Endpoint:** `GET /api/v1/properties/preferences`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `getPreferences()` function
- `models/TenantPreference.js` → TenantPreference schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/properties/preferences
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.getPreferences()
   → Finds TenantPreference by tenantId
   → Returns preferences
```

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/preferences
Authorization: Bearer TENANT_TOKEN
```

**Sample Response:**
```json
{
  "data": {
    "_id": "...",
    "tenantId": "...",
    "budget": {
      "min": 10000,
      "max": 30000
    },
    "location": {
      "city": "Addis Ababa",
      "subCity": "Bole"
    },
    "propertyType": "apartment",
    "bedrooms": 2,
    "bathrooms": 1,
    "amenities": ["generator", "wifi", "security"],
    "furnished": true,
    "moveInDate": "2026-10-01T00:00:00.000Z",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 24. Update Preferences

**Endpoint:** `PUT /api/v1/properties/preferences`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `updatePreferences()` function
- `models/TenantPreference.js` → TenantPreference schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
PUT /api/v1/properties/preferences
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.updatePreferences()
   → Finds TenantPreference by tenantId
   → Updates provided fields
   → Returns updated preferences
```

**Sample Request:**
```json
PUT http://localhost:5000/api/v1/properties/preferences
Authorization: Bearer TENANT_TOKEN
Content-Type: application/json

{
  "budget": {
    "min": 15000,
    "max": 40000
  },
  "bedrooms": 3,
  "propertyType": "house"
}
```

**Sample Response:**
```json
{
  "message": "Preferences updated successfully",
  "data": {
    "_id": "...",
    "tenantId": "...",
    "budget": {
      "min": 15000,
      "max": 40000
    },
    "location": {
      "city": "Addis Ababa",
      "subCity": "Bole"
    },
    "propertyType": "house",
    "bedrooms": 3,
    "bathrooms": 1,
    "amenities": ["generator", "wifi", "security"],
    "furnished": true,
    "moveInDate": "2026-10-01T00:00:00.000Z",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

## 🤖 AI RECOMMENDATIONS ENDPOINTS

---

### 25. Get AI Recommendations

**Endpoint:** `GET /api/v1/properties/recommendations`

**Files Involved:**
- `routes/propertyRoutes.js` → Routes definition
- `controllers/propertyController.js` → `getRecommendations()` function
- `models/TenantPreference.js` → TenantPreference schema
- `models/Property.js` → Property schema
- `middleware/authMiddleware.js` → JWT verification
- `middleware/roleMiddleware.js` → Role-based access

**How It Works:**
```
GET /api/v1/properties/recommendations
   → authMiddleware verifies JWT token
   → roleMiddleware checks for "tenant" role
   → propertyController.getRecommendations()
   → Gets tenant preferences from database
   → Finds all active, verified properties
   → Calculates match score for each property:
      - Budget match (25%)
      - Location match (25%)
      - Property type match (15%)
      - Bedrooms match (15%)
      - Amenities match (10%)
      - Furnished match (5%)
      - Availability match (5%)
   → Sorts by match score (highest first)
   → Returns ranked properties with scores and reasons
```

**Match Score Breakdown:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Budget | 25% | How close property price matches tenant budget |
| Location | 25% | How close property is to preferred area |
| Property Type | 15% | Apartment/House/Room match |
| Bedrooms | 15% | Number of bedrooms match |
| Amenities | 10% | Generator, water_tank, wifi, etc. |
| Furnished | 5% | Furnished/unfurnished match |
| Availability | 5% | Available within tenant's move-in date |

**Sample Request:**
```json
GET http://localhost:5000/api/v1/properties/recommendations?page=1&limit=20
Authorization: Bearer TENANT_TOKEN
```

**Sample Response:**
```json
{
  "data": [
    {
      "_id": "6a80bcd5879d77f9fb72a50d",
      "title": "Bole Luxury 2BR Apartment",
      "rentAmount": 25000,
      "propertyType": "apartment",
      "location": {
        "city": "Addis Ababa",
        "subCity": "Bole"
      },
      "bedrooms": 2,
      "amenities": ["generator", "water_tank", "wifi", "security"],
      "furnished": true,
      "matchScore": 85,
      "matchReasons": [
        "✅ Within budget",
        "📍 Preferred city",
        "🏠 Preferred property type",
        "🛏️ Matches bedroom requirement",
        "🔧 100% of amenities matched",
        "🛋️ Furnished",
        "📅 Available for move-in date"
      ],
      "images": [...]
    },
    {
      "_id": "6a8361c9f21811ba3ef84796",
      "title": "My New Property",
      "rentAmount": 20000,
      "propertyType": "apartment",
      "location": {
        "city": "Addis Ababa",
        "subCity": "Bole"
      },
      "bedrooms": 2,
      "amenities": [],
      "furnished": false,
      "matchScore": 65,
      "matchReasons": [
        "✅ Within budget",
        "📍 Preferred city",
        "🏠 Preferred property type",
        "🛏️ Matches bedroom requirement"
      ],
      "images": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## 🔍 VERIFICATION ENDPOINTS

---

### 26. Submit Property for Verification

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

### 27. Get Verification Status

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

### 28. Get Pending Verifications (Admin)

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

### 29. Review Verification (Admin)

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

### 30. Get Verification Details (Admin)

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

4. upload (Multer - File Upload)
   ├─► Applied to image upload routes
   ├─► Handles multipart/form-data
   ├─► Validates file types (JPEG, PNG, GIF, WebP)
   ├─► Limits file size (5MB)
   └─► Saves files to /uploads folder
```

---

## 🔄 COMPLETE END-TO-END FLOW

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

STEP 4: UPGRADE TO LANDLORD
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

STEP 8: UPLOAD IMAGES
        └─► POST /api/v1/properties/:id/images
            └─► Images uploaded to property

STEP 9: TENANT SEARCHES
        └─► GET /api/v1/properties/search
            └─► Finds properties by location, price, type

STEP 10: TENANT FAVOURITES
        └─► POST /api/v1/properties/:id/favourite
            └─► Property saved to favourites

STEP 11: SET PREFERENCES
        └─► POST /api/v1/properties/preferences
            └─► Tenant sets budget, location, type, etc.

STEP 12: GET AI RECOMMENDATIONS
        └─► GET /api/v1/properties/recommendations
            └─► Returns ranked properties with match scores

PROPERTY IS VERIFIED ✅
        └─► Trust layer is active
        └─► Tenants can find, favourite, and get AI-matched properties
```

---

## 📊 API QUICK REFERENCE TABLE

### Authentication
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

### Property Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/properties` | Create new property | Landlord |
| `GET` | `/api/v1/properties/my` | Get landlord's properties | Landlord |
| `GET` | `/api/v1/properties/:id` | Get property details | All |
| `PUT` | `/api/v1/properties/:id` | Update property | Landlord |
| `DELETE` | `/api/v1/properties/:id` | Delete property | Landlord |

### Image Upload
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/properties/:id/images` | Upload images | Landlord |
| `DELETE` | `/api/v1/properties/:id/images/:imageId` | Delete image | Landlord |
| `PUT` | `/api/v1/properties/:id/images/:imageId/primary` | Set primary image | Landlord |

### Property Discovery
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/properties/search` | Search with filters | All |

### Favourites
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/properties/:id/favourite` | Favourite property | Tenant |
| `DELETE` | `/api/v1/properties/:id/favourite` | Unfavourite property | Tenant |
| `GET` | `/api/v1/properties/favourites` | Get my favourites | Tenant |
| `GET` | `/api/v1/properties/:id/favourite` | Check if favourited | Tenant |

### Tenant Preferences
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/properties/preferences` | Save preferences | Tenant |
| `GET` | `/api/v1/properties/preferences` | Get preferences | Tenant |
| `PUT` | `/api/v1/properties/preferences` | Update preferences | Tenant |

### AI Recommendations
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/properties/recommendations` | Get AI recommendations | Tenant |

### Verification
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/verification/submit` | Submit verification | Landlord |
| `GET` | `/api/v1/verification/status` | Check verification status | Landlord |
| `GET` | `/api/v1/verification/pending` | Get pending verifications | Admin |
| `PUT` | `/api/v1/verification/:id/review` | Review verification | Admin |
| `GET` | `/api/v1/verification/:id` | Get verification details | Admin |

---

## 📁 FILE STRUCTURE

```
backend/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── propertyController.js
│   │   └── verificationController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   ├── rateLimiter.js
│   │   └── upload.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Account.js
│   │   ├── LandlordProfile.js
│   │   ├── Property.js
│   │   ├── PropertyVerification.js
│   │   ├── Favourite.js
│   │   └── TenantPreference.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── propertyRoutes.js
│   │   └── verificationRoutes.js
│   ├── utils/
│   │   ├── response.js
│   │   └── emailService.js
│   └── validators/
│       └── authValidators.js
├── uploads/
├── server.js
└── .env
```

---

*This documentation covers all API endpoints from Sprint 1 through Sprint 6.* 