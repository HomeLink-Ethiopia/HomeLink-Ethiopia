'use client'

import { useUIStore } from '@/lib/store'
import NotificationBell from '@/components/shared/NotificationBell'
import UserChip from '@/components/shared/UserChip'

export default function TopBar({ /* tenantName kept for compat, unused */ }: { tenantName?: string }) {
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

      <UserChip />
      </div>
    </div>
  )
}
