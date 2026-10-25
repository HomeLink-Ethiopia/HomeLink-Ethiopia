'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The canonical property detail page is /property/[id].
 * This route exists only to redirect old links there.
 */
export default function ExplorePropertyDetailRedirect({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params

  useEffect(() => {
    router.replace(`/property/${id}`)
  }, [id, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
    </div>
  )
}
