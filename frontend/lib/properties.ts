import { homePhoto } from './images'

export type Neighborhood =
  // Addis Ababa
  | 'Bole' | 'Kazanchis' | 'CMC' | 'Saris' | 'Yeka' | 'Piassa' | 'Merkato' | 'Arat Kilo'
  // Other Cities
  | 'Dire Dawa' | 'Hawassa' | 'Bahir Dar' | 'Mekelle' | 'Adama' | 'Jimma' | 'Gondar' | 'Dessie' | 'Harar' | 'Axum'

export interface BuildingUnit {
  id: string
  unitId?: string
  unitNumber: string
  name: string
  spaceType: 'office_room' | 'whole_floor' | 'entire_building' | 'retail_shop' | 'coworking_desk' | 'residential_unit'
  floorNumber: number
  sizeM2: number
  monthlyRent: number
  rentAmount?: number
  depositAmount?: number
  suitableFor: string[]
  status: 'available' | 'reserved' | 'rented'
  amenities?: string[]
  image?: string
}

export interface BuildingDetails {
  isMultiUnit: boolean
  rentalScope: 'entire_building' | 'by_floor' | 'individual_rooms' | 'flexible'
  totalFloors: number
  totalUnits: number
  units: BuildingUnit[]
}

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
  propertyType?: 'apartment' | 'house' | 'studio' | 'villa' | 'building' | 'commercial'
  buildingDetails?: BuildingDetails
  amenities?: string[]
  images?: string[] // Additional interior photos
  landlordId?: string
  furnished?: boolean
  status?: 'active' | 'inactive' | 'draft' | 'rented' | 'suspended' // Availability (from API listingStatus)
  availability?: string // same as status — explicit Sprint 5 field name
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended'
  fraudRiskScore?: number
  riskLevel?: string
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

export function neighborhoodColor(n: Neighborhood): string {
  return NEIGHBORHOOD_COLOR[n] || '#B8451F'
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
  {
    id: 'p11',
    title: 'Bole Nexus Commercial Center & Office Tower',
    neighborhood: 'Bole',
    priceEtb: 18500,
    beds: 10,
    baths: 8,
    sizeSqm: 1400,
    rating: 4.9,
    reviewCount: 42,
    verified: true,
    propertyType: 'building',
    furnished: true,
    description: 'Premier 5-storey commercial tower in Bole with 10 private office rooms, whole floor corporate headquarters, high-speed fiber internet, dual generators, and underground parking.',
    buildingDetails: {
      isMultiUnit: true,
      rentalScope: 'flexible',
      totalFloors: 5,
      totalUnits: 12,
      units: [
        {
          id: 'unit-tower-all',
          unitNumber: 'Full Building',
          name: 'Entire Commercial Tower (Floors 1-5)',
          spaceType: 'entire_building',
          floorNumber: 0,
          sizeM2: 1400,
          monthlyRent: 480000,
          depositAmount: 960000,
          image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Corporate HQ', 'Embassy', 'Tech Campus', 'Financial Institution'],
          status: 'available',
        },
        {
          id: 'unit-floor-2',
          unitNumber: 'Floor 2',
          name: 'Whole 2nd Floor (Corporate Workspace)',
          spaceType: 'whole_floor',
          floorNumber: 2,
          sizeM2: 280,
          monthlyRent: 120000,
          depositAmount: 240000,
          image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['IT / Software Company', 'Consultancy Group', 'Law Chambers'],
          status: 'available',
        },
        {
          id: 'unit-floor-3',
          unitNumber: 'Floor 3',
          name: 'Whole 3rd Floor (Executive Suites)',
          spaceType: 'whole_floor',
          floorNumber: 3,
          sizeM2: 280,
          monthlyRent: 115000,
          depositAmount: 230000,
          image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['FinTech', 'Regional NGO', 'Medical Specialist Center'],
          status: 'available',
        },
        {
          id: 'unit-room-101',
          unitNumber: 'Office 101',
          name: 'Private Work Suite 101',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 35,
          monthlyRent: 18500,
          depositAmount: 37000,
          image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Tech Startup', 'Architect Studio', 'Accounting Firm'],
          status: 'available',
        },
        {
          id: 'unit-room-102',
          unitNumber: 'Office 102',
          name: 'Executive Suite 102 (Balcony View)',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 40,
          monthlyRent: 20000,
          depositAmount: 40000,
          image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Legal Advisor', 'Import / Export Desk', 'Creative Agency'],
          status: 'available',
        },
        {
          id: 'unit-room-103',
          unitNumber: 'Office 103',
          name: 'Team Workstation Room 103',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 55,
          monthlyRent: 27000,
          depositAmount: 54000,
          image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Software Dev Team (6-8 people)', 'Design Lab'],
          status: 'available',
        },
        {
          id: 'unit-room-104',
          unitNumber: 'Office 104',
          name: 'Private Consultant Room 104',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 30,
          monthlyRent: 16000,
          depositAmount: 32000,
          image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Solo Consultant', 'Financial Analyst', 'Therapy Clinic'],
          status: 'available',
        },
        {
          id: 'unit-room-105',
          unitNumber: 'Office 105',
          name: 'Corner Office Suite 105',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 45,
          monthlyRent: 23000,
          depositAmount: 46000,
          image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Managing Director', 'Brokerage Office'],
          status: 'available',
        },
        {
          id: 'unit-room-201',
          unitNumber: 'Office 201',
          name: 'Open-Plan Team Office 201',
          spaceType: 'office_room',
          floorNumber: 2,
          sizeM2: 60,
          monthlyRent: 30000,
          depositAmount: 60000,
          image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Call Center / Customer Support', 'Data Processing Hub'],
          status: 'available',
        },
        {
          id: 'unit-room-202',
          unitNumber: 'Office 202',
          name: 'Conference & Work Suite 202',
          spaceType: 'office_room',
          floorNumber: 2,
          sizeM2: 38,
          monthlyRent: 19000,
          depositAmount: 38000,
          image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Marketing Agency', 'Training Classroom'],
          status: 'available',
        },
        {
          id: 'unit-room-203',
          unitNumber: 'Office 203',
          name: 'Incubator Lab 203',
          spaceType: 'office_room',
          floorNumber: 2,
          sizeM2: 50,
          monthlyRent: 25000,
          depositAmount: 50000,
          image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Hardware Prototyping', 'Media Production'],
          status: 'available',
        },
        {
          id: 'unit-ground-retail',
          unitNumber: 'Shop G-01',
          name: 'Ground Floor Premium Banking / Retail Hall',
          spaceType: 'retail_shop',
          floorNumber: 0,
          sizeM2: 180,
          monthlyRent: 95000,
          depositAmount: 190000,
          image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Bank Branch', 'Showroom', 'Coffee Bistro / Pharmacy'],
          status: 'available',
        },
      ],
    },
  },
  {
    id: 'p12',
    title: 'Kazanchis Executive Financial Plaza',
    neighborhood: 'Kazanchis',
    priceEtb: 22000,
    beds: 12,
    baths: 6,
    sizeSqm: 1800,
    rating: 4.8,
    reviewCount: 28,
    verified: true,
    propertyType: 'building',
    furnished: true,
    description: 'High-rise 6-storey commercial tower in Kazanchis financial district with private consultant suites, banking hall, high-speed elevators, and backup generator.',
    buildingDetails: {
      isMultiUnit: true,
      rentalScope: 'flexible',
      totalFloors: 6,
      totalUnits: 14,
      units: [
        {
          id: 'p12-shop-g01',
          unitNumber: 'Shop G-01',
          name: 'Ground Floor Commercial Banking Space',
          spaceType: 'retail_shop',
          floorNumber: 0,
          sizeM2: 120,
          monthlyRent: 85000,
          depositAmount: 170000,
          image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Bank Branch', 'Telecom Store', 'Pharmacy'],
          status: 'available',
        },
        {
          id: 'p12-room-101',
          unitNumber: 'Suite 101',
          name: 'Financial Advisory Suite 101',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 45,
          monthlyRent: 22000,
          depositAmount: 44000,
          image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Financial Consultant', 'Accountancy', 'Law Firm'],
          status: 'available',
        },
        {
          id: 'p12-room-102',
          unitNumber: 'Suite 102',
          name: 'Executive Office 102',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 38,
          monthlyRent: 20000,
          depositAmount: 40000,
          image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Private Practice', 'Insurance Agency'],
          status: 'available',
        },
        {
          id: 'p12-floor-2',
          unitNumber: 'Floor 2',
          name: 'Full 2nd Floor Corporate Lease',
          spaceType: 'whole_floor',
          floorNumber: 2,
          sizeM2: 300,
          monthlyRent: 135000,
          depositAmount: 270000,
          image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Fintech Group', 'NGO Regional Office'],
          status: 'available',
        },
      ],
    },
  },
  {
    id: 'p13',
    title: 'CMC Sunrise Commercial Center & Medical Suites',
    neighborhood: 'CMC',
    priceEtb: 15000,
    beds: 8,
    baths: 4,
    sizeSqm: 950,
    rating: 4.7,
    reviewCount: 19,
    verified: true,
    propertyType: 'building',
    furnished: true,
    description: 'Modern 4-storey commercial center in CMC suitable for healthcare clinics, dental offices, retail pharmacies, and professional firms.',
    buildingDetails: {
      isMultiUnit: true,
      rentalScope: 'flexible',
      totalFloors: 4,
      totalUnits: 8,
      units: [
        {
          id: 'p13-shop-g01',
          unitNumber: 'Pharmacy G-01',
          name: 'Ground Floor Pharmacy / Retail Space',
          spaceType: 'retail_shop',
          floorNumber: 0,
          sizeM2: 80,
          monthlyRent: 45000,
          depositAmount: 90000,
          image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Pharmacy', 'Optometry Clinic', 'Diagnostics'],
          status: 'available',
        },
        {
          id: 'p13-room-101',
          unitNumber: 'Clinic 101',
          name: 'Medical Consultation Suite 101',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 35,
          monthlyRent: 15000,
          depositAmount: 30000,
          image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Dental Clinic', 'Pediatric Office', 'Therapy'],
          status: 'available',
        },
        {
          id: 'p13-room-102',
          unitNumber: 'Office 102',
          name: 'Administrative Office 102',
          spaceType: 'office_room',
          floorNumber: 1,
          sizeM2: 30,
          monthlyRent: 14000,
          depositAmount: 28000,
          image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
          suitableFor: ['Legal Services', 'Accounting Firm'],
          status: 'available',
        },
      ],
    },
  },
]

export const PROPERTIES: Property[] = RAW.map((p, i) => {
  const [lat, lng] = coordsFor(p.neighborhood, i + 1)
  return {
    ...p,
    lat,
    lng,
    image: homePhoto(`${p.id}-${p.neighborhood}`, p.propertyType),
  }
})

export function formatEtb(price: number) {
  return `ETB ${price.toLocaleString('en-US')}`
}

/** Short label used on map pins, e.g. "18K", "22K". */
export function priceLabel(price: number) {
  return price >= 1000 ? `${Math.round(price / 1000)}K` : `${price}`
}
