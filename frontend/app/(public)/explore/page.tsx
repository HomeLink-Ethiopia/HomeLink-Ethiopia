'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DiscoverySplit from '@/components/discovery/DiscoverySplit'
import { parseSearchParams } from '@/lib/search'

function ExploreContent() {
  const searchParams = useSearchParams()
  const filters = parseSearchParams(searchParams)

  return (
    <div className="bg-white">
      <DiscoverySplit filters={filters} />
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream"><div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" /></div>}>
      <ExploreContent />
    </Suspense>
  )
}
