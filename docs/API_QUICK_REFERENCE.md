# API Quick Reference

Quick lookup for common API integration tasks.

## Configuration

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001        # Backend URL
NEXT_PUBLIC_API_TIMEOUT=30000                    # Timeout in ms
NEXT_PUBLIC_MOCK_MODE=true                       # true=mock, false=real
NEXT_PUBLIC_DEBUG_MODE=false                     # Enable console logs
```

## Common Tasks

### Fetch Properties List

```typescript
import { fetchProperties } from '@/services/api'

const properties = await fetchProperties({
  neighborhood: 'Bole',
  minPrice: 5000,
  maxPrice: 20000,
  beds: 2,
  verifiedOnly: true,
})
```

### Fetch Single Property

```typescript
import { fetchProperty } from '@/services/api'

const property = await fetchProperty('prop-123')
if (!property) {
  console.log('Property not found')
}
```

### Submit Property Listing

```typescript
import { submitPropertyListing } from '@/services/api'

const result = await submitPropertyListing({
  title: 'Modern Apartment',
  neighborhood: 'Bole',
  address: '123 Main St',
  propertyType: 'apartment',
  beds: 2,
  baths: 1,
  sizeSqm: 80,
  priceEtb: 10000,
  depositEtb: 5000,
  amenities: ['WiFi', 'Parking'],
  description: 'Beautiful 2-bedroom apartment',
  photoUrls: ['https://example.com/photo1.jpg'],
  ownershipDocUrl: 'https://example.com/doc.pdf',
  landlordIdDocUrl: 'https://example.com/id.pdf',
})

console.log(result.id) // Listing ID
console.log(result.status) // 'pending' | 'under_review' | 'verified' | 'suspended'
```

### Request Property Viewing

```typescript
import { submitViewingRequest } from '@/services/api'

const viewing = await submitViewingRequest({
  propertyId: 'prop-123',
  preferredDate: '2024-12-15',
  preferredTime: '14:00',
  note: 'Flexible timing',
})
```

### Submit Rental Application

```typescript
import { submitApplication } from '@/services/api'

const app = await submitApplication({
  propertyId: 'prop-123',
  fullName: 'John Doe',
  phone: '+251911234567',
  email: 'john@example.com',
  employmentStatus: 'employed',
  monthlyIncomeEtb: 50000,
  moveInDate: '2024-12-20',
  note: 'Ready immediately',
})
```

### Submit Maintenance Request

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

### Report Fraud

```typescript
import { submitFraudReport } from '@/services/api'

const report = await submitFraudReport({
  propertyId: 'prop-123',
  reason: 'fake_photos',
  details: 'Photos do not match actual property',
  reporterEmail: 'reporter@example.com',
})
```

### File Dispute

```typescript
import { submitDispute } from '@/services/api'

const dispute = await submitDispute({
  propertyId: 'prop-123',
  category: 'deposit',
  description: 'Landlord refusing to return deposit',
})
```

## Error Handling

### Basic Error Handling

```typescript
try {
  const property = await fetchProperty('prop-123')
} catch (error) {
  if (error instanceof Error) {
    console.error('Failed:', error.message)
  }
}
```

### Type-Safe Error Handling

```typescript
import { type ApiError } from '@/lib/http-client'

try {
  const response = await get<Property>('/api/properties/123')
} catch (err: unknown) {
  const error = err as ApiError
  
  if (error.status === 404) {
    console.log('Not found')
  } else if (error.status === 401) {
    console.log('Unauthorized')
  } else if (error.status >= 500) {
    console.log('Server error')
  }
}
```

## Using HTTP Client Directly

### GET Request

```typescript
import { get } from '@/lib/http-client'

const response = await get<Property[]>('/api/properties')
console.log(response.data)
console.log(response.status)
```

### POST Request

```typescript
import { post } from '@/lib/http-client'

const response = await post<ResponseType>('/api/endpoint', {
  key: 'value',
})
```

### With Custom Headers

```typescript
import { request } from '@/lib/http-client'

const response = await request<T>('/api/endpoint', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: { /* ... */ },
  timeout: 5000,
  retries: 3,
})
```

## In React Components

### With useState

```typescript
'use client'

import { useState, useEffect } from 'react'
import { fetchProperties } from '@/services/api'
import type { Property } from '@/lib/properties'

export default function PropertyList() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProperties()
      .then(setProperties)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {properties.map((prop) => (
        <div key={prop.id}>{prop.title}</div>
      ))}
    </div>
  )
}
```

### With Async Server Component

```typescript
import { fetchProperties } from '@/services/api'

export default async function PropertyListPage() {
  const properties = await fetchProperties({
    neighborhood: 'Bole',
    verifiedOnly: true,
  })

  return (
    <div>
      {properties.map((prop) => (
        <div key={prop.id}>{prop.title}</div>
      ))}
    </div>
  )
}
```

### With Form Submission

```typescript
'use client'

import { useActionState } from 'react'
import { submitApplication } from '@/services/api'
import type { ApplicationInput } from '@/services/api'

export default function ApplicationForm() {
  const [error, setError] = useActionState(async (formData: FormData) => {
    try {
      const input: ApplicationInput = {
        propertyId: formData.get('propertyId') as string,
        fullName: formData.get('fullName') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
        employmentStatus: formData.get('employmentStatus') as any,
        monthlyIncomeEtb: parseInt(formData.get('monthlyIncome') as string),
        moveInDate: formData.get('moveInDate') as string,
      }
      
      const result = await submitApplication(input)
      console.log('Application submitted:', result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    }
  }, null)

  return (
    <form action={submitApplication}>
      {/* form fields */}
      {error && <div className="error">{error}</div>}
    </form>
  )
}
```

## Debugging

### Enable Debug Logging

```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
```

Then check browser console (F12) for logs like:
```
[HTTP Client] GET /api/properties {...}
[HTTP Client] GET /api/properties ✓ Status: 200 [...]
```

### Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Make API request
4. Click on request to see:
   - Request headers
   - Request body
   - Response headers
   - Response body

### Test Different Scenarios

```typescript
// Mock mode - instant response
NEXT_PUBLIC_MOCK_MODE=true

// Real API - connects to backend
NEXT_PUBLIC_MOCK_MODE=false

// With slow network - increase timeout
NEXT_PUBLIC_API_TIMEOUT=60000

// With detailed logs
NEXT_PUBLIC_DEBUG_MODE=true
```

## API Endpoints

All endpoints stored in `lib/api-config.ts`:

```typescript
import { API_ENDPOINTS } from '@/lib/api-config'

// Use in custom requests
const response = await get<Property[]>(API_ENDPOINTS.PROPERTIES)
const response = await get<Property>(API_ENDPOINTS.PROPERTY_DETAIL('prop-123'))
```

## Common Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Data returned in response |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request body format |
| 401 | Unauthorized | User needs to login |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Backend error - will retry |
| 503 | Unavailable | Backend down - will retry |

## Performance Tips

- ✅ Use `NEXT_PUBLIC_MOCK_MODE=true` during development
- ✅ Cache responses with Next.js fetch caching
- ✅ Use server components for initial data fetch
- ✅ Paginate large lists
- ✅ Add loading skeletons while fetching
- ✅ Debounce search queries
- ❌ Don't make API calls in render functions
- ❌ Don't fetch same data multiple times

## Migration Path

1. **Develop with Mock**
   ```bash
   NEXT_PUBLIC_MOCK_MODE=true
   ```

2. **Ready for Backend**
   ```bash
   NEXT_PUBLIC_MOCK_MODE=false
   NEXT_PUBLIC_API_URL=https://api.homelink.et
   ```

3. **Zero Code Changes** - Everything works!

## Need Help?

- Full guide: `docs/API_INTEGRATION.md`
- HTTP client docs: `lib/http-client.ts` (comments)
- API service docs: `services/api.ts` (comments)
- Endpoints: `lib/api-config.ts`
- Environment: `.env.example`
