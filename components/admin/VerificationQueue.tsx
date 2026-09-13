'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { VERIFICATION_QUEUE, RISK_BADGE_CLASS, RISK_LABEL } from '@/lib/admin'

const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const

export default function VerificationQueue() {
  const sorted = [...VERIFICATION_QUEUE].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-charcoal">Verification Queue</h2>
        <Link href="/admin/verification-queue" className="text-sm font-medium text-rust hover:text-rust-dark">
          View all &rsaquo;
        </Link>
      </div>

      <div className="mt-3 divide-y divide-charcoal/10">
        {sorted.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }}
            className="flex items-center gap-3 py-3"
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
              <Image src={item.avatar} alt={item.title} fill sizes="40px" className="object-cover" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-charcoal/40">{item.id}</span>
                <span className="truncate text-sm font-medium text-charcoal">{item.title}</span>
              </div>
              <p className="text-xs text-charcoal/50">{item.subtitle}</p>
            </div>

            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${RISK_BADGE_CLASS[item.risk]}`}>
              {RISK_LABEL[item.risk]}
            </span>

            <span className="w-16 shrink-0 text-right text-xs text-charcoal/40">{item.timeAgo}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
