/**
 * Landlord-area loading skeleton — mirrors the dashboard layout (KPI cards,
 * two-column panels) so navigation feels instant.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-cream px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-charcoal/10" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl bg-white shadow-sm" />
          <div className="h-72 animate-pulse rounded-xl bg-white shadow-sm" />
        </div>
      </div>
    </div>
  )
}
