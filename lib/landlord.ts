import { personPhoto } from './images'
import { PROPERTIES } from './properties'

export type PropertyStatus = 'occupied' | 'vacant' | 'maintenance'

export interface LandlordProperty {
  id: string
  title: string
  neighborhood: string
  rentEtb: number
  image: string
  status: PropertyStatus
  /** Occupied only */
  tenantName?: string
  rentedSince?: string
  collectionRate?: number
  /** Vacant only */
  listedOn?: string
  views?: number
  applications?: number
  /** Maintenance only */
  maintenanceNote?: string
  maintenanceSince?: string
}

/**
 * Portfolio metadata for one landlord (Abebe Kebede), layered onto the
 * shared PROPERTIES list from lib/properties.ts (rather than a second,
 * divergent mock dataset) so "View Details" always resolves to a real
 * `/property/[id]` page built in Phase 3.
 */
const PORTFOLIO: Record<string, Omit<LandlordProperty, 'id' | 'title' | 'neighborhood' | 'rentEtb' | 'image'>> = {
  p1: { status: 'occupied', tenantName: 'Samuel K.', rentedSince: 'Mar 15, 2023', collectionRate: 100 },
  p2: { status: 'occupied', tenantName: 'Makdes T.', rentedSince: 'Feb 1, 2023', collectionRate: 100 },
  p3: { status: 'vacant', listedOn: 'May 5, 2023', views: 124, applications: 3 },
  p4: { status: 'occupied', tenantName: 'Bethlehem A.', rentedSince: 'Nov 10, 2022', collectionRate: 92 },
  p5: { status: 'vacant', listedOn: 'Jun 2, 2023', views: 78, applications: 1 },
  p6: { status: 'maintenance', maintenanceNote: 'Plumbing repair — kitchen sink', maintenanceSince: 'Jul 28, 2023' },
  p7: { status: 'occupied', tenantName: 'Yohannes G.', rentedSince: 'Jan 20, 2023', collectionRate: 100 },
  p8: { status: 'vacant', listedOn: 'Jul 12, 2023', views: 41, applications: 0 },
  p9: { status: 'maintenance', maintenanceNote: 'Electrical inspection pending', maintenanceSince: 'Aug 1, 2023' },
  p10: { status: 'occupied', tenantName: 'Ruth M.', rentedSince: 'Sep 3, 2022', collectionRate: 100 },
}

export const LANDLORD_PROPERTIES: LandlordProperty[] = PROPERTIES.map((p) => ({
  id: p.id,
  title: p.title,
  neighborhood: p.neighborhood,
  rentEtb: p.priceEtb,
  image: p.image,
  ...PORTFOLIO[p.id],
}))

export const LANDLORD_NAME = 'Abebe Kebede'
export const LANDLORD_AVATAR = personPhoto('landlord-abebe-kebede')

export function statusCounts() {
  return {
    all: LANDLORD_PROPERTIES.length,
    occupied: LANDLORD_PROPERTIES.filter((p) => p.status === 'occupied').length,
    vacant: LANDLORD_PROPERTIES.filter((p) => p.status === 'vacant').length,
    maintenance: LANDLORD_PROPERTIES.filter((p) => p.status === 'maintenance').length,
  }
}

export const STATUS_LABEL: Record<PropertyStatus, string> = {
  occupied: 'Occupied',
  vacant: 'Vacant',
  maintenance: 'Under Maintenance',
}

export const STATUS_BADGE_CLASS: Record<PropertyStatus, string> = {
  occupied: 'bg-sand text-charcoal/70',
  vacant: 'bg-rust-tint text-rust-dark',
  maintenance: 'bg-charcoal/10 text-charcoal',
}
