'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { PROPERTY_TYPE_DISTRIBUTION } from '@/lib/marketInsights'

export default function PropertyTypeDistribution() {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <h2 className="font-display text-lg font-semibold text-charcoal">Property Type Distribution</h2>

      <div className="mt-2 flex items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.4 } }}
          className="relative h-36 w-36 shrink-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={PROPERTY_TYPE_DISTRIBUTION}
                dataKey="pct"
                nameKey="name"
                innerRadius="62%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {PROPERTY_TYPE_DISTRIBUTION.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] leading-tight text-charcoal/50">All<br />Properties</span>
          </div>
        </motion.div>

        <ul className="flex-1 space-y-2.5 text-sm">
          {PROPERTY_TYPE_DISTRIBUTION.map((entry) => (
            <li key={entry.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-charcoal/70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
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
