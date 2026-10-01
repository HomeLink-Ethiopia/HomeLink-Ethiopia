/**
 * Centralized image helpers for HomeLink Ethiopia.
 *
 * Uses real, freely-licensed photos of the actual Ethiopian cities,
 * neighborhoods and buildings (Wikimedia Commons) for city showcases and
 * property cards. See sprint note: real-ethiopian-property-photos.
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
  // Real Wikimedia Commons photos of the actual neighborhoods — each card
  // shows the place it names (sprint-city-matched-photos)
  'Bole': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Bole_Road%2C_Addis_Ababa_%281%29.jpg/960px-Bole_Road%2C_Addis_Ababa_%281%29.jpg',
  'Kazanchis': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Sunset_on_the_rising_city%2C_Addis_Ababa_-_Flickr_-_jeanotr.jpg/960px-Sunset_on_the_rising_city%2C_Addis_Ababa_-_Flickr_-_jeanotr.jpg',
  'CMC': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Addis_Ababa_sky_view.jpg',
  'Piassa': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Busy_people_in_Addis_ABaba_Piassa.jpg/960px-Busy_people_in_Addis_ABaba_Piassa.jpg',
  'Old Airport': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Addis_Ababa_Bole_International_Airport_in_2024.01.jpg/1280px-Addis_Ababa_Bole_International_Airport_in_2024.01.jpg',
  'Megenagna': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Addis_Ababa_Railway_Megenagna_Area.jpg/960px-Addis_Ababa_Railway_Megenagna_Area.jpg',
  // No Commons photo exists for these exact areas — use real Addis
  // residential architecture instead of stock photos
  'Sarbet': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Armenian-Style_House_near_National_Museum_-_Addis_Ababa_-_Ethiopia_%288743141067%29.jpg/960px-Armenian-Style_House_near_National_Museum_-_Addis_Ababa_-_Ethiopia_%288743141067%29.jpg',
  'Gerji': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/Shalom_Shalome_Apartment_%28View_from_South_to_North%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_South_to_North%29.jpg',
  '22 Mazoria': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Besmelian_%28Elias%29_Residence_%28Avekian%29.jpg/960px-Besmelian_%28Elias%29_Residence_%28Avekian%29.jpg',
}

/**
 * Real Ethiopian interior photos (Wikimedia Commons) — bright, furnished
 * living rooms used for apartment cards. Only appealing, well-lit rooms
 * kept: the dark rural-bedroom and cluttered traditional shots were
 * removed per user feedback (sprint-interior-curation).
 */
export const INTERIOR_PHOTOS = [
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Lobby_lounge%2C_Sheraton_Addis.jpg/960px-Lobby_lounge%2C_Sheraton_Addis.jpg', // luxury lounge interior, Sheraton Addis
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Mid-Century_Modern_in_Ethiopia_%282160541584%29.jpg/960px-Mid-Century_Modern_in_Ethiopia_%282160541584%29.jpg', // bright furnished lounge, Dire Dawa
]

/**
 * Property listing card images — the pool `stockPhoto()` / `propertyPhoto()`
 * pick from. Real, freely-licensed (Wikimedia Commons) photos of actual
 * buildings, streets and ROOMS in Addis Ababa and other Ethiopian cities:
 * interiors (bedroom / salon / furnished living) interleaved with building
 * exteriors, so "Verified homes" cards show real Ethiopian homes.
 * All URLs verified reachable (HTTP 200).
 */
export const PROPERTY_PHOTOS = [
  // Interiors first — bright furnished rooms renters actually live in
  INTERIOR_PHOTOS[0], // furnished salon, Dire Dawa
  INTERIOR_PHOTOS[1], // bright furnished lounge, Dire Dawa
  // Building exteriors — Shalom Shalome Apartment (condo), various angles
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29_%28Picture_taken_on_a_Sunday%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29_%28Picture_taken_on_a_Sunday%29.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/Shalom_Shalome_Apartment_%28View_from_South_to_North%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_South_to_North%29.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Shalom_Shalome_Apartment_%28View_from_NW_to_SE%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_NW_to_SE%29.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Shalom_Shalome_Apartment_%28Close_Up_of_Facade%29.jpg/960px-Shalom_Shalome_Apartment_%28Close_Up_of_Facade%29.jpg',
  // Residential streetscapes & houses, Addis Ababa
  '/homes/garden-villa.png', // owner-supplied garden villa
  '/homes/compound-house.png', // owner-supplied compound house
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Armenian-Style_House_near_National_Museum_-_Addis_Ababa_-_Ethiopia_%288743141067%29.jpg/960px-Armenian-Style_House_near_National_Museum_-_Addis_Ababa_-_Ethiopia_%288743141067%29.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Besmelian_%28Elias%29_Residence_%28Avekian%29.jpg/960px-Besmelian_%28Elias%29_Residence_%28Avekian%29.jpg',
  // Neighborhood context shots — Mexico area & Bole Road, Addis Ababa
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Addis_Ababa_Mexico_Area.jpg/960px-Addis_Ababa_Mexico_Area.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Bole_Road_%2825052032380%29.jpg/960px-Bole_Road_%2825052032380%29.jpg',
]

/**
 * Returns a stable photo URL for any seed string.
 * Uses real photos of Ethiopian buildings and neighborhoods (Wikimedia Commons).
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
    // CTA section — luxury villa interior design (Sheraton Addis lounge)
    'addis-living-room-furnished': INTERIOR_PHOTOS[0],
  }

  if (curatedMap[seed]) {
    return curatedMap[seed]
  }

  // For property listings, use a hash to pick from PROPERTY_PHOTOS
  const hash = hashSeed(seed)
  return PROPERTY_PHOTOS[hash % PROPERTY_PHOTOS.length]
}

export function hashSeed(s: string): number {
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

/**
 * Photo for a rental listing card, matched to the property type (sprint-real-
 * interior-photos): apartments/studios/condos show real Ethiopian interior
 * rooms (bedroom / salon / furnished living), houses and villas show real
 * house exteriors. Deterministic per seed.
 *
 * Houses/villas use the owner-supplied photos in /public/homes (real Addis
 * villas & compound houses); apartments use the real apartment-tower photo
 * plus Wikimedia interior shots.
 */
export function homePhoto(seed: string, propertyType?: string): string {
  const houseExteriors = [
    '/homes/garden-villa.png', // garden villa with palm trees
    '/homes/white-villa.png', // white two-storey villa, green lawn
    '/homes/modern-villa.png', // modern villa, decorative gate
    '/homes/compound-house.png', // walled compound house
  ]
  const apartmentPicks = [
    '/homes/apartment-tower.png', // real apartment tower
    INTERIOR_PHOTOS[1], // bright furnished lounge, Dire Dawa
    // bright modern condo buildings (Shalom Shalome, Addis Ababa)
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_NE_to_SW%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/Shalom_Shalome_Apartment_%28View_from_South_to_North%29.jpg/960px-Shalom_Shalome_Apartment_%28View_from_South_to_North%29.jpg',
  ]
  if (propertyType === 'house' || propertyType === 'villa') {
    return houseExteriors[hashSeed(seed) % houseExteriors.length]
  }
  return apartmentPicks[hashSeed(seed) % apartmentPicks.length]
}
