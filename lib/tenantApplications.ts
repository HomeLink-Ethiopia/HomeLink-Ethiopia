import { PROPERTIES } from './properties'

export type ApplicationStatus = 'Submitted' | 'Under Review' | 'Info Requested' | 'Approved' | 'Rejected'

export interface TenantApplication {
  id: string
  property: (typeof PROPERTIES)[number]
  status: ApplicationStatus
  submittedOn: string
  updatedOn: string
  note?: string
}

/** Mock data standing in for FR-06 (application tracking) until the real service exists. */
export const TENANT_APPLICATIONS: TenantApplication[] = [
  {
    id: 'APP-2201',
    property: PROPERTIES[2],
    status: 'Under Review',
    submittedOn: 'May 2, 2026',
    updatedOn: 'May 6, 2026',
    note: 'Landlord is reviewing your documents.',
  },
  {
    id: 'APP-2187',
    property: PROPERTIES[4],
    status: 'Info Requested',
    submittedOn: 'Apr 20, 2026',
    updatedOn: 'Apr 24, 2026',
    note: 'Please upload a recent proof of income.',
  },
  {
    id: 'APP-2140',
    property: PROPERTIES[0],
    status: 'Approved',
    submittedOn: 'Mar 1, 2026',
    updatedOn: 'Mar 10, 2026',
    note: 'Lease signed — this is your Current Home.',
  },
  {
    id: 'APP-2098',
    property: PROPERTIES[6],
    status: 'Rejected',
    submittedOn: 'Feb 10, 2026',
    updatedOn: 'Feb 15, 2026',
    note: 'Unit was rented to another applicant.',
  },
]

export const STATUS_BADGE_CLASS: Record<ApplicationStatus, string> = {
  Submitted: 'bg-sand text-charcoal/70',
  'Under Review': 'bg-gold/15 text-gold',
  'Info Requested': 'bg-rust-tint text-rust-dark',
  Approved: 'bg-verified/10 text-verified',
  Rejected: 'bg-charcoal/10 text-charcoal/50',
}
