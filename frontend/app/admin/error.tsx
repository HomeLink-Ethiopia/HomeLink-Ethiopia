'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (
      error.message?.includes("reading '_leaflet_pos'") ||
      error.message?.includes('_getMapPanePos')
    ) {
      try {
        reset()
        return
      } catch {}
    }
    console.error('[admin-error-boundary]', error)
  }, [error, reset])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-lg rounded-2xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rust/10 text-2xl">
          ⚠️
        </div>
        <h2 className="font-display text-xl font-semibold text-charcoal">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-charcoal/60">
          This page hit an unexpected error. Your data is safe — try again, or head back to your dashboard.
        </p>

        {error?.message && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-red-200 bg-red-50 p-3 text-left font-mono text-xs text-red-700">
            <p className="font-bold">Error Details:</p>
            <p className="mt-1 break-words">{error.message}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rust/90"
          >
            Try again
          </button>
          <Link
            href="/admin/dashboard"
            className="rounded-lg border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-sand"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-sand"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
