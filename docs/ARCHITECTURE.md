# API Integration Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       React Components                              │
│  (Pages, Forms, Data Display Components)                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ import { fetchProperties, ... }
                                 │ from '@/services/api'
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        API Service Layer                            │
│                     (services/api.ts - ~300 lines)                 │
│                                                                     │
│  Functions:                                                         │
│  • fetchProperties()                                               │
│  • submitApplication()                                             │
│  • submitPropertyListing()                                         │
│  • submitViewingRequest()                                          │
│  • submitMaintenanceRequest()                                      │
│  • submitFraudReport()                                             │
│  • submitDispute()                                                 │
│  And more...                                                        │
│                                                                     │
│  Each function:                                                     │
│  ✓ Checks NEXT_PUBLIC_MOCK_MODE environment variable              │
│  ✓ Calls real API if mode = false                                  │
│  ✓ Uses mock data if mode = true                                   │
│  ✓ Falls back to mock if real API fails                            │
└────┬─────────────────────────────────┬─────────────────────────────┘
     │                                 │
     │                                 │
MOCK_MODE=true              MOCK_MODE=false
     │                                 │
     ↓                                 ↓
┌──────────────────┐      ┌───────────────────────────┐
│  Mock Data       │      │  HTTP Client Layer        │
│  (Test Data)     │      │  (lib/http-client.ts)     │
│                  │      │                           │
│ lib/properties.ts│      │ Functions:                │
│                  │      │ • get<T>()                │
│ Instant          │      │ • post<T>()               │
│ responses        │      │ • put<T>()                │
│ No network       │      │ • patch<T>()              │
│ No backend       │      │ • del<T>()                │
│ needed           │      │ • request<T>()            │
│                  │      │                           │
│                  │      │ Features:                 │
│                  │      │ ✓ Retry logic (3x)        │
│                  │      │ ✓ Exponential backoff     │
│                  │      │ ✓ Timeout (30s default)   │
│                  │      │ ✓ Error handling          │
│                  │      │ ✓ Debug logging           │
│                  │      │ ✓ Type-safe generics      │
└──────────────────┘      └──────────┬────────────────┘
                                     │
                           import { get, post } from
                           '@/lib/http-client'
                                     │
                                     ↓
                        ┌─────────────────────────┐
                        │   Backend API Server    │
                        │  NEXT_PUBLIC_API_URL    │
                        │ (e.g., localhost:3001)  │
                        │                         │
                        │ Endpoints:              │
                        │ • GET /api/properties   │
                        │ • POST /api/applications
                        │ • POST /api/maintenance │
                        │ • And 20+ more...       │
                        │                         │
                        │ From: lib/api-config.ts │
                        └─────────────────────────┘
```

## Data Flow Example

### Scenario: Fetching Properties

```
User Component
    ↓
await fetchProperties({ beds: 2, neighborhood: 'Bole' })
    ↓
services/api.ts
    ├─ Check: NEXT_PUBLIC_MOCK_MODE
    │
    ├─ If TRUE (mock):
    │   ├─ Filter PROPERTIES from lib/properties.ts
    │   ├─ Add delay(400ms) for realistic latency
    │   └─ Return mock data
    │
    └─ If FALSE (real):
        ├─ Call get<Property[]>('/api/properties?beds=2&neighborhood=Bole')
        │
        ├─ lib/http-client.ts
        │   ├─ Create fetch request
        │   ├─ Set timeout (30s)
        │   ├─ Set headers
        │   ├─ Execute fetch
        │   │
        │   ├─ If success:
        │   │   └─ Parse JSON & return
        │   │
        │   └─ If error:
        │       ├─ Log error
        │       ├─ Retry (up to 3x)
        │       ├─ Exponential backoff
        │       └─ Throw error if all retries fail
        │
        └─ If API error caught:
            ├─ Log error
            ├─ Fall back to mock data
            └─ Return mock data (graceful fallback)
    ↓
Return properties array to component
```

## Component Integration Example

```typescript
// page.tsx or component.tsx

import { fetchProperties } from '@/services/api'

// Server Component (Next.js 13+)
export default async function PropertyListPage() {
  try {
    const properties = await fetchProperties({
      neighborhood: 'Bole',
      beds: 2,
      verifiedOnly: true,
    })
    
    return (
      <div>
        {properties.map(prop => (
          <PropertyCard key={prop.id} property={prop} />
        ))}
      </div>
    )
  } catch (error) {
    return <ErrorMessage error={error} />
  }
}

// Client Component
'use client'

import { useState, useEffect } from 'react'
import { fetchProperties } from '@/services/api'

export function PropertyList() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProperties()
      .then(setProperties)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />
  if (error) return <ErrorMessage error={error} />
  
  return (
    <div>
      {properties.map(prop => (
        <PropertyCard key={prop.id} property={prop} />
      ))}
    </div>
  )
}
```

## Configuration & Environment

```
┌─────────────────────────────────────────┐
│        Environment Variables            │
│          (.env.local)                   │
└─────────────────────────────────────────┘
          │
          ├─ NEXT_PUBLIC_API_URL
          │  Default: http://localhost:3001
          │  Used by: HTTP client
          │
          ├─ NEXT_PUBLIC_API_TIMEOUT
          │  Default: 30000 (30 seconds)
          │  Used by: HTTP client
          │
          ├─ NEXT_PUBLIC_MOCK_MODE
          │  Default: true
          │  Used by: API service
          │  Effect: Routes between mock/real API
          │
          └─ NEXT_PUBLIC_DEBUG_MODE
             Default: false
             Used by: HTTP client
             Effect: Enables console logging
```

## API Endpoints Organization

```
lib/api-config.ts
├─ Properties
│  ├─ GET /api/properties
│  ├─ GET /api/properties/:id
│  ├─ POST /api/properties/submit
│  └─ PATCH /api/properties/:id/verify
│
├─ Viewings
│  ├─ POST /api/viewings/request
│  └─ PATCH /api/viewings/:id
│
├─ Applications
│  ├─ POST /api/applications/submit
│  └─ GET /api/applications/:id
│
├─ Maintenance
│  ├─ POST /api/maintenance/request
│  ├─ GET /api/maintenance/:id
│  └─ PATCH /api/maintenance/:id
│
├─ Fraud Reports
│  ├─ POST /api/fraud/report
│  └─ GET /api/fraud/reports/:id
│
├─ Disputes
│  ├─ POST /api/disputes/submit
│  └─ GET /api/disputes/:id
│
├─ Authentication (if using API auth)
│  ├─ POST /api/auth/login
│  ├─ POST /api/auth/signup
│  ├─ POST /api/auth/logout
│  └─ POST /api/auth/refresh
│
├─ User Profile
│  ├─ GET /api/users/profile
│  ├─ PUT /api/users/profile
│  └─ POST /api/users/password
│
└─ Admin
   ├─ GET /api/admin/dashboard
   ├─ GET /api/admin/queue
   ├─ GET /api/admin/disputes
   ├─ GET /api/admin/fraud-reports
   └─ GET /api/admin/market-insights
```

## Error Handling Flow

```
API Request
    │
    ├─ Success (2xx)
    │   └─ Parse JSON → Return response
    │
    └─ Error
        │
        ├─ 4xx (Client Error)
        │   └─ Throw error (don't retry)
        │       Client error, no retry needed
        │
        ├─ 5xx (Server Error)
        │   ├─ Retry? (≤ 3x)
        │   │   ├─ Yes: Retry with backoff
        │   │   └─ No: Continue
        │   └─ Throw error if all retries fail
        │
        ├─ Timeout
        │   ├─ Retry? (≤ 3x)
        │   │   ├─ Yes: Retry with backoff
        │   │   └─ No: Continue
        │   └─ Throw error if all retries fail
        │
        └─ Network Error
            ├─ Retry? (≤ 3x)
            │   ├─ Yes: Retry with backoff
            │   └─ No: Continue
            └─ Throw error if all retries fail
                │
                ├─ In API Service
                │   └─ Fall back to mock data
                │
                └─ In Component
                    ├─ Catch error
                    ├─ Show error message
                    └─ Handle gracefully
```

## Retry Logic with Exponential Backoff

```
Request fails
    │
    ├─ Attempt 1: Fail
    │   └─ Wait 1s (2^0 * 1000ms)
    │
    ├─ Attempt 2: Fail
    │   └─ Wait 2s (2^1 * 1000ms)
    │
    ├─ Attempt 3: Fail
    │   └─ Wait 4s (2^2 * 1000ms)
    │
    └─ All retries exhausted
        └─ Throw error
```

## File Structure

```
homelink-ethiopia/
├─ lib/
│  ├─ http-client.ts      ← HTTP client (retry, timeout, logging)
│  ├─ api-config.ts       ← Endpoints & configuration
│  └─ properties.ts       ← Mock data
│
├─ services/
│  └─ api.ts              ← Business logic (mock/real switching)
│
├─ docs/
│  ├─ API_INTEGRATION.md  ← Complete guide
│  ├─ API_QUICK_REFERENCE.md ← Quick reference
│  └─ ARCHITECTURE.md     ← This file
│
├─ .env.example           ← Template
└─ .env.local             ← Configuration
```

## Switching Between Mock and Real API

```
Development
├─ Set NEXT_PUBLIC_MOCK_MODE=true
├─ Uses local data
├─ No backend needed
└─ Test UI only

                    ↓ Deploy Backend ↓

Production
├─ Set NEXT_PUBLIC_MOCK_MODE=false
├─ Set NEXT_PUBLIC_API_URL=https://api.homelink.et
├─ Makes real requests
├─ Falls back to mock if offline
└─ Full feature testing

Important: NO CODE CHANGES NEEDED!
```

## Type Safety Flow

```
Component
    ↓ (typed)
import { fetchProperties } from '@/services/api'
    ↓ (typed return)
Promise<Property[]>
    ↓ (typed params)
const properties: Property[] = await fetchProperties()
    ↓ (typed access)
properties.map(p => <div>{p.title}</div>)
    ↓
Full type safety from component to backend!
```

## Performance Characteristics

```
Mock Mode
├─ First response: ~400-600ms (simulated delay)
├─ No network I/O
├─ No backend needed
└─ CPU: Minimal

Real API Mode
├─ First response: ~50-200ms (network dependent)
├─ Network I/O: Yes
├─ Backend required
└─ CPU: Low (async)

With Debug Logging
├─ Console output: Yes
├─ Performance impact: Minimal
└─ Useful for: Debugging
```

## Security Considerations

```
✓ No sensitive data in URLs (use request body)
✓ CORS headers validated by browser
✓ No credentials stored in code
✓ Environment variables for configuration
✓ Error messages don't expose internals
✓ Timeout prevents DoS
✓ Retry logic prevents hammering
✓ Type-safe prevents injection
```

## Testing Strategies

```
Unit Testing
├─ Test HTTP client methods
├─ Mock fetch with jest
└─ Verify retry logic

Integration Testing
├─ Test API service functions
├─ Mock HTTP client
└─ Verify fallback behavior

E2E Testing
├─ Mock mode first
├─ Real API mode second
└─ Error scenario testing

Local Development
├─ Mock mode enabled
├─ No backend needed
└─ Rapid iteration
```

## Next Steps

1. **Review:** Read `docs/API_INTEGRATION.md` for complete guide
2. **Setup:** Configure `.env.local` with your API URL
3. **Test:** Try mock mode first (NEXT_PUBLIC_MOCK_MODE=true)
4. **Integrate:** Use API functions in components
5. **Deploy:** Switch to real API for production

---

For more information:
- 📖 Complete guide: `docs/API_INTEGRATION.md`
- ⚡ Quick reference: `docs/API_QUICK_REFERENCE.md`
- 🚀 Setup details: `API_SETUP_COMPLETE.md`
