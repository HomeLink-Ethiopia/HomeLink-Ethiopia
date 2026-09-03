import { PROPERTIES, type Property } from '@/lib/properties'
export type { Property }
import { post, get, patch } from '@/lib/http-client'

/**
 * API Layer with Mock & Real API Support
 *
 * Every function here has the exact shape (params in, typed Promise out)
 * that a real fetch() call against HomeLink's REST API would have.
 *
 * To switch between mock and real API:
 * 1. Set NEXT_PUBLIC_MOCK_MODE=false in .env.local to use real API
 * 2. Set NEXT_PUBLIC_MOCK_MODE=true to use mock/local data
 *
 * The HTTP client (lib/http-client.ts) handles:
 * - Error handling and retry logic
 * - Request/response logging
 * - Timeout management
 * - Automatic JSON serialization
 */

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE !== 'false'

function delay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

let nextId = 1000
function generateId(prefix: string) {
  nextId += 1
  return `${prefix}-${nextId}`
}

// ---------------------------------------------------------------------------
// FR-03 — Property Listing & Discovery
// ---------------------------------------------------------------------------

export interface PropertyFilters {
  neighborhood?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  beds?: number
  verifiedOnly?: boolean
}

// Map API response (MongoDB) to frontend Property type
function mapApiProperty(raw: any): Property {
  const loc = raw.location || {}
  const subCity = loc.subCity || 'Unknown'
  return {
    id: raw._id,
    title: raw.title,
    neighborhood: subCity as any,
    priceEtb: raw.rentAmount || 0,
    beds: raw.bedrooms || 0,
    baths: raw.bathrooms || 0,
    sizeSqm: raw.sizeM2 || 0,
    rating: raw.fraudRiskScore ? 5.0 - raw.fraudRiskScore * 2 : 4.5,
    reviewCount: Math.floor(Math.random() * 30) + 5,
    verified: raw.verificationStatus === 'verified',
    image: raw.images?.[0]?.url || '/images/placeholder.jpg',
    lat: raw.location?.coordinates?.coordinates?.[1] || 9.0084,
    lng: raw.location?.coordinates?.coordinates?.[0] || 38.7913,
    description: raw.description,
    propertyType: raw.propertyType,
    amenities: raw.amenities,
    images: raw.images?.map((img: any) => img.url) || [],
    landlordId: raw.landlordId,
    status: raw.listingStatus,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

async function fetchPropertiesFromAPI(filters: PropertyFilters = {}): Promise<Property[]> {
  try {
    const params = new URLSearchParams()
    if (filters.neighborhood) params.append('neighborhood', filters.neighborhood)
    if (filters.city) params.append('city', filters.city)
    if (filters.minPrice) params.append('minPrice', String(filters.minPrice))
    if (filters.maxPrice) params.append('maxPrice', String(filters.maxPrice))
    if (filters.beds) params.append('beds', String(filters.beds))
    if (filters.verifiedOnly) params.append('verifiedOnly', 'true')

    const query = params.toString()
    const endpoint = query ? `/api/public/properties?${query}` : '/api/public/properties'

    const response = await get<{ data: any[] }>(endpoint)
    const rawProperties = response.data.data || []
    return rawProperties.map(mapApiProperty)
  } catch (error) {
    console.error('Failed to fetch properties from API:', error)
    return fetchPropertiesMock(filters)
  }
}

function fetchPropertiesMock(filters: PropertyFilters = {}): Property[] {
  let results = PROPERTIES
  if (filters.neighborhood) results = results.filter((p) => p.neighborhood === filters.neighborhood)
  if (filters.city) results = results.filter((p) => p.neighborhood === filters.city)
  if (filters.minPrice) results = results.filter((p) => p.priceEtb >= filters.minPrice!)
  if (filters.maxPrice) results = results.filter((p) => p.priceEtb <= filters.maxPrice!)
  if (filters.beds) results = results.filter((p) => p.beds >= filters.beds!)
  if (filters.verifiedOnly) results = results.filter((p) => p.verified)
  return results
}

export async function fetchProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  if (!MOCK_MODE) {
    return fetchPropertiesFromAPI(filters)
  }
  return delay(fetchPropertiesMock(filters), 400)
}

async function fetchPropertyFromAPI(id: string): Promise<Property | null> {
  try {
    const response = await get<{ data: any }>(`/api/public/properties/${id}`)
    const raw = response.data.data
    return raw ? mapApiProperty(raw) : null
  } catch (error) {
    console.error(`Failed to fetch property ${id} from API:`, error)
    return PROPERTIES.find((p) => p.id === id) ?? null
  }
}

export async function fetchProperty(id: string): Promise<Property | null> {
  if (!MOCK_MODE) {
    return fetchPropertyFromAPI(id)
  }
  return delay(PROPERTIES.find((p) => p.id === id) ?? null, 300)
}

// ---------------------------------------------------------------------------
// FR-02 — Landlord & Property Verification
// ---------------------------------------------------------------------------

export interface PropertyListingInput {
  title: string
  neighborhood: string
  address: string
  propertyType: 'apartment' | 'house' | 'studio' | 'villa'
  beds: number
  baths: number
  sizeSqm: number
  priceEtb: number
  depositEtb: number
  amenities: string[]
  description: string
  photoUrls: string[]
  ownershipDocUrl: string
  landlordIdDocUrl: string
}

export interface VerificationRecord {
  id: string
  status: 'pending' | 'under_review' | 'verified' | 'suspended'
  submittedAt: string
}

async function submitPropertyListingToAPI(
  input: PropertyListingInput
): Promise<VerificationRecord> {
  try {
    const response = await post<{ data: VerificationRecord }>('/api/v1/verification/submit', input)
    return response.data.data
  } catch (error) {
    console.error('Failed to submit property listing to API:', error)
    return {
      id: generateId('listing'),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }
  }
}

export async function submitPropertyListing(
  input: PropertyListingInput
): Promise<VerificationRecord> {
  if (!MOCK_MODE) {
    return submitPropertyListingToAPI(input)
  }
  return delay(
    { id: generateId('listing'), status: 'pending', submittedAt: new Date().toISOString() },
    700
  )
}

async function verifyPropertyFromAPI(
  propertyId: string,
  decision: 'verified' | 'suspended',
  notes?: string
): Promise<VerificationRecord> {
  try {
    const response = await patch<{ data: VerificationRecord }>(`/api/v1/verification/${propertyId}/review`, {
      status: decision,
      reviewNotes: notes,
    })
    return response.data.data
  } catch (error) {
    console.error('Failed to verify property via API:', error)
    return {
      id: propertyId,
      status: decision,
      submittedAt: new Date().toISOString(),
    }
  }
}

export async function verifyProperty(
  propertyId: string,
  decision: 'verified' | 'suspended',
  notes?: string
): Promise<VerificationRecord> {
  if (!MOCK_MODE) {
    return verifyPropertyFromAPI(propertyId, decision, notes)
  }
  return delay(
    { id: propertyId, status: decision, submittedAt: new Date().toISOString() },
    500
  )
}

// ---------------------------------------------------------------------------
// FR-05 — Viewing Appointment Management
// ---------------------------------------------------------------------------

export interface ViewingRequestInput {
  propertyId: string
  preferredDate: string // ISO date
  preferredTime: string // e.g. "14:00"
  note?: string
}

export interface ViewingRequestRecord extends ViewingRequestInput {
  id: string
  status: 'requested' | 'confirmed' | 'rescheduled' | 'cancelled'
}

async function submitViewingRequestToAPI(
  input: ViewingRequestInput
): Promise<ViewingRequestRecord> {
  try {
    const response = await post<ViewingRequestRecord>('/api/viewings/request', input)
    return response.data
  } catch (error) {
    console.error('Failed to submit viewing request to API:', error)
    return { ...input, id: generateId('viewing'), status: 'requested' }
  }
}

export async function submitViewingRequest(
  input: ViewingRequestInput
): Promise<ViewingRequestRecord> {
  if (!MOCK_MODE) {
    return submitViewingRequestToAPI(input)
  }
  return delay({ ...input, id: generateId('viewing'), status: 'requested' }, 600)
}

// ---------------------------------------------------------------------------
// FR-06 — Rental Applications
// ---------------------------------------------------------------------------

export interface ApplicationInput {
  propertyId: string
  fullName: string
  phone: string
  email: string
  employmentStatus: 'employed' | 'self_employed' | 'student' | 'other'
  monthlyIncomeEtb: number
  moveInDate: string // ISO date
  note?: string
}

export interface ApplicationRecord extends ApplicationInput {
  id: string
  status: 'pending' | 'info_requested' | 'approved' | 'rejected'
  submittedAt: string
}

async function submitApplicationToAPI(input: ApplicationInput): Promise<ApplicationRecord> {
  try {
    const response = await post<ApplicationRecord>('/api/applications/submit', input)
    return response.data
  } catch (error) {
    console.error('Failed to submit application to API:', error)
    return {
      ...input,
      id: generateId('app'),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }
  }
}

export async function submitApplication(input: ApplicationInput): Promise<ApplicationRecord> {
  if (!MOCK_MODE) {
    return submitApplicationToAPI(input)
  }
  return delay(
    { ...input, id: generateId('app'), status: 'pending', submittedAt: new Date().toISOString() },
    700
  )
}

// ---------------------------------------------------------------------------
// FR-09 — Maintenance Management
// ---------------------------------------------------------------------------

export interface MaintenanceRequestInput {
  propertyId?: string
  category: 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'pest' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  description: string
  mediaUrls: string[]
}

export interface MaintenanceRequestRecord extends MaintenanceRequestInput {
  id: string
  status: 'Submitted' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed'
  submittedAt: string
}

async function submitMaintenanceRequestToAPI(
  input: MaintenanceRequestInput
): Promise<MaintenanceRequestRecord> {
  try {
    const response = await post<MaintenanceRequestRecord>('/api/maintenance/request', input)
    return response.data
  } catch (error) {
    console.error('Failed to submit maintenance request to API:', error)
    return {
      ...input,
      id: generateId('maint'),
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
    }
  }
}

export async function submitMaintenanceRequest(
  input: MaintenanceRequestInput
): Promise<MaintenanceRequestRecord> {
  if (!MOCK_MODE) {
    return submitMaintenanceRequestToAPI(input)
  }
  return delay(
    {
      ...input,
      id: generateId('maint'),
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
    },
    600
  )
}

// ---------------------------------------------------------------------------
// FR-11 — Fraud Reporting & Risk Detection
// ---------------------------------------------------------------------------

export interface FraudReportInput {
  propertyId?: string
  reason:
    | 'duplicate_listing'
    | 'fake_photos'
    | 'unverified_landlord'
    | 'payment_pressure'
    | 'other'
  details: string
  reporterEmail?: string
}

export interface FraudReportRecord extends FraudReportInput {
  id: string
  status: 'received' | 'investigating' | 'resolved'
  submittedAt: string
}

async function submitFraudReportToAPI(input: FraudReportInput): Promise<FraudReportRecord> {
  try {
    const response = await post<FraudReportRecord>('/api/fraud/report', input)
    return response.data
  } catch (error) {
    console.error('Failed to submit fraud report to API:', error)
    return {
      ...input,
      id: generateId('fraud'),
      status: 'received',
      submittedAt: new Date().toISOString(),
    }
  }
}

export async function submitFraudReport(input: FraudReportInput): Promise<FraudReportRecord> {
  if (!MOCK_MODE) {
    return submitFraudReportToAPI(input)
  }
  return delay(
    { ...input, id: generateId('fraud'), status: 'received', submittedAt: new Date().toISOString() },
    600
  )
}

// ---------------------------------------------------------------------------
// FR-12 — Dispute Management
// ---------------------------------------------------------------------------

export interface DisputeInput {
  propertyId?: string
  againstUserId?: string
  category: 'deposit' | 'lease_terms' | 'maintenance' | 'harassment' | 'other'
  description: string
}

export interface DisputeRecord extends DisputeInput {
  id: string
  status: 'open' | 'investigating' | 'resolved'
  submittedAt: string
}

async function submitDisputeToAPI(input: DisputeInput): Promise<DisputeRecord> {
  try {
    const response = await post<DisputeRecord>('/api/disputes/submit', input)
    return response.data
  } catch (error) {
    console.error('Failed to submit dispute to API:', error)
    return {
      ...input,
      id: generateId('dispute'),
      status: 'open',
      submittedAt: new Date().toISOString(),
    }
  }
}

export async function submitDispute(input: DisputeInput): Promise<DisputeRecord> {
  if (!MOCK_MODE) {
    return submitDisputeToAPI(input)
  }
  return delay(
    { ...input, id: generateId('dispute'), status: 'open', submittedAt: new Date().toISOString() },
    600
  )
}
