/**
 * Admin-area loading skeleton — mirrors the console layout (stat cards,
 * wide table/panel) so navigation feels instant.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-cream px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-9 w-80 animate-pulse rounded-lg bg-charcoal/10" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-white shadow-sm" />
      </div>
    </div>
  )
}
