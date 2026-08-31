# API Integration Guide

This document describes HomeLink's API integration layer and how to use it for backend communication.

## Overview

The API integration is built with two layers:

1. **HTTP Client** (`lib/http-client.ts`) - Low-level fetch wrapper with error handling, retries, and logging
2. **API Service** (`services/api.ts`) - Business logic layer with mock/real API support

### Key Features

- ✅ Mock mode for development (can be toggled via environment variable)
- ✅ Real API support with graceful fallback to mock data
- ✅ Automatic retry logic with exponential backoff
- ✅ Request/response logging for debugging
- ✅ Timeout management
- ✅ Type-safe API calls
- ✅ Centralized error handling

## Configuration

### Environment Variables

Set these in `.env.local`:

```bash
# API Base URL (defaults to http://localhost:3001)
NEXT_PUBLIC_API_URL=http://localhost:3001

# Request timeout in milliseconds (defaults to 30000)
NEXT_PUBLIC_API_TIMEOUT=30000

# Enable mock mode (true = mock, false = real API)
NEXT_PUBLIC_MOCK_MODE=true

# Enable debug logging
NEXT_PUBLIC_DEBUG_MODE=false
```

### Quick Start

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update API endpoint if needed:
   ```bash
   NEXT_PUBLIC_API_URL=https://api.homelink.et
   ```

3. Toggle mock mode:
   ```bash
   NEXT_PUBLIC_MOCK_MODE=false  # Use real API
   ```

## Using the HTTP Client

The HTTP client (`lib/http-client.ts`) provides low-level HTTP methods:

### Basic Usage

```typescript
import { get, post, put, patch, del } from '@/lib/http-client'

// GET request
const response = await get<Property[]>('/api/properties')
const properties = response.data

// POST request with body
const response = await post<VerificationRecord>('/api/properties/submit', {
  title: 'New Apartment',
  neighborhood: 'Bole',
  // ... other fields
})

// PUT request
const response = await put<Property>(`/api/properties/${id}`, {
  title: 'Updated Title',
})

// PATCH request (partial update)
const response = await patch<Property>(`/api/properties/${id}`, {
  title: 'New Title',
})

// DELETE request
const response = await del('/api/properties/123')
```

### Advanced Configuration

```typescript
import { request } from '@/lib/http-client'

const response = await request<Property>('/api/properties/123', {
  method: 'GET',
  timeout: 10000, // Custom timeout
  retries: 5, // Custom retry count
  headers: {
    'Authorization': 'Bearer token',
  },
})
```

## Using the API Service

The API service (`services/api.ts`) provides business logic functions that handle both mock and real API:

### Property Management

```typescript
import {
  fetchProperties,
  fetchProperty,
  submitPropertyListing,
  verifyProperty,
} from '@/services/api'

// Fetch properties with filters
const properties = await fetchProperties({
  neighborhood: 'Bole',
  minPrice: 5000,
  maxPrice: 15000,
  beds: 2,
  verifiedOnly: true,
})

// Fetch single property
const property = await fetchProperty('prop-123')

// Submit property listing
const listing = await submitPropertyListing({
  title: 'Modern Apartment',
  neighborhood: 'Bole',
  address: '123 Main Street',
  propertyType: 'apartment',
  beds: 2,
  baths: 1,
  sizeSqm: 80,
  priceEtb: 10000,
  depositEtb: 5000,
  amenities: ['WiFi', 'Parking'],
  description: 'Spacious apartment',
  photoUrls: ['https://example.com/photo1.jpg'],
  ownershipDocUrl: 'https://example.com/doc.pdf',
  landlordIdDocUrl: 'https://example.com/id.pdf',
})

// Verify/reject property (admin)
const verification = await verifyProperty('prop-123', 'verified', 'Looks good')
```

### Viewing Requests

```typescript
import { submitViewingRequest } from '@/services/api'

const viewing = await submitViewingRequest({
  propertyId: 'prop-123',
  preferredDate: '2024-12-15',
  preferredTime: '14:00',
  note: 'Flexible on time',
})
```

### Applications

```typescript
import { submitApplication } from '@/services/api'

const application = await submitApplication({
  propertyId: 'prop-123',
  fullName: 'John Doe',
  phone: '+251911234567',
  email: 'john@example.com',
  employmentStatus: 'employed',
  monthlyIncomeEtb: 50000,
  moveInDate: '2024-12-20',
  note: 'Ready to move in immediately',
})
```

### Maintenance Requests

```typescript
import { submitMaintenanceRequest } from '@/services/api'

const maintenance = await submitMaintenanceRequest({
  propertyId: 'prop-123',
  category: 'plumbing',
  priority: 'high',
  description: 'Leaking tap in bathroom',
  mediaUrls: ['https://example.com/leak.jpg'],
})
```

### Fraud Reporting

```typescript
import { submitFraudReport } from '@/services/api'

const report = await submitFraudReport({
  propertyId: 'prop-123',
  reason: 'fake_photos',
  details: 'Photos do not match the actual property',
  reporterEmail: 'reporter@example.com',
})
```

### Disputes

```typescript
import { submitDispute } from '@/services/api'

const dispute = await submitDispute({
  propertyId: 'prop-123',
  category: 'deposit',
  description: 'Landlord refusing to return deposit',
})
```

## API Endpoints Reference

See `lib/api-config.ts` for all endpoint constants:

```typescript
import { API_ENDPOINTS } from '@/lib/api-config'

// Use endpoints in custom requests
const response = await get<Property[]>(API_ENDPOINTS.PROPERTIES)
const response = await get<Property>(API_ENDPOINTS.PROPERTY_DETAIL('prop-123'))
```

## Error Handling

### In Components/Pages

```typescript
import { type ApiError } from '@/lib/http-client'

try {
  const result = await fetchProperty('prop-123')
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      console.log('Request timed out')
    } else {
      console.log('Request failed:', error.message)
    }
  }
}
```

### With Proper Typing

```typescript
import { type ApiError } from '@/lib/http-client'

try {
  const response = await get<Property>('/api/properties/123')
  console.log(response.data)
} catch (err: unknown) {
  const error = err as ApiError
  if (error.status === 404) {
    console.log('Property not found')
  } else if (error.status === 401) {
    console.log('Unauthorized - redirect to login')
  } else {
    console.log('Error:', error.message)
  }
}
```

## Mock Mode vs Real API

### Development with Mock Mode

```bash
# .env.local
NEXT_PUBLIC_MOCK_MODE=true
```

- Uses local test data from `lib/properties.ts`
- Useful for UI development without backend
- Can test error handling with custom responses
- No network requests

### Production with Real API

```bash
# .env.local
NEXT_PUBLIC_MOCK_MODE=false
NEXT_PUBLIC_API_URL=https://api.homelink.et
```

- Makes real HTTP requests to backend
- Falls back to mock data if API request fails
- Production-ready error handling

## Debugging

### Enable Debug Logging

```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
```

This enables verbose logging in the browser console:

```
[HTTP Client] GET /api/properties {...}
[HTTP Client] GET /api/properties ✓ Status: 200 [...]
```

### Using Browser DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Watch real API requests in real-time
4. Check request/response headers and body

### Common Issues

**Timeout Errors**
- Increase `NEXT_PUBLIC_API_TIMEOUT`
- Check if backend is running
- Check network connectivity

**CORS Errors**
- Ensure backend has CORS enabled
- Check `NEXT_PUBLIC_API_URL` is correct
- Backend should include `Access-Control-*` headers

**401 Unauthorized**
- User session may have expired
- Check authentication token in localStorage
- Redirect to login page

## Migration Path: Mock → Real API

1. **Start with Mock Mode**
   - Develop UI with `NEXT_PUBLIC_MOCK_MODE=true`
   - Use local test data

2. **Ready for Backend**
   - Set `NEXT_PUBLIC_MOCK_MODE=false`
   - Update `NEXT_PUBLIC_API_URL` to backend endpoint
   - All API calls automatically use real endpoints

3. **Implementation**
   - Backend implements endpoints from `lib/api-config.ts`
   - API calls automatically switch to real data
   - No UI changes needed

## Adding New Endpoints

1. Add endpoint to `lib/api-config.ts`:

```typescript
export const API_ENDPOINTS = {
  // ... existing endpoints
  NEW_FEATURE: '/api/new-feature',
  NEW_FEATURE_DETAIL: (id: string) => `/api/new-feature/${id}`,
}
```

2. Add service function to `services/api.ts`:

```typescript
export async function getNewFeature(id: string): Promise<NewFeatureRecord> {
  if (!MOCK_MODE) {
    try {
      const response = await get<NewFeatureRecord>(API_ENDPOINTS.NEW_FEATURE_DETAIL(id))
      return response.data
    } catch (error) {
      console.error('Failed to fetch from API:', error)
      // Fall back to mock
    }
  }
  // Mock implementation
  return { id, name: 'Mock Feature' }
}
```

3. Use in components:

```typescript
const feature = await getNewFeature('feat-123')
```

## Best Practices

- ✅ Use typed responses with generics: `get<Property[]>(...)`
- ✅ Wrap API calls in try-catch blocks
- ✅ Display user-friendly error messages
- ✅ Use `NEXT_PUBLIC_DEBUG_MODE` during development
- ✅ Test with both mock and real API
- ✅ Add loading states while requests are pending
- ✅ Cache responses where appropriate
- ❌ Don't hardcode API URLs - use environment variables
- ❌ Don't expose sensitive data in error messages
- ❌ Don't make API calls in render functions - use effects

## Support

For questions or issues with API integration:

1. Check debug logs with `NEXT_PUBLIC_DEBUG_MODE=true`
2. Review Network tab in DevTools
3. Verify backend endpoints match `lib/api-config.ts`
4. Check environment variables in `.env.local`
