'use client'

import { useEffect } from 'react'
import { clearAllAuthSession, useAuth } from '@/lib/auth-context'

/**
 * Clears the session (token, cached user, session_role & session_user_id cookies) and
 * returns to the homepage. Both dashboards' Logout links point here.
 */
export default function LogoutPage() {
  const { logout } = useAuth()

  useEffect(() => {
    clearAllAuthSession()
    logout()
  }, [logout])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <p className="text-sm text-charcoal/60">Signing out…</p>
    </div>
  )
}
