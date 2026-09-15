'use client'

import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/motion'
import type { HeadlineStat } from '@/lib/marketInsights'

export default function HeadlineStatCard({ stat, index }: { stat: HeadlineStat; index: number }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.06 }}
      className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp"
    >
      <p className="text-sm text-charcoal/60">{stat.label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-charcoal">{stat.value}</p>
      <p className={`mt-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
        stat.deltaDirection === 'up' ? 'bg-verified/10 text-verified' : 'bg-rust/10 text-rust'
      }`}>
        <svg viewBox="0 0 12 12" fill="currentColor" className={`h-3 w-3 ${stat.deltaDirection === 'down' ? 'rotate-180' : ''}`}>
          <path d="M6 2l4 5H2z" />
        </svg>
        {stat.deltaLabel}
      </p>
    </motion.div>
  )
}
