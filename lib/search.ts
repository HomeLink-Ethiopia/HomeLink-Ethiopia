/**
 * Search and filter utilities for property discovery
 */

import { Property, Neighborhood } from './properties'

export interface SearchFilters {
  query?: string // Free text search (title, location, description)
  neighborhood?: Neighborhood // Bole, Kazanchis, CMC, etc.
  propertyType?: 'apartment' | 'house' | 'studio' | 'villa'
  minPrice?: number
  maxPrice?: number
  beds?: number // 1, 2, 3, 4+
}

/**
 * Filter properties based on search criteria
 * @param properties Array of properties to filter
 * @param filters Search filter criteria
 * @returns Filtered array of properties
 */
export function filterProperties(
  properties: Property[],
  filters: SearchFilters
): Property[] {
  return properties.filter((property) => {
    // Query: case-insensitive match in title, neighborhood, or description
    if (filters.query) {
      const q = filters.query.toLowerCase()
      const matchesTitle = property.title.toLowerCase().includes(q)
      const matchesNeighborhood = property.neighborhood.toLowerCase().includes(q)
      // Note: description field may not exist on all properties
      const matchesDescription = property.description
        ? property.description.toLowerCase().includes(q)
        : false

      if (!matchesTitle && !matchesNeighborhood && !matchesDescription) {
        return false
      }
    }

    // Neighborhood: exact match
    if (filters.neighborhood && property.neighborhood !== filters.neighborhood) {
      return false
    }

    // Property type: exact match
    if (filters.propertyType && property.propertyType !== filters.propertyType) {
      return false
    }

    // Price range: min price
    if (filters.minPrice && property.priceEtb < filters.minPrice) {
      return false
    }

    // Price range: max price
    if (filters.maxPrice && property.priceEtb > filters.maxPrice) {
      return false
    }

    // Bedrooms: exact match
    if (filters.beds && property.beds !== filters.beds) {
      return false
    }

    // Status filter: exclude inactive properties
    if (property.status === 'inactive') {
      return false
    }

    return true
  })
}

/**
 * Parse URL search params into SearchFilters object
 * @param searchParams URLSearchParams from Next.js
 * @returns SearchFilters object
 */
export function parseSearchParams(searchParams: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {}

  const query = searchParams.get('q')
  if (query) {
    filters.query = query
  }

  const neighborhood = searchParams.get('neighborhood')
  if (neighborhood) {
    filters.neighborhood = neighborhood as Neighborhood
  }

  const propertyType = searchParams.get('type')
  if (propertyType) {
    filters.propertyType = propertyType as 'apartment' | 'house' | 'studio' | 'villa'
  }

  const minPrice = searchParams.get('minPrice')
  if (minPrice) {
    filters.minPrice = parseInt(minPrice, 10)
  }

  const maxPrice = searchParams.get('maxPrice')
  if (maxPrice) {
    filters.maxPrice = parseInt(maxPrice, 10)
  }

  const beds = searchParams.get('beds')
  if (beds) {
    filters.beds = parseInt(beds, 10)
  }

  return filters
}

/**
 * Build URL search params from SearchFilters object
 * @param filters SearchFilters object
 * @returns URLSearchParams string
 */
export function buildSearchParams(filters: SearchFilters): string {
  const params = new URLSearchParams()

  if (filters.query) {
    params.set('q', filters.query)
  }

  if (filters.neighborhood) {
    params.set('neighborhood', filters.neighborhood)
  }

  if (filters.propertyType) {
    params.set('type', filters.propertyType)
  }

  if (filters.minPrice) {
    params.set('minPrice', filters.minPrice.toString())
  }

  if (filters.maxPrice) {
    params.set('maxPrice', filters.maxPrice.toString())
  }

  if (filters.beds) {
    params.set('beds', filters.beds.toString())
  }

  return params.toString()
}
