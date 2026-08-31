'use client'

import { motion } from 'framer-motion'
import { POPULAR_NEIGHBORHOODS } from '@/lib/marketInsights'

export default function NeighborhoodDemand() {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <h2 className="font-display text-lg font-semibold text-charcoal">Popular Neighborhoods by Demand</h2>

      <div className="mt-5 space-y-4">
        {POPULAR_NEIGHBORHOODS.map((row, i) => (
          <div key={row.name} className="flex items-center gap-4">
            <span className="w-24 shrink-0 text-sm text-charcoal/70">{row.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-charcoal"
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-medium text-charcoal">{row.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
