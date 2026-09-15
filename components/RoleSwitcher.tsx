'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/types/roles'

// Real accounts seeded in the team's MongoDB (see backend/scripts/seed-dev-accounts.js).
// Password for all three: Password123!
const ROLES: { role: Role; label: string; email: string }[] = [
  { role: 'tenant', label: 'Tenant', email: 'dev.tenant@homelink.test' },
  { role: 'landlord', label: 'Landlord', email: 'dev.landlord@homelink.test' },
  { role: 'admin', label: 'Admin', email: 'dev.admin@homelink.test' },
]

/**
 * Testing-only affordance: lets a developer jump between the three role
 * dashboards using three real seeded accounts (tenant / landlord / admin).
 * The accounts exist in the team's MongoDB, so everything downstream —
 * JWT, role middleware, dashboards — behaves exactly like a real login.
 */
export default function RoleSwitcher() {
  const { user, login } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const switchTo = async (label: string, email: string) => {
    setBusy(label)
    setErr('')
    const result = await login(email, 'Password123!')
    setBusy(null)
    if (!result.success) {
      setErr(result.error || 'Login failed')
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2">
      <div className="flex flex-col items-center gap-1">
        {err && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600 shadow-sm">
            {err}
          </span>
        )}
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
            ROLES.map(({ role, label, email }) => (
              <button
                key={role}
                type="button"
                disabled={busy !== null}
                onClick={() => switchTo(label, email)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  user?.role === role
                    ? 'bg-rust text-white'
                    : 'text-charcoal/70 hover:bg-sand hover:text-charcoal'
                }`}
              >
                {busy === label ? '…' : label}
              </button>
            ))}

          {open && user && (
            <span className="pr-2 font-mono text-[10px] text-charcoal/40">as {user.name}</span>
          )}
        </div>
      </div>
    </div>
  )
}
