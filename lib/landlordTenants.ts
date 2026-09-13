import { personPhoto } from './images'
import { LANDLORD_PROPERTIES } from './landlord'

export interface LandlordTenant {
  id: string
  name: string
  avatar: string
  propertyTitle: string
  leaseEnds: string
  collectionRate: number
  phone: string
  email: string
}

const occupied = LANDLORD_PROPERTIES.filter((p) => p.status === 'occupied')

/** Mock data standing in for FR-07's tenant CRM directory until the real service exists. */
export const LANDLORD_TENANTS: LandlordTenant[] = occupied.map((p, i) => ({
  id: `TEN-${1000 + i}`,
  name: p.tenantName ?? 'Tenant',
  avatar: personPhoto(`tenant-${p.tenantName ?? p.id}`),
  propertyTitle: p.title,
  leaseEnds: ['May 1, 2027', 'Feb 1, 2027', 'Nov 10, 2026', 'Jan 20, 2027', 'Sep 3, 2026'][i % 5],
  collectionRate: p.collectionRate ?? 100,
  phone: `+251 9${(10 + i).toString().padStart(2, '0')} ${(100000 + i * 1234).toString().slice(0, 6)}`,
  email: `${(p.tenantName ?? 'tenant').toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
}))
