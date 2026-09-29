'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { VERIFICATION_PROGRESS, VERIFICATION_PROGRESS_CHART } from '@/lib/admin'

interface Slice {
  name: string
  value: number
  color?: string
}

export interface VerificationProgressData {
  slices?: Slice[]
}

const FALLBACK = VERIFICATION_PROGRESS_CHART

/**
 * Verification Progress donut. `slices` (live counts from
 * GET /api/v1/admin/analytics) overrides the static demo constants;
 * colors are matched to the slice name.
 */
export default function VerificationProgress({ slices }: VerificationProgressData) {
  const COLORS: Record<string, string> = {
    verified: '#16a34a',
    Verified: '#16a34a',
    pending: '#f59e0b',
    Pending: '#f59e0b',
    submitted: '#f59e0b',
    rejected: '#dc2626',
    Rejected: '#dc2626',
    suspended: '#dc2626',
    unverified: '#a8a29e',
  }

  const raw: Slice[] = (slices && slices.length > 0 ? slices : FALLBACK).map((s) => ({
    ...s,
    color: COLORS[s.name] || s.color || '#a8a29e',
  }))
  const data = raw.filter((s) => s.value > 0)
  const total = raw.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <h2 className="font-display text-lg font-semibold text-charcoal">Verification Progress</h2>

      <div className="mt-2 flex items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.4 } }}
          className="relative h-36 w-36 shrink-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.length > 0 ? data : FALLBACK}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {(data.length > 0 ? data : FALLBACK).map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-semibold text-charcoal">{total || VERIFICATION_PROGRESS.total}</span>
            <span className="text-xs text-charcoal/50">Total</span>
          </div>
        </motion.div>

        <ul className="flex-1 space-y-2.5 text-sm">
          {raw.map((entry) => (
            <li key={entry.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 capitalize text-charcoal/70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="font-medium text-charcoal">({entry.value})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
