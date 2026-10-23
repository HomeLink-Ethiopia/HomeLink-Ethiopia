'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { RISK_LEVEL_DISTRIBUTION } from '@/lib/admin'

export interface RiskSlice {
  name: string
  pct: number
  color?: string
}

const COLORS: Record<string, string> = {
  High: '#dc2626',
  Medium: '#f59e0b',
  Low: '#16a34a',
}

/**
 * Risk level distribution across properties. `slices` (computed live from
 * GET /api/v1/admin/analytics propertiesByRisk) overrides the static demo
 * constants.
 */
export default function RiskLevelDistribution({ slices }: { slices?: RiskSlice[] }) {
  const data: RiskSlice[] =
    slices && slices.length > 0
      ? slices.map((s) => ({ ...s, color: s.color || COLORS[s.name] || '#a8a29e' }))
      : RISK_LEVEL_DISTRIBUTION

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <h2 className="font-display text-lg font-semibold text-charcoal">Risk Level Distribution</h2>

      <div className="mt-2 flex items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.4 } }}
          className="h-32 w-32 shrink-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="pct"
                nameKey="name"
                innerRadius="60%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color || COLORS[entry.name] || '#a8a29e'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <ul className="flex-1 space-y-2.5 text-sm">
          {data.map((entry) => (
            <li key={entry.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-charcoal/70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color || COLORS[entry.name] }} />
                {entry.name}
              </span>
              <span className="font-medium text-charcoal">{entry.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
