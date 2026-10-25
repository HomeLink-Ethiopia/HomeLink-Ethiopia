'use client'

import { motion } from 'framer-motion'
import { FRAUD_REPORTS_BY_TYPE } from '@/lib/admin'

export interface FraudRow {
  type: string
  count: number
}

const TYPE_LABELS: Record<string, string> = {
  fake_listing: 'Fake Listing',
  fake_property: 'Fake Property',
  impersonation: 'Fake Landlord',
  fake_landlord: 'Fake Landlord',
  scam: 'Scam',
  duplicate_listing: 'Duplicate Listing',
  suspicious_payment: 'Suspicious Payment',
  image_theft: 'Stolen Photos',
  other: 'Other',
}

/**
 * Fraud reports by type — animated bars. `rows` (live counts from
 * GET /api/v1/admin/analytics) overrides the static demo constants.
 */
export default function FraudReportsByType({ rows }: { rows?: FraudRow[] }) {
  const data: FraudRow[] = (rows && rows.length > 0 ? rows : FRAUD_REPORTS_BY_TYPE).map((r) => ({
    type: TYPE_LABELS[r.type] || r.type,
    count: r.count,
  }))
  const max = Math.max(...data.map((r) => r.count), 1)

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <h2 className="font-display text-lg font-semibold text-charcoal">Fraud Reports by Type</h2>

      <div className="mt-5 space-y-4">
        {data.map((row, i) => (
          <div key={row.type} className="flex items-center gap-4">
            <span className="w-32 shrink-0 text-sm text-charcoal/70">{row.type}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(row.count / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-rust"
              />
            </div>
            <span className="w-4 shrink-0 text-right text-sm font-medium text-charcoal">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
