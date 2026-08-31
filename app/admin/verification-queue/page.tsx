'use client'

import { useState } from 'react'
import Image from 'next/image'
import TopBar from '@/components/admin/TopBar'
import { VERIFICATION_QUEUE, RISK_BADGE_CLASS, RISK_LABEL, type QueueItem } from '@/lib/admin'

const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const

export default function VerificationQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>(VERIFICATION_QUEUE)
  const [filter, setFilter] = useState<'all' | QueueItem['risk']>('all')

  const sorted = [...queue]
    .filter((item) => filter === 'all' || item.risk === filter)
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])

  function verify(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <>
      <TopBar title="Verification Queue" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        <div className="flex items-center gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                filter === r ? 'bg-rust text-white' : 'bg-white text-charcoal/60 border border-charcoal/10'
              }`}
            >
              {r === 'all' ? 'All' : `${r} risk`}
            </button>
          ))}
        </div>

        <div className="mt-4 divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-white">
          {sorted.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-4">
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-sand">
                <Image src={item.avatar} alt={item.title} fill sizes="44px" className="object-cover" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-charcoal/40">{item.id}</span>
                  <span className="truncate text-sm font-medium text-charcoal">{item.title}</span>
                </div>
                <p className="text-xs text-charcoal/50">{item.subtitle} · {item.type}</p>
              </div>

              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${RISK_BADGE_CLASS[item.risk]}`}>
                {RISK_LABEL[item.risk]}
              </span>

              <span className="w-16 shrink-0 text-right text-xs text-charcoal/40">{item.timeAgo}</span>

              <button
                type="button"
                onClick={() => verify(item.id)}
                className="shrink-0 rounded bg-verified px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Verify
              </button>
            </div>
          ))}
          {sorted.length === 0 ? <p className="p-8 text-center text-sm text-charcoal/40">Nothing in this filter.</p> : null}
        </div>
      </div>
    </>
  )
}
