'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Neighborhood {
  _id: string
  name: string
  city: string
  overall: number
  scores: {
    safety: number
    noise: number
    floodRisk: number
    waterReliability: number
    electricityReliability: number
    internet: number
    transport: number
  }
  summary?: string
  highlights?: string[]
  avgRentEstimate?: number
  listingsCount?: number
}

const DIMENSIONS: { key: keyof Neighborhood['scores']; label: string; hint: string }[] = [
  { key: 'safety', label: 'Safety', hint: 'Reported incidents, street lighting, police presence' },
  { key: 'noise', label: 'Quietness', hint: 'Higher = quieter streets (traffic, nightlife, markets)' },
  { key: 'floodRisk', label: 'Flood safety', hint: 'Higher = lower flood risk in rainy season' },
  { key: 'waterReliability', label: 'Water reliability', hint: 'Municipal supply consistency' },
  { key: 'electricityReliability', label: 'Electricity reliability', hint: 'Grid stability' },
  { key: 'internet', label: 'Internet', hint: 'Fiber/mobile coverage quality' },
  { key: 'transport', label: 'Transport', hint: 'Bus, minibus and light-rail access' },
]

const scoreColor = (v: number) =>
  v >= 80 ? 'bg-emerald-500' : v >= 65 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500'

/**
 * Neighborhood Safety & Liveability Data — tenants compare up to 4
 * neighborhoods side-by-side before choosing where to live. Scores are
 * AI-generated estimates shown with their context (highlights, summaries),
 * never as absolute truth.
 */
export default function NeighborhoodsPage() {
  const [all, setAll] = useState<Neighborhood[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/v1/neighborhoods`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setAll(d.data || []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false))
  }, [])

  const compared = useMemo(
    () => selected.map((n) => all.find((x) => x.name === n)).filter(Boolean) as Neighborhood[],
    [selected, all]
  )

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((p) => p !== name)
      if (prev.length >= 4) return [...prev.slice(1), name] // keep last 3 + new
      return [...prev, name]
    })
  }

  // Best value in each dimension among the compared set
  const bestOf = (key: keyof Neighborhood['scores']) =>
    compared.length >= 2 ? Math.max(...compared.map((c) => c.scores[key])) : null

  return (
    <>
      <TopBar title="Neighborhood Guide" subtitle="Compare safety, utilities and transport across Ethiopia's cities before choosing your home." />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-lg bg-charcoal/5" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">Neighborhood data is not available yet. Please try again later.</p>
          </div>
        ) : (
          <>
            {/* Pick up to 4 to compare */}
            <div>
              <p className="text-sm font-medium text-charcoal">
                Select 2–4 areas to compare <span className="text-charcoal/50">({selected.length}/4 selected)</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {all.map((n) => {
                  const active = selected.includes(n.name)
                  return (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => toggle(n.name)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'border-rust bg-rust text-white'
                          : 'border-charcoal/15 text-charcoal/70 hover:border-rust hover:text-rust'
                      }`}
                    >
                      {n.name} <span className="ml-1 text-xs opacity-70">{n.overall}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Side-by-side comparison table */}
            {compared.length >= 2 && (
              <div className="overflow-x-auto rounded-lg border border-charcoal/10 bg-white">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-charcoal/10">
                      <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                        Dimension
                      </th>
                      {compared.map((c) => (
                        <th key={c._id} className="p-4 text-left">
                          <div className="font-display text-base font-semibold text-charcoal">{c.name}</div>
                          <div className="text-xs text-charcoal/50">Overall {c.overall}/100</div>
                          {typeof c.avgRentEstimate === 'number' && c.avgRentEstimate > 0 && (
                            <div className="text-xs text-charcoal/50">~ ETB {c.avgRentEstimate.toLocaleString()}/mo</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DIMENSIONS.map((dim) => {
                      const best = bestOf(dim.key)
                      return (
                        <tr key={dim.key} className="border-b border-charcoal/5 last:border-0">
                          <td className="p-4">
                            <div className="text-sm font-medium text-charcoal" title={dim.hint}>
                              {dim.label}
                            </div>
                            <div className="text-[11px] text-charcoal/40">{dim.hint}</div>
                          </td>
                          {compared.map((c) => {
                            const v = c.scores[dim.key]
                            const isBest = best !== null && v === best
                            return (
                              <td key={c._id} className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-charcoal/10">
                                    <div className={`h-full rounded-full ${scoreColor(v)}`} style={{ width: `${v}%` }} />
                                  </div>
                                  <span className={`text-sm font-semibold ${isBest ? 'text-emerald-600' : 'text-charcoal/70'}`}>
                                    {v}
                                    {isBest && <span className="ml-1 text-[10px]">✓ best</span>}
                                  </span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    <tr className="border-t border-charcoal/10">
                      <td className="p-4 text-sm font-medium text-charcoal">Highlights</td>
                      {compared.map((c) => (
                        <td key={c._id} className="p-4">
                          <ul className="list-inside list-disc space-y-1 text-xs text-charcoal/60">
                            {(c.highlights || []).map((h) => (
                              <li key={h}>{h}</li>
                            ))}
                          </ul>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* All neighborhoods — summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {all.map((n) => (
                <div
                  key={n._id}
                  className={`rounded-lg border p-5 transition-colors ${
                    selected.includes(n.name) ? 'border-rust bg-rust/5' : 'border-charcoal/10 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-charcoal">{n.name}</h3>
                      <p className="text-xs text-charcoal/50">{n.city}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-charcoal">{n.overall}</div>
                      <div className="text-[10px] uppercase tracking-wide text-charcoal/40">overall</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {DIMENSIONS.slice(0, 4).map((d) => (
                      <div key={d.key} className="flex items-center justify-between text-xs">
                        <span className="text-charcoal/60">{d.label}</span>
                        <span className="font-semibold text-charcoal/80">{n.scores[d.key]}</span>
                      </div>
                    ))}
                  </div>
                  {n.summary && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-charcoal/60">{n.summary}</p>}
                  <button
                    type="button"
                    onClick={() => toggle(n.name)}
                    className="mt-4 w-full rounded-md border border-rust px-3 py-1.5 text-xs font-semibold text-rust transition-colors hover:bg-rust hover:text-white"
                  >
                    {selected.includes(n.name) ? 'Remove from comparison' : 'Add to comparison'}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-charcoal/40">
              Scores are AI-generated estimates from platform data and public sources, shown to help you
              compare options — always visit in person before signing. Looking for a home?{' '}
              <Link href="/explore" className="underline hover:text-rust">Browse verified listings</Link>.
            </p>
          </>
        )}
      </main>
    </>
  )
}
