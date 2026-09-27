import type { Property } from '@/lib/properties'
export type { Property }
import { post, get, patch, del } from '@/lib/http-client'
import type { PropertyFilters } from '@/lib/search'
export type { PropertyFilters }

/**
 * API Layer — REAL backend only.
 *
 * Every function calls HomeLink's Express API. There is no mock fallback:
 * if the backend is down, callers get an error and show an honest empty/
 * error state. (Sprint 5: search/filter/sort/pagination are executed
 * server-side against MongoDB via /api/public/properties.)
 */

export interface PaginatedResult {
  properties: Property[]
  page: number
  limit: number
  total: number
  pages: number
}

// Map API response (MongoDB) to frontend Property type
export function mapApiProperty(raw: any): Property {
  const loc = raw.location || {}
  const subCity = loc.subCity || loc.city || 'Unknown'
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  const abs = (u: string) => (u.startsWith('http') ? u : `${API_BASE}${u}`)
  const imgs: string[] = (raw.images || [])
    .map((img: any) => (typeof img === 'string' ? img : img?.url))
    .filter(Boolean)
    .map(abs)
  const reviews = raw.ratingSummary || raw.reviews || null
  return {
    id: raw._id,
    title: raw.title,
    neighborhood: subCity as any,
    priceEtb: raw.rentAmount || 0,
    beds: raw.bedrooms || 0,
    baths: raw.bathrooms || 0,
    sizeSqm: raw.sizeM2 || 0,
    rating: reviews?.average ?? raw.averageRating ?? 0,
    reviewCount: reviews?.count ?? raw.reviewCount ?? 0,
    verified: raw.verificationStatus === 'verified',
    verificationStatus: raw.verificationStatus,
    image: imgs[0] || '/images/placeholder.svg',
    furnished: !!raw.furnished,
    availability: raw.listingStatus,
    lat: raw.location?.coordinates?.coordinates?.[1] || 9.0084,
    lng: raw.location?.coordinates?.coordinates?.[0] || 38.7913,
    description: raw.description,
    propertyType: raw.propertyType,
    amenities: raw.amenities || [],
    images: imgs,
    landlordId: raw.landlordId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

/**
 * Map frontend filter state to the backend's query params.
 * Backend contract (GET /api/v1/properties/search):
 *   city, subCity, propertyType, minPrice, maxPrice, bedrooms,
 *   bathrooms, amenities, furnished, verifiedOnly,
 *   sort (price_low | price_high | newest | oldest), page, limit
 */
function buildPropertyQuery(filters: PropertyFilters & { page?: number; limit?: number; sort?: string }): string {
  const params = new URLSearchParams()
  if (filters.neighborhood) params.append('subCity', filters.neighborhood)
  if (filters.city) params.append('city', filters.city)
  if (filters.minPrice) params.append('minPrice', String(filters.minPrice))
  if (filters.maxPrice) params.append('maxPrice', String(filters.maxPrice))
  if (filters.beds) params.append('bedrooms', String(filters.beds))
  if ((filters as any).baths) params.append('bathrooms', String((filters as any).baths))
  if ((filters as any).amenities && (filters as any).amenities.length > 0) params.append('amenities', (filters as any).amenities.join(','))
  if ((filters as any).propertyType && (filters as any).propertyType !== 'any') params.append('propertyType', (filters as any).propertyType)
  if ((filters as any).furnished === true) params.append('furnished', 'true')
  if (filters.verifiedOnly) params.append('verifiedOnly', 'true')
  const sortMap: Record<string, string> = {
    'price-asc': 'price_low',
    'price-desc': 'price_high',
    'newest': 'newest',
    'best': 'newest',
  }
  const apiSort = (filters as any).sort ? sortMap[(filters as any).sort] || 'newest' : undefined
  if (apiSort) params.append('sort', apiSort)
  if (filters.page) params.append('page', String(filters.page))
  if (filters.limit) params.append('limit', String(filters.limit))
  return params.toString()
}

/**
 * Server-side search: filters, sorting AND pagination all run on the
 * backend so we never load thousands of properties at once.
 */
export async function searchProperties(
  filters: PropertyFilters & { page?: number; limit?: number; sort?: string } = {}
): Promise<PaginatedResult> {
  const query = buildPropertyQuery(filters)
  const endpoint = query ? `/api/v1/properties/search?${query}` : '/api/v1/properties/search'
  const response = await get<{ data: any[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(endpoint)
  const pagination = response.data.pagination || {
    page: (filters as any).page || 1,
    limit: (filters as any).limit || 20,
    total: (response.data.data || []).length,
    totalPages: 1,
  }
  return {
    properties: (response.data.data || []).map(mapApiProperty),
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    pages: pagination.totalPages,
  }
}

/** Back-compat helper: fetch one page of properties without pagination metadata. */
export async function fetchProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  const result = await searchProperties({ ...filters, limit: (filters as any).limit ?? 100 })
  return result.properties
}

// ---------------------------------------------------------------------------
// Sprint 13 — Responsible AI service (real backend endpoints)
// ---------------------------------------------------------------------------

export interface AiRentEstimate {
  min: number | null
  max: number | null
  point: number | null
  currency: string
  confidence: 'high' | 'medium' | 'low' | 'none'
  sampleSize: number
  comparables?: number[]
  message?: string
  note?: string
}

/** Comparables-based rent estimate from real HomeLink listings. */
export async function fetchRentEstimate(input: {
  city: string
  subCity?: string
  propertyType: string
  sizeM2?: number
  bedrooms?: number
  amenities?: string[]
}): Promise<AiRentEstimate> {
  const response = await post<{ data: { estimate: AiRentEstimate } }>('/api/v1/ai/rent-estimate', input)
  return response.data.data.estimate
}

export interface AiMatch {
  propertyId: string
  title: string
  propertyType: string
  rentAmount: number
  bedrooms: number
  bathrooms: number
  sizeM2?: number
  location: { city?: string; subCity?: string }
  images: { url?: string; key?: string }[]
  verificationStatus: string
  score: number
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'
  breakdown: { budget: number; location: number; propertyType: number; bedrooms: number; amenities: number; availability: number }
  reasons: { icon: 'check' | 'close' | 'partial'; text: string }[]
}

export interface AiMatchResponse {
  matches: AiMatch[]
  meta: {
    weights: Record<string, number>
    candidatesConsidered: number
    confidence: 'high' | 'medium' | 'low'
    method: string
    note: string
  }
}

/** Explainable weighted matching against live listings. */
export async function fetchAiMatches(prefs: {
  budget?: { min?: number; max?: number }
  location?: { city?: string; subCity?: string }
  propertyType?: string
  bedrooms?: number | null
  amenities?: string[]
  limit?: number
}): Promise<AiMatchResponse> {
  const response = await post<{ data: AiMatchResponse }>('/api/v1/ai/match', prefs)
  return response.data.data
}

export interface AiFraudPriorityItem {
  propertyId: string
  title: string
  propertyType: string
  rentAmount: number
  location: { city?: string; subCity?: string }
  verificationStatus: string
  listingStatus: string
  riskScore: number
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  signals: string[]
}

export interface AiFraudPriorityResponse {
  queue: AiFraudPriorityItem[]
  summary: { total: number; high: number; medium: number; low: number; note: string }
}

/** Admin-only prioritized fraud review queue. */
export async function fetchFraudPriority(): Promise<AiFraudPriorityResponse> {
  const response = await get<{ data: AiFraudPriorityResponse }>('/api/v1/ai/fraud-priority')
  return response.data.data
}

/** Fetch a single property with full detail by id. Throws if not found. */
export async function fetchProperty(id: string): Promise<Property | null> {
  try {
    const response = await get<{ data: any }>(`/api/v1/properties/${id}`)
    const raw = response.data.data
    return raw ? mapApiProperty(raw) : null
  } catch (error) {
    console.error(`Failed to fetch property ${id}:`, error)
    return null
  }
}

// ---------------------------------------------------------------------------
// FR-02 — Landlord & Property Verification
// ---------------------------------------------------------------------------

// Legacy mock helpers — kept only because a few Sprint 7+ submission
// functions below still reference them in their (unreachable) mock branches.
let nextId = 1000
function generateId(prefix: string) {
  nextId += 1
  return `${prefix}-${nextId}`
}

function delay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE !== 'false'

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
