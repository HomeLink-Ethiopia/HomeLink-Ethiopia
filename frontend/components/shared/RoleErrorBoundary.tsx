'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Role-area error boundary (Sprint-quality safety net).
 *
 * Any uncaught render/runtime error inside a dashboard shows this friendly
 * panel instead of Next.js's dev-only red overlay (users in production see
 * a blank page otherwise). The user can retry in place or fall back to
 * their dashboard without losing their session.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for observability without crashing the tree again
    console.error('[role-error-boundary]', error.message)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-md rounded-2xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rust/10 text-2xl">
          ⚠️
        </div>
        <h2 className="font-display text-xl font-semibold text-charcoal">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-charcoal/60">
          This page hit an unexpected error. Your data is safe — try again, or
          head back to your dashboard.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rust/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-charcoal/15 px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-charcoal/5"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
