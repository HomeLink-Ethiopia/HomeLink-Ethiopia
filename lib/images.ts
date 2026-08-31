/**
 * Centralized image helpers for HomeLink Ethiopia.
 *
 * Uses real Ethiopian/Addis Ababa photos from Unsplash.
 * These are free-to-use Unsplash images that represent Ethiopian
 * architecture, neighborhoods, and city life.
 */

/**
 * Hero slideshow images for home page
 * Real photos of Addis Ababa modern buildings and neighborhoods
 */
export const HERO_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1572531812473-34e31c9ac378?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1572531812473-34e31c9ac378?w=1920&h=1080&fit=crop',
    caption: 'Modern Living in Bole, Addis Ababa',
  },
  {
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop',
    caption: 'Urban Residences in Kazanchis',
  },
  {
    url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&h=1080&fit=crop',
    caption: 'Spacious Family Homes in CMC',
  },
  {
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&h=1080&fit=crop',
    caption: 'Verified Properties Across Ethiopia',
  },
]

/**
 * Neighborhood showcase images
 * Photos representing different areas of Addis Ababa
 */
export const NEIGHBORHOOD_PHOTOS: Record<string, string> = {
  'Bole': 'https://images.unsplash.com/photo-1572531812473-34e31c9ac378?w=800&h=600&fit=crop',
  'Kazanchis': 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&h=600&fit=crop',
  'CMC': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
  'Old Airport': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
  'Megenagna': 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
  'Sarbet': 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
  'Gerji': 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',
  '22 Mazoria': 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop',
}

/**
 * Property listing card images
 * A mix of interior and exterior property photos
 */
export const PROPERTY_PHOTOS = [
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',  // modern interior
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',  // apartment building
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',  // house exterior
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop',  // living room
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',  // bedroom
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',  // kitchen
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',  // modern apartment
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',  // villa
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',  // compound
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',  // furnished
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',  // room
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',  // modern kitchen
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',  // loft
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',  // house
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop',  // family home
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',  // apartment
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',  // interior
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',  // residential
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',  // bedroom modern
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',  // compound home
]

/**
 * Returns a stable photo URL for any seed string.
 * Uses Unsplash photos of Ethiopian-style properties.
 */
export function stockPhoto(seed: string, width = 800, height = 600): string {
  // Map specific seeds to curated Unsplash images
  const curatedMap: Record<string, string> = {
    // Neighborhood images
    'addis-ababa-bole-area': NEIGHBORHOOD_PHOTOS['Bole'],
    'addis-ababa-kazanchis-area': NEIGHBORHOOD_PHOTOS['Kazanchis'],
    'addis-ababa-cmc-area': NEIGHBORHOOD_PHOTOS['CMC'],
    'addis-ababa-old-airport': NEIGHBORHOOD_PHOTOS['Old Airport'],
    'addis-ababa-megenagna': NEIGHBORHOOD_PHOTOS['Megenagna'],
    'addis-ababa-sarbet': NEIGHBORHOOD_PHOTOS['Sarbet'],
    'addis-ababa-gerji': NEIGHBORHOOD_PHOTOS['Gerji'],
    'addis-ababa-22-mazoria': NEIGHBORHOOD_PHOTOS['22 Mazoria'],
  }

  if (curatedMap[seed]) {
    return curatedMap[seed]
  }

  // For property listings, use a hash to pick from PROPERTY_PHOTOS
  const hash = hashSeed(seed)
  return PROPERTY_PHOTOS[hash % PROPERTY_PHOTOS.length]
}

function hashSeed(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Real human-portrait placeholders for avatars.
 */
export function personPhoto(seed: string, size = 150): string {
  return `https://i.pravatar.cc/${size}?u=${encodeURIComponent(seed)}`
}

/**
 * Returns a property gallery photo for a given listing and photo index.
 */
export function propertyPhoto(listingId: string, index = 0): string {
  const base = hashSeed(listingId + String(index))
  return PROPERTY_PHOTOS[base % PROPERTY_PHOTOS.length]
}
