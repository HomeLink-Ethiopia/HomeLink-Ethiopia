'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ADMIN_AVATAR, ADMIN_NAME } from '@/lib/admin'
import { useUIStore } from '@/lib/store'

const PERIODS = ['Today', 'This Week', 'This Month', 'Last 6 Months'] as const

export default function TopBar({ title, defaultPeriod = 'This Month' }: { title: string; defaultPeriod?: (typeof PERIODS)[number] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(defaultPeriod)
  const [open, setOpen] = useState(false)
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
        <h1 className="truncate font-display text-xl font-semibold text-charcoal sm:text-2xl">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded border border-charcoal/15 bg-white px-3 py-1.5 text-sm text-charcoal"
          >
            {period}
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-charcoal/50">
              <path d="M5.5 7.5l4.5 4.5 4.5-4.5" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded border border-charcoal/10 bg-white shadow-stamp">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriod(p)
                    setOpen(false)
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-sand ${p === period ? 'text-rust' : 'text-charcoal'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="relative text-charcoal/70 hover:text-rust" aria-label="Notifications">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
            <path d="M5 8a5 5 0 0110 0c0 3 1 4 1 4H4s1-1 1-4zM8 15a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rust" />
        </button>

        <span className="relative h-8 w-8 overflow-hidden rounded-full">
          <Image src={ADMIN_AVATAR} alt={ADMIN_NAME} fill sizes="32px" className="object-cover" />
        </span>
      </div>
    </div>
  )
}
