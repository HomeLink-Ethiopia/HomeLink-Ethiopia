'use client'

import Image from 'next/image'
import { LANDLORD_AVATAR, LANDLORD_NAME } from '@/lib/landlord'
import { useUIStore } from '@/lib/store'

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <div className="flex items-center justify-between gap-3 border-b border-charcoal/10 bg-cream px-4 py-5 sm:gap-6 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="shrink-0 rounded p-1.5 text-charcoal/70 hover:bg-sand hover:text-charcoal lg:hidden"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold text-charcoal sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 hidden text-sm text-charcoal/60 sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <button type="button" className="relative text-charcoal/70 hover:text-rust" aria-label="Notifications">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
            <path d="M5 8a5 5 0 0110 0c0 3 1 4 1 4H4s1-1 1-4zM8 15a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rust" />
        </button>

        <div className="flex items-center gap-2">
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
            <Image src={LANDLORD_AVATAR} alt={LANDLORD_NAME} fill sizes="32px" className="object-cover" />
          </span>
          <span className="hidden text-sm font-medium text-charcoal sm:inline">{LANDLORD_NAME}</span>
        </div>
      </div>
    </div>
  )
}
