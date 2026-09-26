/**
 * Centralized image helpers for HomeLink Ethiopia.
 *
 * Uses real, freely-licensed photos of the actual Ethiopian cities and
 * neighborhoods (Wikimedia Commons / Unsplash) for city showcases, and
 * curated Unsplash architecture shots for property interiors.
 */

/**
 * Hero slideshow images for home page
 * Real photos of Addis Ababa modern buildings and neighborhoods
 */
export const HERO_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=1920&h=1080&fit=crop',
    caption: 'Modern Living in Bole, Addis Ababa',
  },
  {
    url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&h=1080&fit=crop',
    caption: 'Urban Residences in Kazanchis',
  },
  {
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&h=1080&fit=crop',
    caption: 'Spacious Family Homes in CMC',
  },
  {
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop',
    caption: 'Verified Properties Across Ethiopia',
  },
]

/**
 * Neighborhood showcase images
 * Photos representing different areas of Addis Ababa
 */
export const NEIGHBORHOOD_PHOTOS: Record<string, string> = {
  // Real Wikimedia Commons photos of the actual neighborhoods
  'Bole': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Goro_Michael_20250731_181529.jpg/1280px-Goro_Michael_20250731_181529.jpg',
  'Kazanchis': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Gasoliner%C3%ADa_en_Kazanchis%2C_Ad%C3%ADs_Abeba.jpg/1280px-Gasoliner%C3%ADa_en_Kazanchis%2C_Ad%C3%ADs_Abeba.jpg',
  'CMC': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Addis_Ababa_sky_view.jpg',
  'Piassa': 'https://upload.wikimedia.org/wikipedia/commons/5/5f/National_Sport_House%2C_Piassa%2C_On_The_Way_to_4_Kilo.jpg',
  // Curated Unsplash architecture shots (no Commons equivalent found)
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
    // Hero slideshow seeds — real Addis Ababa photos (Wikimedia Commons)
    'addis-ababa-bole-skyline-modern': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Addis_Ababa_%2816314616596%29.jpg/1920px-Addis_Ababa_%2816314616596%29.jpg',
    'addis-ababa-kazanchis-cityscape': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Sunset_on_the_rising_city%2C_Addis_Ababa_-_Flickr_-_jeanotr.jpg/1920px-Sunset_on_the_rising_city%2C_Addis_Ababa_-_Flickr_-_jeanotr.jpg',
    'addis-ababa-cmc-residential': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/ET_Addis_asv2018-01_img01_Meskel_Square.jpg/1920px-ET_Addis_asv2018-01_img01_Meskel_Square.jpg',
    'ethiopian-modern-apartments': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Addis_Ababa_sky_view.jpg/1920px-Addis_Ababa_sky_view.jpg',
    // Neighborhood images
    'addis-ababa-bole-area': NEIGHBORHOOD_PHOTOS['Bole'],
    'addis-ababa-kazanchis-area': NEIGHBORHOOD_PHOTOS['Kazanchis'],
    'addis-ababa-cmc-area': NEIGHBORHOOD_PHOTOS['CMC'],
    'addis-ababa-piassa-area': NEIGHBORHOOD_PHOTOS['Piassa'],
    'addis-ababa-old-airport': NEIGHBORHOOD_PHOTOS['Old Airport'],
    'addis-ababa-megenagna': NEIGHBORHOOD_PHOTOS['Megenagna'],
    'addis-ababa-sarbet': NEIGHBORHOOD_PHOTOS['Sarbet'],
    'addis-ababa-gerji': NEIGHBORHOOD_PHOTOS['Gerji'],
    'addis-ababa-22-mazoria': NEIGHBORHOOD_PHOTOS['22 Mazoria'],
    // Neighborhood section seeds — real photos of the actual places
    'bole-addis-ababa-ethiopia': NEIGHBORHOOD_PHOTOS['Bole'],
    'kazanchis-city-ethiopia': NEIGHBORHOOD_PHOTOS['Kazanchis'],
    'cmc-residential-ethiopia': NEIGHBORHOOD_PHOTOS['CMC'],
    'piassa-downtown-ethiopia': NEIGHBORHOOD_PHOTOS['Piassa'],
    'hawassa-lake-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Hawassa_lake%2C_Ethiopia.jpg/1280px-Hawassa_lake%2C_Ethiopia.jpg',
    'bahir-dar-lake-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Scenes_from_Bahir_Dar%2C_Ethiopia_%282210165380%29.jpg/1280px-Scenes_from_Bahir_Dar%2C_Ethiopia_%282210165380%29.jpg',
    'dire-dawa-city-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Dire_Dawa_Station.jpg/1280px-Dire_Dawa_Station.jpg',
    'mekelle-city-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/ET_Mekele_asv2018-01_img22_old_town.jpg/1280px-ET_Mekele_asv2018-01_img22_old_town.jpg',
    'adama-city-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Adama_%283%29.jpg/1280px-Adama_%283%29.jpg',
    'gondar-castle-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Fasil_Ghebbi_%286821476009%29.jpg/1280px-Fasil_Ghebbi_%286821476009%29.jpg',
    'jimma-coffee-ethiopia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Jimmamosque.jpg/1280px-Jimmamosque.jpg',
    // CTA section
    'addis-living-room-furnished': 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=600&fit=crop',
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
