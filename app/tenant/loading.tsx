/**
 * Tenant-area loading skeleton — mirrors the dashboard layout (greeting,
 * card grid, list section) so navigation feels instant.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-cream px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-charcoal/10" />
        <div className="h-4 w-96 animate-pulse rounded bg-charcoal/5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-white shadow-sm" />
      </div>
    </div>
  )
}
