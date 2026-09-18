'use client'

import { useUIStore } from '@/lib/store'
import NotificationBell from '@/components/shared/NotificationBell'
import UserChip from '@/components/shared/UserChip'

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
        <NotificationBell />

        <UserChip />
      </div>
    </div>
  )
}
