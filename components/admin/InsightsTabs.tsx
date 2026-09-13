'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { INSIGHTS_TABS, type InsightsTab } from '@/lib/marketInsights'
import HeadlineStatCard from './HeadlineStatCard'
import RentTrendChart from './RentTrendChart'
import DemandSupplyChart from './DemandSupplyChart'
import NeighborhoodDemand from './NeighborhoodDemand'
import PropertyTypeDistribution from './PropertyTypeDistribution'
import { MARKET_HEADLINE_STATS } from '@/lib/marketInsights'

export default function InsightsTabs() {
  const [tab, setTab] = useState<InsightsTab>('Overview')

  return (
    <div>
      <div className="flex gap-6 overflow-x-auto border-b border-charcoal/10">
        {INSIGHTS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative whitespace-nowrap pb-3 text-sm font-medium uppercase tracking-wide transition-colors ${
              tab === t ? 'text-rust' : 'text-charcoal/50 hover:text-charcoal'
            }`}
          >
            {t}
            {tab === t && <motion.span layoutId="insights-tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-rust" />}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MARKET_HEADLINE_STATS.map((stat, i) => (
              <HeadlineStatCard key={stat.label} stat={stat} index={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RentTrendChart />
            <DemandSupplyChart />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NeighborhoodDemand />
            <PropertyTypeDistribution />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-charcoal/15 bg-white/60 p-10 text-center">
          <p className="text-sm text-charcoal/60">
            The <span className="font-medium text-charcoal">{tab}</span> breakdown isn't built yet — Overview covers
            the core Housing Analytics requirement for now.
          </p>
        </div>
      )}
    </div>
  )
}
