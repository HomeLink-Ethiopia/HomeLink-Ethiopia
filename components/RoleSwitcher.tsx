'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/types/roles'

const ROLES: { role: Role; label: string; email: string; password: string }[] = [
  { role: 'tenant', label: 'Tenant', email: 'tenant@test.com', password: 'Password123!' },
  { role: 'landlord', label: 'Landlord', email: 'landlord@test.com', password: 'Password123!' },
  { role: 'admin', label: 'Admin', email: 'admin@test.com', password: 'Password123!' },
]

/**
 * Testing-only affordance: lets anyone jump between the three role
 * trees without a real login flow. This should be removed (or gated
 * behind a dev-only env flag) once FR-01 auth actually exists —
 * it's deliberately unstyled-corporate/small so it reads as a dev
 * tool, not a product feature.
 */
export default function RoleSwitcher() {
  const { user, login } = useAuth()
  const [open, setOpen] = useState(true)

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-charcoal/15 bg-white/95 px-1.5 py-1.5 shadow-stamp backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-charcoal/40 hover:text-charcoal"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-verified" />
          Dev
        </button>

        {open &&
          ROLES.map(({ role, label, email, password }) => (
            <button
              key={role}
              type="button"
              onClick={() => login(email, password)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                user?.role === role
                  ? 'bg-rust text-white'
                  : 'text-charcoal/70 hover:bg-sand hover:text-charcoal'
              }`}
            >
              {label}
            </button>
          ))}

        {open && user && (
          <span className="pr-2 font-mono text-[10px] text-charcoal/40">as {user.name}</span>
        )}
      </div>
    </div>
  )
}
