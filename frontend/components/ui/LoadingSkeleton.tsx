'use client'

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-charcoal/5 ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-2/3" />
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white overflow-hidden">
      <div className="border-b border-charcoal/5 bg-charcoal/[0.02] px-5 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <SkeletonLine key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-charcoal/5 px-5 py-4">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonLine key={c} className="h-3 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
