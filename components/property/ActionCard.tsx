'use client'

import { useState } from 'react'
import { useUIStore } from '@/lib/store'

interface ActionCardProps {
  propertyId: string
  propertyTitle: string
  priceEtb: number
  depositEtb: number
}

export default function ActionCard({ propertyId, propertyTitle, priceEtb, depositEtb }: ActionCardProps) {
  const [saved, setSaved] = useState(false)
  const openModal = useUIStore((s) => s.openModal)

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-sm">
      <div className="text-center">
        <p className="font-display text-4xl font-bold text-rust">
          ETB {priceEtb.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-charcoal/60">/ month</p>
        <p className="mt-2 text-sm text-charcoal/70">
          Deposit: <span className="font-semibold">ETB {depositEtb.toLocaleString()}</span>
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => openModal('application', { propertyId, propertyTitle })}
          className="w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-rust-dark hover:shadow-md active:scale-[0.98]"
        >
          Apply Now
        </button>
        
        <button
          type="button"
          onClick={() => openModal('viewing', { propertyId, propertyTitle })}
          className="w-full rounded-lg border-2 border-charcoal/15 px-5 py-3 text-sm font-bold text-charcoal transition-all hover:border-rust hover:text-rust active:scale-[0.98]"
        >
          Schedule Viewing
        </button>

        <button
          type="button"
          onClick={() => setSaved((s) => !s)}
          aria-pressed={saved}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-charcoal/15 px-5 py-3 text-sm font-semibold text-charcoal transition-all hover:border-rust hover:text-rust"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={saved ? 0 : 1.5}
          >
            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
          </svg>
          {saved ? 'Saved' : 'Save Property'}
        </button>
      </div>
    </div>
  )
}
