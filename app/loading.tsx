/**
 * Route-level loading skeleton (root fallback).
 *
 * Every role segment overrides this with a shape-matched skeleton, but any
 * route without its own loading.tsx shows this instead of a frozen old page
 * while the next segment's server component / chunk loads.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rust/20 border-t-rust" />
        <p className="text-sm text-charcoal/50">Loading…</p>
      </div>
    </div>
  )
}
