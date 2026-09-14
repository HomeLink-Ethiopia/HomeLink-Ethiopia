import { LANDLORD_TENANTS } from './landlordTenants'

export type RentStatus = 'Paid' | 'Due' | 'Overdue'

export interface RentRecord {
  tenantId: string
  tenantName: string
  propertyTitle: string
  amountEtb: number
  status: RentStatus
  dueDate: string
}

/** Mock data standing in for FR-08's landlord-side rent ledger until the real service exists. */
export const LANDLORD_RENT_RECORDS: RentRecord[] = LANDLORD_TENANTS.map((t, i) => ({
  tenantId: t.id,
  tenantName: t.name,
  propertyTitle: t.propertyTitle,
  amountEtb: [18000, 25000, 20000, 22000, 19000][i % 5],
  status: (['Paid', 'Paid', 'Due', 'Overdue', 'Paid'] as RentStatus[])[i % 5],
  dueDate: 'Jun 1, 2026',
}))

export const RENT_STATUS_BADGE_CLASS: Record<RentStatus, string> = {
  Paid: 'bg-verified/10 text-verified',
  Due: 'bg-gold/15 text-gold',
  Overdue: 'bg-rust/10 text-rust',
}

export function collectionSummary() {
  const total = LANDLORD_RENT_RECORDS.reduce((s, r) => s + r.amountEtb, 0)
  const collected = LANDLORD_RENT_RECORDS.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.amountEtb, 0)
  const overdue = LANDLORD_RENT_RECORDS.filter((r) => r.status === 'Overdue').length
  return { total, collected, overdue, rate: total ? Math.round((collected / total) * 100) : 0 }
}
