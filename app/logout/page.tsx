'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Clears the session (token, cached user, session_role cookie) and
 * returns to the homepage. Both dashboards' Logout links point here.
 */
export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    localStorage.removeItem('hl_token')
    localStorage.removeItem('hl_user')
    document.cookie = 'session_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.replace('/')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <p className="text-sm text-charcoal/60">Signing out…</p>
    </div>
  )
}
