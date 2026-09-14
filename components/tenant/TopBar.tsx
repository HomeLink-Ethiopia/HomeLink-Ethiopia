'use client'

import Image from 'next/image'
import { personPhoto } from '@/lib/images'
import { useUIStore } from '@/lib/store'
import NotificationBell from '@/components/shared/NotificationBell'

export default function TopBar({ tenantName }: { tenantName: string }) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <div className="flex items-center justify-between gap-4 border-b border-charcoal/10 bg-cream px-4 py-4 sm:px-8 lg:justify-end lg:gap-6">
      <button
        type="button"
        onClick={toggleSidebar}
        className="rounded p-1.5 text-charcoal/70 hover:bg-sand hover:text-charcoal lg:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
        </svg>
      </button>

      <div className="flex items-center gap-4 sm:gap-6">
      <button type="button" className="hidden items-center gap-1.5 text-sm text-charcoal/70 hover:text-rust sm:flex">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <path d="M3 5h14v10H3zM3 5l7 6 7-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Messages
      </button>

      <NotificationBell />

      <button type="button" className="flex items-center gap-2 text-sm font-medium text-charcoal">
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <Image src={personPhoto('tenant-tsedi')} alt={tenantName} fill sizes="32px" className="object-cover" />
        </span>
        <span className="hidden sm:inline">{tenantName}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="hidden h-3.5 w-3.5 text-charcoal/50 sm:block">
          <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
        </svg>
      </button>
      </div>
    </div>
  )
}
