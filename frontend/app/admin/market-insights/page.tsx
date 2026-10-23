'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/admin/TopBar'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/**
 * Market Insights — every number comes from the live database via
 * GET /api/v1/admin/market-insights (verified active listings only).
 * Small-sample reality is shown, not invented: charts say "not enough
 * data yet" instead of fabricating trends.
 */

interface Insights {
  headline: {
    activeListings: number
    verifiedListings: number
    avgRentEtb: number
    minRentEtb: number
    maxRentEtb: number
    totalTenants: number
    newListingsThisMonth: number
    occupancyRate: number
  }
  rentTrend: { labels: (string | null)[]; values: (number | null)[] }
  popularNeighborhoods: { name: string; views: number; apps: number; listings: number }[]
  propertyTypeDistribution: { type: string; count: number; share: number }[]
  priceDistribution: { label: string; count: number }[]
  sampleSizes: { verifiedActive: number; totalActive: number }
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      {children}
    </motion.div>
  )
}

const fmt = (n: number) => `ETB ${n.toLocaleString()}`

export default function MarketInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<Insights | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/admin/market-insights`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.status === 401) {
        setError('Please log in as an admin to see market insights.')
        return
      }
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setData(json.data)
    } catch {
      setError('Could not load market insights. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <>
        <TopBar title="Market Insights" />
        <main className="px-6 py-8 sm:px-8">
          <SkeletonTable rows={4} cols={4} />
        </main>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <TopBar title="Market Insights" />
        <main className="px-6 py-8 sm:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error || 'No data available.'}
          </div>
        </main>
      </>
    )
  }

  const h = data.headline
  const kpis = [
    { label: 'Avg Verified Rent', value: fmt(h.avgRentEtb), sub: `range ${fmt(h.minRentEtb)} – ${fmt(h.maxRentEtb)}` },
    { label: 'Active Listings', value: String(h.activeListings), sub: `${h.verifiedListings} verified` },
    { label: 'Registered Tenants', value: String(h.totalTenants), sub: 'on the platform' },
    { label: 'New Listings (30 days)', value: String(h.newListingsThisMonth), sub: `occupancy ${h.occupancyRate}%` },
  ]

  const trendPairs = data.rentTrend.labels.map((l, i) => ({ label: l, v: data.rentTrend.values[i] }))
  const trendValues = trendPairs.map((p) => p.v).filter((v): v is number => v !== null)
  const maxTrend = trendValues.length ? Math.max(...trendValues) : 0
  const hasTrend = trendValues.length >= 2

  const maxViews = Math.max(1, ...data.popularNeighborhoods.map((d) => d.views))

  return (
    <>
      <TopBar title="Market Insights" />

      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex items-center justify-between -mt-2">
          <p className="text-sm text-charcoal/60">
            Live indicators from verified active listings in Addis Ababa.
            {data.sampleSizes.verifiedActive < 10 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                Small sample — {data.sampleSizes.verifiedActive} verified listings
              </span>
            )}
          </p>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k, i) => (
            <FadeIn key={k.label} delay={i * 0.07}>
              <div className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <p className="text-xs font-medium text-charcoal/50">{k.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-charcoal">{k.value}</p>
                <p className="mt-1 text-[11px] text-charcoal/40">{k.sub}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* ── CHARTS ROW ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Rent trend */}
          <FadeIn delay={0.12}>
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
              <div className="mb-5">
                <h3 className="font-display text-base font-bold text-charcoal">Average Rent by Listing Month</h3>
                <p className="text-xs text-charcoal/50">All new listings · ETB/month</p>
              </div>
              {hasTrend ? (
                <div className="flex h-40 items-end gap-2">
                  {trendPairs.map((p, i) => (
                    <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                      {p.v !== null && (
                        <div className="hidden text-[10px] font-mono font-semibold text-charcoal/70 group-hover:block">
                          {(p.v / 1000).toFixed(1)}k
                        </div>
                      )}
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: p.v ? `${(p.v / maxTrend) * 100}%` : '4px' }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }}
                        className={`w-full rounded-t-md transition-colors ${p.v ? 'bg-rust/30 group-hover:bg-rust/60' : 'bg-sand'}`}
                        style={{ minHeight: '4px' }}
                      />
                      <span className="font-mono text-[9px] text-charcoal/40">{p.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex h-40 items-center justify-center text-sm text-charcoal/40">
                  Not enough listing history yet for a trend.
                </p>
              )}
            </div>
          </FadeIn>

          {/* Demand by neighborhood */}
          <FadeIn delay={0.16}>
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
              <div className="mb-5">
                <h3 className="font-display text-base font-bold text-charcoal">Demand by Neighborhood</h3>
                <p className="text-xs text-charcoal/50">Listing views vs applications (live counts)</p>
              </div>
              {data.popularNeighborhoods.length === 0 ? (
                <p className="py-10 text-center text-sm text-charcoal/40">No active listings yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.popularNeighborhoods.map((d) => (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-charcoal">{d.name}</span>
                        <span className="font-mono text-charcoal/50">
                          {d.views.toLocaleString()} views · {d.apps.toLocaleString()} apps · {d.listings} listing{d.listings === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-sand">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(d.views / maxViews) * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="absolute left-0 top-0 h-full rounded-full bg-rust/25"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(d.apps / maxViews) * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                          className="absolute left-0 top-0 h-full rounded-full bg-rust"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>
        </div>

        {/* ── PROPERTY TYPE BREAKDOWN ── */}
        <FadeIn delay={0.2}>
          <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
            <div className="mb-5">
              <h3 className="font-display text-base font-bold text-charcoal">Listing Mix by Property Type</h3>
              <p className="text-xs text-charcoal/50">Share of verified active listings</p>
            </div>
            {data.propertyTypeDistribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-charcoal/40">No verified listings yet.</p>
            ) : (
              <div className={`grid grid-cols-1 gap-4 ${data.propertyTypeDistribution.length >= 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : `sm:grid-cols-${Math.min(data.propertyTypeDistribution.length, 4)}`}`}>
                {data.propertyTypeDistribution.map((t) => (
                  <div key={t.type} className="text-center">
                    <div className="relative mx-auto mb-2 h-16 w-16">
                      <svg className="-rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#F5F1EC" strokeWidth="8" />
                        <motion.circle
                          cx="32" cy="32" r="26"
                          fill="none" stroke="#B8451F"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={163.36}
                          initial={{ strokeDashoffset: 163.36 }}
                          whileInView={{ strokeDashoffset: 163.36 * (1 - t.share / 100) }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.0, ease: 'easeOut' }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-charcoal">
                        {t.share}%
                      </span>
                    </div>
                    <p className="text-xs font-semibold capitalize text-charcoal">{t.type}</p>
                    <p className="text-[11px] text-charcoal/50">{t.count} listing{t.count === 1 ? '' : 's'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>

        {/* ── PRICE BANDS ── */}
        <FadeIn delay={0.24}>
          <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
            <div className="mb-5">
              <h3 className="font-display text-base font-bold text-charcoal">Rent Distribution</h3>
              <p className="text-xs text-charcoal/50">Verified active listings by monthly rent</p>
            </div>
            <div className="flex h-36 items-end gap-6 px-4">
              {data.priceDistribution.map((b, i) => {
                const max = Math.max(1, ...data.priceDistribution.map((x) => x.count))
                return (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-charcoal/70">{b.count}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      whileInView={{ height: `${(b.count / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      className="w-full rounded-t-md bg-rust/70"
                      style={{ minHeight: '4px' }}
                    />
                    <span className="text-[10px] font-mono text-charcoal/50">{b.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
      </main>
    </>
  )
}
