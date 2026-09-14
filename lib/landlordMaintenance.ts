import { LANDLORD_TENANTS } from './landlordTenants'

export type LandlordMaintenanceStatus = 'New' | 'Assigned' | 'In Progress' | 'Resolved'

export interface LandlordMaintenanceTicket {
  id: string
  title: string
  tenantName: string
  propertyTitle: string
  status: LandlordMaintenanceStatus
  submittedOn: string
  provider?: string
}

const PROVIDERS = ['Yared Plumbing Co.', 'Addis Electric Services', 'Habesha Home Repairs']

/** Mock data standing in for FR-09's landlord-side maintenance workflow until the real service exists. */
export const LANDLORD_MAINTENANCE_TICKETS: LandlordMaintenanceTicket[] = [
  { id: 'MT-3311', title: 'Bathroom sink leaking', tenantName: LANDLORD_TENANTS[0]?.name ?? 'Samuel K.', propertyTitle: LANDLORD_TENANTS[0]?.propertyTitle ?? '2 Bedroom Apartment', status: 'In Progress', submittedOn: 'May 10, 2026', provider: PROVIDERS[0] },
  { id: 'MT-3305', title: 'Broken window latch', tenantName: LANDLORD_TENANTS[1]?.name ?? 'Makdes T.', propertyTitle: LANDLORD_TENANTS[1]?.propertyTitle ?? '3 Bedroom House', status: 'Assigned', submittedOn: 'May 8, 2026', provider: PROVIDERS[2] },
  { id: 'MT-3299', title: 'Circuit breaker tripping', tenantName: LANDLORD_TENANTS[2]?.name ?? 'Bethlehem A.', propertyTitle: LANDLORD_TENANTS[2]?.propertyTitle ?? 'Apartment', status: 'New', submittedOn: 'May 9, 2026' },
  { id: 'MT-3270', title: 'Kitchen light flickering', tenantName: LANDLORD_TENANTS[0]?.name ?? 'Samuel K.', propertyTitle: LANDLORD_TENANTS[0]?.propertyTitle ?? '2 Bedroom Apartment', status: 'Resolved', submittedOn: 'Mar 15, 2026', provider: PROVIDERS[1] },
]

export const LANDLORD_MAINT_STATUS_CLASS: Record<LandlordMaintenanceStatus, string> = {
  New: 'bg-sand text-charcoal/70',
  Assigned: 'bg-gold/15 text-gold',
  'In Progress': 'bg-gold/15 text-gold',
  Resolved: 'bg-verified/10 text-verified',
}

export const MAINTENANCE_PROVIDERS = PROVIDERS
