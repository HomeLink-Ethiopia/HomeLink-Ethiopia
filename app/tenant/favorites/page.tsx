'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import TopBar from '@/components/tenant/TopBar'
import { useFavoritesStore } from '@/lib/store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface SavedProperty {
  _id: string
  title: string
  rentAmount: number
  location?: { subCity?: string; city?: string }
  bedrooms?: number
  bathrooms?: number
  verificationStatus?: string
  listingStatus?: string
  images?: { url?: string; key?: string }[]
}

function SavedCard({ p, onRemove }: { p: SavedProperty; onRemove: (id: string) => void }) {
  const img = p.images?.[0]?.url
  const src = img ? (img.startsWith('http') ? img : `${API_URL}${img}`) : '/images/placeholder.jpg'
  const available = p.listingStatus === 'active'

  return (
    <div className="group overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/property/${p._id}`} className="relative block h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={p.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {p.verificationStatus === 'verified' && (
          <span className="absolute left-2 top-2 rounded bg-verified px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Verified
          </span>
        )}
        {!available && (
          <span className="absolute right-2 top-2 rounded bg-charcoal/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Unavailable
          </span>
        )}
      </Link>
      <div className="p-4">
        <Link href={`/property/${p._id}`}>
          <p className="font-display text-base font-bold text-charcoal hover:text-rust">{p.title}</p>
        </Link>
        <p className="mt-0.5 text-sm text-charcoal/60">
          {[p.location?.subCity, p.location?.city].filter(Boolean).join(', ')}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-lg font-bold text-charcoal">
            ETB {p.rentAmount?.toLocaleString()}
            <span className="text-sm font-normal text-charcoal/50"> / mo</span>
          </p>
          <button
            type="button"
            onClick={() => onRemove(p._id)}
            className="flex items-center gap-1 text-xs font-medium text-charcoal/40 transition-colors hover:text-rust"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 17.3s-6.5-3.9-8.5-8.1C.4 6.2 2 3.3 5 3c1.8-.2 3.6.7 5 2.4C11.4 3.7 13.2 2.8 15 3c3 .3 4.6 3.2 3.5 6.2-2 4.2-8.5 8.1-8.5 8.1z" />
            </svg>
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FavoritesPage() {
  const favorites = useFavoritesStore((s) => s.favorites)
  const hydrated = useFavoritesStore((s) => s.hydrated)
  const hydrate = useFavoritesStore((s) => s.hydrate)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

  const [properties, setProperties] = useState<SavedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { hydrate() }, [hydrate])

  const fetchSaved = useCallback(async () => {
    const ids = [...useFavoritesStore.getState().favorites]
    if (ids.length === 0) {
      setProperties([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`${API_URL}/api/public/properties/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j?.data || null)
            .catch(() => null)
        )
      )
      const found = results.filter(Boolean) as SavedProperty[]
      setProperties(found)
      if (found.length === 0 && ids.length > 0) {
        setError('Saved properties could not be loaded right now. They may have been removed by their landlords.')
      }
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hydrated) fetchSaved()
  }, [hydrated, favorites, fetchSaved])

  const handleRemove = (id: string) => {
    toggleFavorite(id)
    setProperties((prev) => prev.filter((p) => p._id !== id))
  }

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

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-44 rounded-xl bg-charcoal/5" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-charcoal/5" />
                  <div className="h-3 w-1/2 rounded bg-charcoal/5" />
                  <div className="h-5 w-1/3 rounded bg-charcoal/5" />
                </div>
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sand/50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.2} className="h-10 w-10 text-charcoal/30">
                <path d="M10 17.3s-6.5-3.9-8.5-8.1C.4 6.2 2 3.3 5 3c1.8-.2 3.6.7 5 2.4C11.4 3.7 13.2 2.8 15 3c3 .3 4.6 3.2 3.5 6.2-2 4.2-8.5 8.1-8.5 8.1z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-charcoal">No saved homes yet</h2>
            <p className="mt-1 max-w-sm text-sm text-charcoal/60">
              Tap the heart icon on any property to save it here for easy access later.
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
            {properties.map((p) => (
              <SavedCard key={p._id} p={p} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
