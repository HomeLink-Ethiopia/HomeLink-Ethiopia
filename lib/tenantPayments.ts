export type PaymentStatus = 'Paid' | 'Due' | 'Overdue'

export interface LedgerEntry {
  id: string
  month: string
  amountEtb: number
  status: PaymentStatus
  paidOn?: string
  method?: 'Telebirr' | 'CBE Birr' | 'Bank Transfer'
}

/** Mock ledger standing in for FR-08 (rent management) until the real payments service exists. */
export const TENANT_LEDGER: LedgerEntry[] = [
  { id: 'PMT-2606', month: 'June 2026', amountEtb: 18000, status: 'Due' },
  { id: 'PMT-2605', month: 'May 2026', amountEtb: 18000, status: 'Paid', paidOn: 'Apr 30, 2026', method: 'Telebirr' },
  { id: 'PMT-2604', month: 'April 2026', amountEtb: 18000, status: 'Paid', paidOn: 'Mar 30, 2026', method: 'Telebirr' },
  { id: 'PMT-2603', month: 'March 2026', amountEtb: 18000, status: 'Paid', paidOn: 'Feb 28, 2026', method: 'CBE Birr' },
  { id: 'PMT-2602', month: 'February 2026', amountEtb: 18000, status: 'Paid', paidOn: 'Jan 30, 2026', method: 'Bank Transfer' },
]

export const PAYMENT_STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  Paid: 'bg-verified/10 text-verified',
  Due: 'bg-gold/15 text-gold',
  Overdue: 'bg-rust/10 text-rust',
}

export function balanceSummary() {
  const due = TENANT_LEDGER.filter((e) => e.status !== 'Paid').reduce((sum, e) => sum + e.amountEtb, 0)
  const paidThisYear = TENANT_LEDGER.filter((e) => e.status === 'Paid').reduce((sum, e) => sum + e.amountEtb, 0)
  return { due, paidThisYear }
}
