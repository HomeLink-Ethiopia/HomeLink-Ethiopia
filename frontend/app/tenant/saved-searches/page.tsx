'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'
import { readSavedSearches, saveSearch, removeSavedSearch, type SavedSearch } from '@/lib/saved-searches'

/**
 * Saved Searches — stores real filter presets in localStorage and links
 * into the live /explore search with those filters applied. Saving
 * happens on the Explore page via the "Save this search" button, and
 * also here directly.
 */

const PRESETS: { name: string; params: string }[] = [
  { name: 'Verified apartments in Bole', params: 'neighborhood=Bole&type=apartment&verifiedOnly=true' },
  { name: '2+ bedrooms under ETB 20,000', params: 'beds=2&maxPrice=20000' },
  { name: 'Furnished studios', params: 'type=studio&furnished=true' },
]

export default function SavedSearchesPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [name, setName] = useState('')

  const load = useCallback(() => {
    setSearches(readSavedSearches())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    saveSearch(trimmed, '')
    setName('')
    load()
  }

  const describe = (params: string) => {
    if (!params) return 'Custom search'
    const p = new URLSearchParams(params)
    const parts: string[] = []
    const get = (k: string) => p.get(k) || ''
    if (get('neighborhood')) parts.push(get('neighborhood'))
    if (get('city')) parts.push(get('city'))
    if (get('type')) parts.push(get('type'))
    if (get('beds')) parts.push(`${get('beds')}+ beds`)
    if (get('minPrice')) parts.push(`min ETB ${Number(get('minPrice')).toLocaleString()}`)
    if (get('maxPrice')) parts.push(`max ETB ${Number(get('maxPrice')).toLocaleString()}`)
    if (get('furnished') === 'true') parts.push('furnished')
    if (get('verifiedOnly') === 'true') parts.push('verified only')
    return parts.length ? parts.join(' · ') : 'All properties'
  }

  return (
    <div className="min-h-full bg-cream">
      <TopBar title={t.sidebar.savedSearches} subtitle="Your saved property searches" />

      <main className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
        {loading ? (
          <SkeletonList />
        ) : (
          <>
            {/* Quick presets */}
            <section className="mb-8">
              <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Popular searches</h2>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Link
                    key={p.name}
                    href={`/explore?${p.params}`}
                    className="rounded-full border border-charcoal/15 bg-white px-4 py-2 text-sm text-charcoal/80 transition-colors hover:border-rust hover:text-rust"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </section>

            {/* Save a new search */}
            <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5">
              <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Save a search</h2>
              <p className="mb-3 text-sm text-charcoal/60">
                Tip: set filters on the Explore page, then copy the URL — or save a named search here and open Explore with it.
              </p>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cheap 1-bedroom near the university"
                  className="flex-1 rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm outline-none focus:border-rust"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </section>

            {/* Saved list */}
            {searches.length === 0 ? (
              <EmptyState
                icon="search"
                title="No saved searches"
                description="Save a search to quickly run it again from here."
              />
            ) : (
              <section>
                <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Your searches</h2>
                <div className="grid gap-3">
                  {searches.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-charcoal/10 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-charcoal">{s.name}</p>
                        <p className="truncate text-sm text-charcoal/60">{describe(s.params)}</p>
                        <p className="mt-1 text-xs text-charcoal/40">
                          Saved {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={s.params ? `/explore?${s.params}` : '/explore'}
                          className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90"
                        >
                          Run
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            removeSavedSearch(s.id)
                            load()
                          }}
                          className="rounded-lg border border-charcoal/15 px-3 py-1.5 text-sm text-charcoal/70 hover:bg-sand"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
