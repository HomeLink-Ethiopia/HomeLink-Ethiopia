'use client'

import Link from 'next/link'
import TopBar from '@/components/tenant/TopBar'
import PropertyCard from '@/components/discovery/PropertyCard'
import { useFavoritesStore } from '@/lib/store'
import { PROPERTIES } from '@/lib/properties'

export default function FavoritesPage() {
  const favorites = useFavoritesStore((s) => s.favorites)
  const favoriteProperties = PROPERTIES.filter((p) => favorites.has(p.id))

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-charcoal">Saved Homes</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Properties you&apos;ve saved for later review.
          </p>
        </div>

        {favoriteProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sand/50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.2} className="h-10 w-10 text-charcoal/30">
                <path d="M10 17.3s-6.5-3.9-8.5-8.1C.4 6.2 2 3.3 5 3c1.8-.2 3.6.7 5 2.4C11.4 3.7 13.2 2.8 15 3c3 .3 4.6 3.2 3.5 6.2-2 4.2-8.5 8.1-8.5 8.1z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-charcoal">No saved homes yet</h2>
            <p className="mt-1 max-w-sm text-sm text-charcoal/60">
              Tap the heart icon on any property card to save it here for easy access later.
            </p>
            <Link
              href="/explore"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-rust px-5 py-2.5 text-sm font-semibold text-white shadow-stamp transition-colors hover:bg-rust-dark"
            >
              Explore Properties
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteProperties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
