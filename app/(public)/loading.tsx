/**
 * Public-area loading skeleton — mirrors the marketing/listing pages
 * (hero + card grid) so navigation feels instant.
 */
export default function Loading() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <div className="h-64 animate-pulse rounded-2xl bg-charcoal/10" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  )
}
