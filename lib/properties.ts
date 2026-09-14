import { stockPhoto } from './images'

export type Neighborhood =
  // Addis Ababa
  | 'Bole' | 'Kazanchis' | 'CMC' | 'Saris' | 'Yeka' | 'Piassa' | 'Merkato' | 'Arat Kilo'
  // Other Cities
  | 'Dire Dawa' | 'Hawassa' | 'Bahir Dar' | 'Mekelle' | 'Adama' | 'Jimma' | 'Gondar' | 'Dessie' | 'Harar' | 'Axum'

export interface Property {
  id: string
  title: string
  neighborhood: Neighborhood
  priceEtb: number
  beds: number
  baths: number
  sizeSqm: number
  rating: number
  reviewCount: number
  verified: boolean
  image: string
  lat: number
  lng: number
  // Extended fields for full property details
  description?: string
  propertyType?: 'apartment' | 'house' | 'studio' | 'villa'
  amenities?: string[]
  images?: string[] // Additional interior photos
  landlordId?: string
  furnished?: boolean
  status?: 'active' | 'inactive' // For filtering from search results
  fraudRiskScore?: number
  riskLevel?: 'low' | 'medium' | 'high'
  redFlags?: string[]
  createdAt?: string
  updatedAt?: string
}

/**
 * Approximate real coordinates for each neighborhood's center, with a
 * small deterministic jitter per listing so pins don't stack exactly
 * on top of each other on the map.
 */
const NEIGHBORHOOD_CENTERS: Record<Neighborhood, [number, number]> = {
  // Addis Ababa
  Bole: [9.0084, 38.7913],
  Kazanchis: [9.0227, 38.7621],
  CMC: [9.0522, 38.8067],
  Saris: [8.9806, 38.7756],
  Yeka: [9.0392, 38.8125],
  Piassa: [9.0340, 38.7460],
  Merkato: [9.0170, 38.7480],
  'Arat Kilo': [9.0380, 38.7610],
  // Other Cities
  'Dire Dawa': [9.5930, 41.8520],
  'Hawassa': [7.0621, 38.4763],
  'Bahir Dar': [11.5940, 37.3910],
  'Mekelle': [13.4967, 39.4753],
  'Adama': [8.5400, 39.2700],
  'Jimma': [7.6789, 36.8340],
  'Gondar': [12.6030, 37.4510],
  'Dessie': [11.1080, 39.6360],
  'Harar': [9.3115, 42.1190],
  'Axum': [14.1210, 38.7470],
}

/** Deterministic small offset so the same property always renders at the same spot. */
function jitter(seed: number) {
  const n = Math.sin(seed * 9973) * 10000
  return (n - Math.floor(n) - 0.5) * 0.012
}

function coordsFor(neighborhood: Neighborhood, seed: number): [number, number] {
  const [lat, lng] = NEIGHBORHOOD_CENTERS[neighborhood]
  return [lat + jitter(seed), lng + jitter(seed + 1)]
}

/**
 * Pin/accent color per neighborhood — lets someone scanning the map
 * spot a cluster at a glance instead of reading every price bubble.
 * Kept to the existing token palette plus one added "gold" tier.
 */
export const NEIGHBORHOOD_COLOR: Partial<Record<Neighborhood, string>> = {
  Bole: '#B8451F', // rust
  Kazanchis: '#3D6B4F', // verified green
  CMC: '#B8862B', // gold
  Saris: '#2A2521', // charcoal
  Yeka: '#3D6B4F', // verified green
}

const RAW: Omit<Property, 'lat' | 'lng' | 'image'>[] = [
  { id: 'p1', title: '2 Bedroom Apartment', neighborhood: 'Bole', priceEtb: 18000, beds: 2, baths: 1, sizeSqm: 65, rating: 4.8, reviewCount: 34, verified: true, propertyType: 'apartment', furnished: false },
  { id: 'p2', title: '3 Bedroom Apartment', neighborhood: 'Kazanchis', priceEtb: 22000, beds: 3, baths: 2, sizeSqm: 100, rating: 4.7, reviewCount: 28, verified: true, propertyType: 'apartment', furnished: true },
  { id: 'p3', title: '2 Bedroom House', neighborhood: 'Saris', priceEtb: 16000, beds: 2, baths: 1, sizeSqm: 70, rating: 4.7, reviewCount: 19, verified: true, propertyType: 'house', furnished: false },
  { id: 'p4', title: '3 Bedroom Apartment', neighborhood: 'CMC', priceEtb: 22000, beds: 3, baths: 2, sizeSqm: 100, rating: 4.6, reviewCount: 18, verified: true, propertyType: 'apartment', furnished: true },
  { id: 'p5', title: '2 Bedroom Apartment', neighborhood: 'Yeka', priceEtb: 17500, beds: 2, baths: 1, sizeSqm: 60, rating: 4.5, reviewCount: 16, verified: true, propertyType: 'apartment', furnished: false },
  { id: 'p6', title: '2 Bedroom Apartment', neighborhood: 'Bole', priceEtb: 18500, beds: 2, baths: 1, sizeSqm: 62, rating: 4.6, reviewCount: 21, verified: true, propertyType: 'apartment', furnished: true },
  { id: 'p7', title: '1 Bedroom Apartment', neighborhood: 'Kazanchis', priceEtb: 13000, beds: 1, baths: 1, sizeSqm: 45, rating: 4.4, reviewCount: 12, verified: true, propertyType: 'studio', furnished: true },
  { id: 'p8', title: '3 Bedroom House', neighborhood: 'CMC', priceEtb: 20000, beds: 3, baths: 2, sizeSqm: 110, rating: 4.5, reviewCount: 15, verified: false, propertyType: 'house', furnished: false },
  { id: 'p9', title: '2 Bedroom Apartment', neighborhood: 'Saris', priceEtb: 13500, beds: 2, baths: 1, sizeSqm: 58, rating: 4.3, reviewCount: 9, verified: true, propertyType: 'apartment', furnished: false },
  { id: 'p10', title: '1 Bedroom Apartment', neighborhood: 'Bole', priceEtb: 12000, beds: 1, baths: 1, sizeSqm: 40, rating: 4.4, reviewCount: 14, verified: true, propertyType: 'studio', furnished: true },
]

export const PROPERTIES: Property[] = RAW.map((p, i) => {
  const [lat, lng] = coordsFor(p.neighborhood, i + 1)
  return {
    ...p,
    lat,
    lng,
    image: stockPhoto(`${p.id}-${p.neighborhood}`, 640, 480),
  }
})

export function formatEtb(price: number) {
  return `ETB ${price.toLocaleString('en-US')}`
}

/** Short label used on map pins, e.g. "18K", "22K". */
export function priceLabel(price: number) {
  return price >= 1000 ? `${Math.round(price / 1000)}K` : `${price}`
}
