'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import Logo from '@/components/Logo'

export default function LogoutPage() {
  const { logout } = useAuth()

  useEffect(() => {
    // Logout using the auth context
    logout()
  }, [logout])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-green-600">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          
          <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Logged Out</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Your session has been cleared successfully.
          </p>
          
          <p className="mt-4 text-sm text-charcoal/60">
            You've been redirected to the home page.
          </p>

          <div className="mt-6 space-y-3">
            <Link
              href="/login"
              className="block w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark"
            >
              Login Again
            </Link>
            
            <Link
              href="/"
              className="block text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-900">Session Cleared</p>
          <p className="mt-1 text-xs text-blue-700">
            Your session cookie has been deleted. You can no longer access protected pages until you log in again.
          </p>
        </div>
      </div>
    </div>
  )
}
