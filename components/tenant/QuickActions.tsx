'use client'

import Link from 'next/link'
import { useUIStore } from '@/lib/store'

const ACTIONS = [
  { label: 'Pay Rent', icon: 'M3 6h14v9H3zM3 9h14M6 12h3', href: '/tenant/payments' },
  { label: 'Request Maintenance', icon: 'M12 4a4 4 0 00-5 5l-6 6 3 3 6-6a4 4 0 005-5l-3 3-2-2 3-3z', modal: 'maintenance' as const },
  { label: 'Messages', icon: 'M3 5h14v10H3zM3 5l7 6 7-6', href: '/tenant/messages' },
  { label: 'View Invoices', icon: 'M5 2h7l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1zM7 8h6M7 11h6M7 14h4', href: '/tenant/payments' },
] as const

export default function QuickActions() {
  const openModal = useUIStore((s) => s.openModal)

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-charcoal">Quick Actions</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => {
          const content = (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rust/10 text-rust">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
                  <path d={action.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-medium text-charcoal">{action.label}</span>
            </>
          )
          const className =
            'flex flex-col items-center justify-center gap-3 rounded-lg border border-charcoal/10 bg-white px-3 py-6 text-center transition-colors hover:border-rust hover:bg-rust/5'

          if ('modal' in action) {
            return (
              <button key={action.label} type="button" onClick={() => openModal(action.modal)} className={className}>
                {content}
              </button>
            )
          }
          return (
            <Link key={action.label} href={action.href} className={className}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
