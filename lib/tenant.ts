import { PROPERTIES } from './properties'

export interface MaintenanceTrackerItem {
  id: string
  title: string
  status: 'Submitted' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed'
  date: string
}

/**
 * Mock data standing in for FR-08 (rent management) and FR-09
 * (maintenance) records until those services exist. Shaped to match
 * the uploaded Tenant.jpg reference exactly — swap for the real
 * tenancy/payment/maintenance APIs when they land.
 */
export const MOCK_TENANT = {
  name: 'Tsedi',
  currentHome: {
    property: PROPERTIES[0],
    leaseEnds: 'May 1, 2026',
    status: 'Active' as const,
  },
  nextPayment: {
    amountEtb: PROPERTIES[0].priceEtb,
    dueInDays: 15,
  },
  lastPayment: {
    month: 'April 2026',
    amountEtb: PROPERTIES[0].priceEtb,
    paidOn: 'Apr 30, 2026',
  },
  maintenanceRequests: [
    { id: 'm1', title: 'Bathroom sink leaking', status: 'In Progress', date: 'May 10, 2026' },
    { id: 'm2', title: 'Fix door lock', status: 'Resolved', date: 'Apr 25, 2026' },
  ] as MaintenanceTrackerItem[],
  recommended: PROPERTIES.slice(1, 4),
}
