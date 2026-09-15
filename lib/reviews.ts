import { personPhoto } from './images'

export interface Review {
  id: string
  propertyId: string
  authorName: string
  authorAvatar: string
  rating: number // 1-5
  title: string
  text: string
  date: string
  helpful: number
  type: 'tenant_to_property' | 'tenant_to_landlord' | 'landlord_to_tenant'
}

export interface PropertyRatingSummary {
  propertyId: string
  averageRating: number
  totalReviews: number
  breakdown: { 5: number; 4: number; 3: number; 2: number; 1: number }
}

/** Mock reviews keyed by property ID */
export const MOCK_REVIEWS: Record<string, Review[]> = {
  'prop-001': [
    {
      id: 'rev-001',
      propertyId: 'prop-001',
      authorName: 'Tsedi Tesfaye',
      authorAvatar: personPhoto('tenant-tsedi'),
      rating: 5,
      title: 'Excellent apartment in Bole',
      text: 'The apartment is exactly as described. Modern finishes, great natural light, and the landlord was very responsive. The neighborhood is convenient with easy access to restaurants and public transport.',
      date: '2024-01-15',
      helpful: 12,
      type: 'tenant_to_property',
    },
    {
      id: 'rev-002',
      propertyId: 'prop-001',
      authorName: 'Meron Alemayehu',
      authorAvatar: personPhoto('tenant-meron'),
      rating: 4,
      title: 'Great location, minor issues',
      text: 'Love the Bole location and the building security. The water pressure is sometimes low in the evening, but overall a very solid rental. Would recommend.',
      date: '2024-01-08',
      helpful: 8,
      type: 'tenant_to_property',
    },
    {
      id: 'rev-003',
      propertyId: 'prop-001',
      authorName: 'Daniel Tesfahun',
      authorAvatar: personPhoto('tenant-daniel'),
      rating: 4,
      title: 'Good value for the price',
      text: 'Spacious rooms, working plumbing, and the verification badge gave me confidence. Parking can be tight during weekdays.',
      date: '2023-12-20',
      helpful: 5,
      type: 'tenant_to_property',
    },
  ],
  'prop-002': [
    {
      id: 'rev-010',
      propertyId: 'prop-002',
      authorName: 'Hana Mekonnen',
      authorAvatar: personPhoto('tenant-hana'),
      rating: 5,
      title: 'Perfect studio for young professionals',
      text: 'Compact but thoughtfully designed. The Kazanchis location is unbeatable for someone working in the CBD. Internet was fast and the building management is excellent.',
      date: '2024-01-10',
      helpful: 15,
      type: 'tenant_to_property',
    },
  ],
}

/** Get rating summary for a property */
export function getPropertyRating(propertyId: string): PropertyRatingSummary {
  const reviews = MOCK_REVIEWS[propertyId] || []
  const total = reviews.length
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : 0

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  reviews.forEach((r) => {
    breakdown[r.rating as keyof typeof breakdown]++
  })

  return {
    propertyId,
    averageRating: avg,
    totalReviews: total,
    breakdown,
  }
}

/** Add a new review (mock) */
export function addReview(review: Omit<Review, 'id' | 'date' | 'helpful'>): Review {
  return {
    ...review,
    id: `rev-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    helpful: 0,
  }
}
