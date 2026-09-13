import { PROPERTIES, type Property } from './properties'
import { personPhoto, stockPhoto } from './images'

export interface MaintenanceRequestSummary {
  id: string
  title: string
  status: 'Submitted' | 'In Progress' | 'Resolved' | 'Closed'
}

export interface RentEstimate {
  low: number
  high: number
  /** Where the platform's own estimate sits — usually close to the listed price. */
  fair: number
}

export interface Landlord {
  name: string
  verified: boolean
  memberSince: string
  rating: number
  reviewCount: number
  avatar: string
}

export interface PropertyDetail extends Property {
  description: string
  images: string[]
  amenities: string[]
  depositEtb: number
  nearby: string[]
  landlord: Landlord
  openRequests: MaintenanceRequestSummary[]
  rentEstimate: RentEstimate
}

const AMENITY_POOL = ['Wi-Fi', 'Parking', 'Water 24/7', 'Security', 'Kitchen', 'Balcony', 'Generator', 'Elevator']
const LANDLORD_NAMES = ['Abebe T.', 'Selamawit G.', 'Yonas B.', 'Meron A.', 'Dawit H.', 'Frehiwot M.', 'Nathnael K.', 'Hanna W.', 'Bereket L.', 'Ruth Z.']
const REQUEST_TITLES = ['Water leak in bathroom', 'Lighting not working', 'Gate lock sticking', 'Generator noise']

/** Deterministic 0..1 pseudo-random from a string seed, so mock data is stable across renders. */
function seededFraction(seed: string) {
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0
  return (n % 10000) / 10000
}

function buildDetail(property: Property, index: number): PropertyDetail {
  const f = seededFraction(property.id)

  const amenityCount = 5 + Math.floor(f * 3) // 5-7
  const amenities = AMENITY_POOL.slice(0, amenityCount)

  const galleryCount = 4 + Math.floor(f * 4) // 4-7 extra angles beyond the hero
  const images = Array.from({ length: galleryCount }, (_, i) =>
    stockPhoto(`${property.id}-gallery-${i}`, 1200, 900)
  )

  const depositEtb = property.priceEtb * 2

  const landlordName = LANDLORD_NAMES[index % LANDLORD_NAMES.length]
  const landlord: Landlord = {
    name: landlordName,
    verified: property.verified,
    memberSince: `${['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'][index % 6]} ${2019 + (index % 6)}`,
    rating: Math.round((4.3 + f * 0.6) * 10) / 10,
    reviewCount: 8 + Math.floor(f * 40),
    avatar: personPhoto(`${property.id}-landlord`),
  }

  const requestCount = Math.floor(f * 3) // 0-2 open requests
  const openRequests: MaintenanceRequestSummary[] = Array.from({ length: requestCount }, (_, i) => ({
    id: `${property.id}-req-${i}`,
    title: REQUEST_TITLES[(index + i) % REQUEST_TITLES.length],
    status: i === 0 ? 'In Progress' : 'Submitted',
  }))

  const spread = Math.round(property.priceEtb * 0.08)
  const rentEstimate: RentEstimate = {
    low: property.priceEtb - spread,
    fair: property.priceEtb - Math.round(spread * 0.15),
    high: property.priceEtb + spread,
  }

  const description = `A bright and comfortable ${property.beds}-bedroom ${
    property.title.toLowerCase().includes('house') ? 'house' : 'apartment'
  } in the heart of ${property.neighborhood}. Close to restaurants, shopping, and business centers — perfect for professionals and small families. The unit gets natural light through most of the day and has been recently refreshed.`

  const nearby = [
    `${5 + (index % 4)} min to ${['Edna Mall', 'Bole Atlas', 'Friendship Center', 'Century Mall'][index % 4]}`,
    `${8 + (index % 5)} min to ${['Airport', 'Meskel Square', 'Bole Road', 'Kazanchis Business District'][index % 4]}`,
  ]

  return {
    ...property,
    description,
    images,
    amenities,
    depositEtb,
    nearby,
    landlord,
    openRequests,
    rentEstimate,
  }
}

const DETAILS: Record<string, PropertyDetail> = Object.fromEntries(
  PROPERTIES.map((p, i) => [p.id, buildDetail(p, i)])
)

export function getPropertyDetail(id: string): PropertyDetail | undefined {
  return DETAILS[id]
}

/** A handful of other verified listings for the "Similar Properties" rail — same neighborhood first, then fills from elsewhere. */
export function getSimilarProperties(id: string, count = 4): Property[] {
  const current = DETAILS[id]
  if (!current) return []
  const rest = PROPERTIES.filter((p) => p.id !== id)
  const sameNeighborhood = rest.filter((p) => p.neighborhood === current.neighborhood)
  const others = rest.filter((p) => p.neighborhood !== current.neighborhood)
  return [...sameNeighborhood, ...others].slice(0, count)
}
