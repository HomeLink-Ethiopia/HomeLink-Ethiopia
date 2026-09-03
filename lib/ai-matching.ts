/**
 * AI Property Matching Algorithm
 * 
 * Scores each property against tenant preferences using weighted criteria:
 * - Budget: 25%
 * - Location: 25%
 * - Property Type: 15%
 * - Bedrooms: 15%
 * - Amenities: 10%
 * - Availability: 10%
 */

export interface TenantPreferences {
  budget: { min: number; max: number }
  location: string[]       // preferred neighborhoods
  propertyType: string     // apartment, house, studio, villa, any
  bedrooms: number         // minimum bedrooms
  amenities: string[]      // desired amenities
  moveInDate: string       // ISO date
  furnished?: boolean
}

export interface MatchResult {
  propertyId: string
  score: number            // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'
  reasons: MatchReason[]
  breakdown: {
    budget: number
    location: number
    propertyType: number
    bedrooms: number
    amenities: number
    availability: number
  }
}

export interface MatchReason {
  icon: 'check' | 'close' | 'partial'
  text: string
  weight: number
}

// Weight configuration
const WEIGHTS = {
  budget: 0.25,
  location: 0.25,
  propertyType: 0.15,
  bedrooms: 0.15,
  amenities: 0.10,
  availability: 0.10,
}

function scoreBudget(propertyPrice: number, preferences: TenantPreferences): { score: number; reason: MatchReason } {
  const { min, max } = preferences.budget
  
  if (propertyPrice >= min && propertyPrice <= max) {
    return {
      score: 100,
      reason: { icon: 'check', text: `Within your budget (ETB ${propertyPrice.toLocaleString()})`, weight: WEIGHTS.budget }
    }
  }
  
  // Within 10% over budget
  if (propertyPrice <= max * 1.1) {
    return {
      score: 70,
      reason: { icon: 'partial', text: `Slightly over budget (ETB ${propertyPrice.toLocaleString()} vs ${max.toLocaleString()} max)`, weight: WEIGHTS.budget }
    }
  }
  
  // More than 10% over
  if (propertyPrice > max * 1.1) {
    const overPercent = Math.round(((propertyPrice - max) / max) * 100)
    return {
      score: 20,
      reason: { icon: 'close', text: `${overPercent}% over your budget`, weight: WEIGHTS.budget }
    }
  }
  
  // Under budget
  return {
    score: 85,
    reason: { icon: 'check', text: `Below your budget (ETB ${propertyPrice.toLocaleString()})`, weight: WEIGHTS.budget }
  }
}

function scoreLocation(propertyNeighborhood: string, preferences: TenantPreferences): { score: number; reason: MatchReason } {
  if (preferences.location.length === 0) {
    return { score: 100, reason: { icon: 'check', text: 'No location preference', weight: WEIGHTS.location } }
  }
  
  if (preferences.location.includes(propertyNeighborhood)) {
    return {
      score: 100,
      reason: { icon: 'check', text: `In your preferred area (${propertyNeighborhood})`, weight: WEIGHTS.location }
    }
  }
  
  return {
    score: 30,
    reason: { icon: 'close', text: `Not in preferred area (${propertyNeighborhood})`, weight: WEIGHTS.location }
  }
}

function scorePropertyType(propertyType: string, preferredType: string): { score: number; reason: MatchReason } {
  if (!preferredType || preferredType === 'any') {
    return { score: 100, reason: { icon: 'check', text: 'Matches any property type', weight: WEIGHTS.propertyType } }
  }
  
  if (propertyType === preferredType) {
    return {
      score: 100,
      reason: { icon: 'check', text: `Matches your preferred type (${propertyType})`, weight: WEIGHTS.propertyType }
    }
  }
  
  return {
    score: 30,
    reason: { icon: 'close', text: `Different type (${propertyType} vs ${preferredType})`, weight: WEIGHTS.propertyType }
  }
}

function scoreBedrooms(propertyBeds: number, preferredBeds: number): { score: number; reason: MatchReason } {
  if (preferredBeds <= 0) {
    return { score: 100, reason: { icon: 'check', text: 'Any bedroom count', weight: WEIGHTS.bedrooms } }
  }
  
  if (propertyBeds >= preferredBeds) {
    return {
      score: 100,
      reason: { icon: 'check', text: `${propertyBeds} bedrooms (meets your ${preferredBeds}+ need)`, weight: WEIGHTS.bedrooms }
    }
  }
  
  return {
    score: 20,
    reason: { icon: 'close', text: `Only ${propertyBeds} bedrooms (you need ${preferredBeds}+)`, weight: WEIGHTS.bedrooms }
  }
}

function scoreAmenities(propertyAmenities: string[], desiredAmenities: string[]): { score: number; reason: MatchReason } {
  if (desiredAmenities.length === 0) {
    return { score: 100, reason: { icon: 'check', text: 'No amenity requirements', weight: WEIGHTS.amenities } }
  }
  
  const matched = desiredAmenities.filter(a => 
    propertyAmenities.some(pa => pa.toLowerCase().includes(a.toLowerCase()))
  )
  
  const matchPercent = matched.length / desiredAmenities.length
  
  if (matchPercent >= 0.8) {
    return {
      score: 100,
      reason: { icon: 'check', text: `Has ${matched.length}/${desiredAmenities.length} amenities you want`, weight: WEIGHTS.amenities }
    }
  }
  
  if (matchPercent >= 0.5) {
    return {
      score: 65,
      reason: { icon: 'partial', text: `Has ${matched.length}/${desiredAmenities.length} amenities (${matched.join(', ')})`, weight: WEIGHTS.amenities }
    }
  }
  
  if (matched.length > 0) {
    return {
      score: 35,
      reason: { icon: 'partial', text: `Only ${matched.length}/${desiredAmenities.length} amenities matched`, weight: WEIGHTS.amenities }
    }
  }
  
  return {
    score: 10,
    reason: { icon: 'close', text: 'None of your desired amenities', weight: WEIGHTS.amenities }
  }
}

function scoreAvailability(propertyStatus: string, moveInDate: string): { score: number; reason: MatchReason } {
  if (propertyStatus === 'active') {
    return {
      score: 100,
      reason: { icon: 'check', text: 'Available now', weight: WEIGHTS.availability }
    }
  }
  
  if (propertyStatus === 'rented') {
    return {
      score: 0,
      reason: { icon: 'close', text: 'Currently rented', weight: WEIGHTS.availability }
    }
  }
  
  return {
    score: 50,
    reason: { icon: 'partial', text: 'Availability uncertain', weight: WEIGHTS.availability }
  }
}

function getGrade(score: number): MatchResult['grade'] {
  if (score >= 95) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 75) return 'B+'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function getGradeColor(grade: MatchResult['grade']): string {
  switch (grade) {
    case 'A+': return '#059669' // green
    case 'A': return '#10B981'
    case 'B+': return '#F59E0B' // amber
    case 'B': return '#F97316' // orange
    case 'C': return '#EF4444' // red
    case 'D': return '#6B7280' // gray
  }
}

export function matchProperty(property: any, preferences: TenantPreferences): MatchResult {
  const neighborhood = property.neighborhood || property.location?.subCity || 'Unknown'
  
  const budgetResult = scoreBudget(property.priceEtb || property.rentAmount || 0, preferences)
  const locationResult = scoreLocation(neighborhood, preferences)
  const typeResult = scorePropertyType(property.propertyType || 'apartment', preferences.propertyType)
  const bedroomResult = scoreBedrooms(property.beds || property.bedrooms || 0, preferences.bedrooms)
  const amenityResult = scoreAmenities(property.amenities || [], preferences.amenities)
  const availResult = scoreAvailability(property.status || property.listingStatus || 'active', preferences.moveInDate)
  
  const breakdown = {
    budget: budgetResult.score,
    location: locationResult.score,
    propertyType: typeResult.score,
    bedrooms: bedroomResult.score,
    amenities: amenityResult.score,
    availability: availResult.score,
  }
  
  // Weighted total
  const totalScore = Math.round(
    breakdown.budget * WEIGHTS.budget +
    breakdown.location * WEIGHTS.location +
    breakdown.propertyType * WEIGHTS.propertyType +
    breakdown.bedrooms * WEIGHTS.bedrooms +
    breakdown.amenities * WEIGHTS.amenities +
    breakdown.availability * WEIGHTS.availability
  )
  
  const reasons: MatchReason[] = [
    budgetResult.reason,
    locationResult.reason,
    typeResult.reason,
    bedroomResult.reason,
    amenityResult.reason,
    availResult.reason,
  ].sort((a, b) => {
    // Show check first, then partial, then close
    const order = { check: 0, partial: 1, close: 2 }
    return order[a.icon] - order[b.icon]
  })
  
  return {
    propertyId: property.id || property._id,
    score: totalScore,
    grade: getGrade(totalScore),
    reasons,
    breakdown,
  }
}

export function matchAllProperties(properties: any[], preferences: TenantPreferences): MatchResult[] {
  return properties
    .map(p => matchProperty(p, preferences))
    .sort((a, b) => b.score - a.score)
}

export { getGradeColor, WEIGHTS }
