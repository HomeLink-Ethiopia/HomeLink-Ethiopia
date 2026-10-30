'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { VERIFICATION_QUEUE, RISK_BADGE_CLASS, RISK_LABEL } from '@/lib/admin'
import InitialsAvatar from '@/components/shared/InitialsAvatar'

const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const

export interface QueueItem {
  id: string
  title: string
  subtitle: string
  avatar: string
  risk: 'high' | 'medium' | 'low'
  timeAgo: string
  type: string
}

export default function VerificationQueue({ items }: { items?: QueueItem[] }) {
  const isLive = items !== undefined
  const source = isLive ? items : VERIFICATION_QUEUE
  const sorted = [...source].sort((a, b) => {
    const orderA = RISK_ORDER[a?.risk] ?? 2
    const orderB = RISK_ORDER[b?.risk] ?? 2
    return orderA - orderB
  })

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-charcoal">Verification Queue</h2>
        <Link href="/admin/verification-queue" className="text-sm font-medium text-rust hover:text-rust-dark">
          View all &rsaquo;
        </Link>
      </div>

      <div className="mt-3 divide-y divide-charcoal/10">
        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-charcoal/50">
            All landlord and property verifications have been processed. Queue is clear!
          </div>
        ) : (
          sorted.map((item, i) => {
            const riskKey = item.risk && RISK_LABEL[item.risk] ? item.risk : 'low'
            return (
              <motion.div
                key={item.id ? `${item.id}-${i}` : `q-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }}
                className="flex items-center gap-3 py-3"
              >
                <InitialsAvatar name={item.title || 'User'} size={40} className="bg-sand" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-charcoal/40">{item.id || 'ID'}</span>
                    <span className="truncate text-sm font-medium text-charcoal">{item.title || 'Verification Request'}</span>
                  </div>
                  <p className="text-xs text-charcoal/50">{item.subtitle || 'Pending review'}</p>
                </div>

                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${RISK_BADGE_CLASS[riskKey] || RISK_BADGE_CLASS.low}`}>
                  {RISK_LABEL[riskKey] || 'Low Risk'}
                </span>

                <span className="w-16 shrink-0 text-right text-xs text-charcoal/40">{item.timeAgo || 'Pending'}</span>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
