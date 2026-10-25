'use client'

import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/motion'
import type { KpiStat } from '@/lib/admin'

const ICONS: Record<string, string> = {
  queue: 'M5 3h9l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM11 3v4h4M7 12l2 2 4-4',
  fraud: 'M10 2l8 4v5c0 4.4-3.4 7.8-8 9-4.6-1.2-8-4.6-8-9V6l8-4zM10 6v4M10 12.5v.1',
  scale: 'M10 2v14M5 5l-3 5.5a2.5 2.5 0 005 0L5 5zM15 5l-3 5.5a2.5 2.5 0 005 0L15 5zM5 5h10M6 18h8',
  verified: 'M10 2l1.9 1.4 2.3-.4 1 2.1 2.1 1-.4 2.3L18 10l-1.4 1.9.4 2.3-2.1 1-1 2.1-2.3-.4L10 18l-1.9-1.4-2.3.4-1-2.1-2.1-1 .4-2.3L2 10l1.4-1.9-.4-2.3 2.1-1 1-2.1 2.3.4L10 2zM7 10l2 2 4-4.5',
}

export default function KpiCard({ stat, icon, index }: { stat: KpiStat; icon: keyof typeof ICONS; index: number }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.06 }}
      className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded bg-rust-tint text-rust-dark">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-[18px] w-[18px]">
            <path d={ICONS[icon]} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            stat.deltaDirection === 'up' ? 'bg-verified/10 text-verified' : 'bg-rust/10 text-rust'
          }`}
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className={`h-3 w-3 ${stat.deltaDirection === 'down' ? 'rotate-180' : ''}`}>
            <path d="M6 2l4 5H2z" />
          </svg>
          {stat.deltaLabel}
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold text-charcoal">{stat.value}</p>
      <p className="mt-1 text-sm text-charcoal/60">{stat.label}</p>
    </motion.div>
  )
}
