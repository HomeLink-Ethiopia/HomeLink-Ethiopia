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
  baths?: number
  propertyType?: string
  furnished?: boolean
  verifiedOnly?: boolean
  amenities?: string[]
  sort?: string
  page?: number
  limit?: number
  query?: string
}

export interface SearchPropertiesResult {
  properties: Property[]
  total: number
  pages: number
  page: number
}

// Map API response (MongoDB) to frontend Property type
export function mapApiProperty(raw: any): Property {
  const loc = raw.location || {}
  const subCity = loc.subCity || loc.neighborhood || 'Bole'

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  // Only use real landlord-uploaded photos — do not show fake stock images
  let image = ''
  if (raw.images && raw.images.length > 0) {
    const primary = raw.images.find((img: any) => img.isPrimary) || raw.images[0]
    const u = typeof primary === 'string' ? primary : primary?.url
    if (u) {
      image = u.startsWith('/uploads') ? `${API_URL}${u}` : u
    }
  }

  // Real coordinates from neighborhood or DB coordinates
  let lat = raw.location?.coordinates?.coordinates?.[1] ?? raw.location?.coordinates?.[1]
  let lng = raw.location?.coordinates?.coordinates?.[0] ?? raw.location?.coordinates?.[0]
  if (!lat || !lng || (lat === 9.03 && lng === 38.7578)) {
    const neighborhoodCoords: Record<string, [number, number]> = {
      Bole: [9.0084, 38.7913],
      Kazanchis: [9.0227, 38.7621],
      CMC: [9.0522, 38.8067],
      Saris: [8.9806, 38.7756],
      Yeka: [9.0392, 38.8125],
      Piassa: [9.0340, 38.7460],
      Merkato: [9.0170, 38.7480],
      'Arat Kilo': [9.0380, 38.7610],
      'Old Airport': [8.9920, 38.7350],
      Mekanissa: [8.9880, 38.7200],
    }
    const center = neighborhoodCoords[subCity] || [9.02, 38.75]
    lat = center[0]
    lng = center[1]
  }

  return {
    id: raw._id || raw.id,
    title: raw.title,
    neighborhood: subCity as any,
    priceEtb: raw.rentAmount || 0,
    beds: raw.bedrooms || 0,
    baths: raw.bathrooms || 0,
    sizeSqm: raw.sizeM2 || 0,
    rating: raw.fraudRiskScore ? Math.max(1, 5.0 - raw.fraudRiskScore * 0.2) : 4.8,
    fraudRiskScore: raw.fraudRiskScore,
    riskLevel: raw.riskLevel || 'low',
    redFlags: raw.redFlags || [],
    reviewCount: 0,
    verified: raw.verificationStatus === 'verified',
    image,
    lat,
    lng,
    description: raw.description,
    propertyType: raw.propertyType,
    buildingDetails: raw.buildingDetails,
    amenities: raw.amenities,
    images: (raw.images || []).map((img: any) => {
      const u = typeof img === 'string' ? img : img.url
      return u && u.startsWith('/uploads') ? `${API_URL}${u}` : u
    }).filter(Boolean),
    landlordId: raw.landlordId,
    status: raw.listingStatus,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export async function searchProperties(filters: PropertyFilters = {}): Promise<SearchPropertiesResult> {
  try {
    const params = new URLSearchParams()
    if (filters.neighborhood && !filters.neighborhood.startsWith('__header')) {
      params.append('neighborhood', filters.neighborhood)
      params.append('subCity', filters.neighborhood)
    }
    if (filters.city) params.append('city', filters.city)
    if (filters.propertyType) params.append('propertyType', filters.propertyType)
    if (filters.minPrice !== undefined && filters.minPrice !== null) params.append('minPrice', String(filters.minPrice))
    if (filters.maxPrice !== undefined && filters.maxPrice !== null) params.append('maxPrice', String(filters.maxPrice))
    if (filters.beds !== undefined && filters.beds !== null) {
      params.append('beds', String(filters.beds))
      params.append('bedrooms', String(filters.beds))
    }
    if (filters.baths !== undefined && filters.baths !== null) {
      params.append('baths', String(filters.baths))
      params.append('bathrooms', String(filters.baths))
    }
    if (filters.furnished !== undefined) params.append('furnished', String(filters.furnished))
    if (filters.verifiedOnly) params.append('verifiedOnly', 'true')
    if (filters.sort) params.append('sort', filters.sort)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.query) params.append('query', filters.query)

    const query = params.toString()
    const endpoint = query ? `/api/v1/properties/search?${query}` : '/api/v1/properties/search'

    const response = await get<{ data: any[]; pagination?: any }>(endpoint)
    const rawProperties = response.data?.data || []
    const pagination = response.data?.pagination || {}
    const properties = rawProperties.map(mapApiProperty)

    return {
      properties,
      total: typeof pagination.total === 'number' ? pagination.total : properties.length,
      pages: typeof pagination.totalPages === 'number' ? pagination.totalPages : 1,
      page: typeof pagination.page === 'number' ? pagination.page : 1,
    }
  } catch (error) {
    console.error('Failed to search properties from API:', error)
    return { properties: [], total: 0, pages: 1, page: 1 }
  }
}

export async function fetchProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  const result = await searchProperties(filters)
  return result.properties
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
  propertyType: 'apartment' | 'house' | 'studio' | 'villa' | 'building' | 'commercial'
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
  buildingDetails?: any
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

// ---------------------------------------------------------------------------
// AI Microservice Services — Rent Estimation & Recommendations
// ---------------------------------------------------------------------------

export interface RentEstimateInput {
  subCity: string
  bedrooms: number
  bathrooms?: number
  area_sqm?: number
  sizeM2?: number
  is_furnished?: boolean
  has_water_tank?: boolean
  has_generator?: boolean
  amenities?: string[]
}

export interface RentEstimateResult {
  low: number
  fair: number
  high: number
  confidence: number
  model_used: string
}

export async function fetchRentEstimate(input: RentEstimateInput): Promise<RentEstimateResult> {
  if (MOCK_MODE) {
    await delay(null, 500); // Simulate network latency
    const fair = (input.sizeM2 || 50) * 350 + (input.bedrooms * 2000);
    return {
      low: Math.round(fair * 0.85),
      fair: Math.round(fair),
      high: Math.round(fair * 1.15),
      confidence: 0.95,
      model_used: 'Mock AI Engine'
    };
  }

  const response = await post<any>('/api/v1/properties/estimate-rent', {
    subCity: input.subCity,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms || 1,
    sizeM2: input.sizeM2 || 50,
    is_furnished: input.is_furnished || false,
    has_water_tank: input.has_water_tank || false,
    has_generator: input.has_generator || false,
  })

  const data = response.data?.data || response.data;
  
  // Handle different response structures gracefully
  const fair = Math.round(data.estimated_market_rent || data.estimated_rent_etb || data.estimate?.fair || 25000)
  const low = Math.round(data.range_low || data.estimate?.low || fair * 0.88)
  const high = Math.round(data.range_high || data.estimate?.high || fair * 1.15)
  
  return {
    low,
    fair,
    high,
    confidence: data.confidence || 0.95,
    model_used: data.model_used || data.model_version || 'XGBoost Rent Model'
  }
}

export async function fetchAIRecommendations(
  prefs?: any
): Promise<Array<Property & { matchScore: number; matchReasons: string[] }>> {
  try {
    const response = await get<{ data: any[] }>('/api/v1/properties/recommendations')
    if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
      return response.data.data.map((p: any) => ({
        ...mapApiProperty(p),
        matchScore: p.matchScore || 85,
        matchReasons: p.matchReasons || ['Matched to your criteria']
      }))
    }
  } catch (error) {
    console.warn('Failed to fetch AI recommendations from backend:', error)
  }
  return []
}

export interface AiMatch {
  propertyId: string;
  score: number;
  title: string;
  location?: { subCity?: string; city?: string };
  rentAmount: number;
  bedrooms: number;
  bathrooms: number;
  verificationStatus: string;
  images?: { url: string }[];
  matchReasons: string[];
  reasons?: any[];
  breakdown?: Record<string, number>;
  grade?: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
}

export interface AiMatchResponse {
  matches: AiMatch[];
  meta: any;
}

export async function fetchAiMatches(params: any): Promise<AiMatchResponse> {
  try {
    const prefsPayload = {
      budget: params.budget || { min: 0, max: 100000 },
      location: { subCity: params.location?.subCity || 'Bole' },
      propertyType: params.propertyType || 'any',
      bedrooms: params.bedrooms || 1,
      bathrooms: params.bathrooms || 1,
      amenities: params.amenities || [],
      furnished: params.amenities?.includes('Furnished') || false
    };
    await post('/api/v1/properties/preferences', prefsPayload);
  } catch (e) {
    console.warn('Failed to save preferences to backend:', e);
  }

  const response = await get<{ data: any[] }>('/api/v1/properties/recommendations');
  const items = response.data?.data || [];
  
  return {
    matches: items.map((p: any) => ({
      propertyId: p._id || p.id,
      score: p.matchScore || 0,
      title: p.title,
      location: p.location,
      rentAmount: p.rentAmount || p.priceEtb || 0,
      bedrooms: p.bedrooms || 0,
      bathrooms: p.bathrooms || 0,
      verificationStatus: p.verificationStatus || 'unverified',
      images: p.images || (p.image ? [{url: p.image}] : []),
      matchReasons: p.matchReasons || []
    })),
    meta: { total: items.length }
  };
}


export interface AiFraudPriorityItem {
  propertyId: string;
  title: string;
  riskScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  signals: string[];
  verificationStatus: string;
}

export async function fetchFraudPriority(): Promise<{ queue: AiFraudPriorityItem[], summary: { note: string } }> {
  try {
    const response = await get<any>('/api/v1/fraud-reports/priority-queue');
    return response.data?.data || { queue: [], summary: { note: 'No data' } };
  } catch (error) {
    return { queue: [], summary: { note: 'Priority queue unavailable' } };
  }
}


