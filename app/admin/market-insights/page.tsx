'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import TopBar from '@/components/admin/TopBar'

/* ─── DATA ─────────────────────────────────────────────────────────────── */

const MARKET_KPIS = [
  { label: 'Avg Monthly Rent (2-Bed)', value: 'ETB 19,420', change: '+4.1%', up: true },
  { label: 'Active Listings', value: '2,847', change: '+12.3%', up: true },
  { label: 'Vacancy Rate', value: '6.4%', change: '-1.8%', up: false },
  { label: 'Avg Days to Lease', value: '11 days', change: '-3 days', up: false },
]

const NEIGHBORHOOD_TABLE = [
  { name: 'Bole', listings: 426, avgRent: 22000, changeQoQ: 4.2, demand: 'Very High', vacancy: '4.1%' },
  { name: 'Old Airport', listings: 145, avgRent: 26500, changeQoQ: 5.4, demand: 'Very High', vacancy: '3.7%' },
  { name: 'Kazanchis', listings: 312, avgRent: 23000, changeQoQ: 3.8, demand: 'High', vacancy: '5.2%' },
  { name: 'CMC', listings: 276, avgRent: 17500, changeQoQ: 2.0, demand: 'Moderate', vacancy: '7.3%' },
  { name: 'Yeka', listings: 188, avgRent: 16000, changeQoQ: 2.6, demand: 'Growing', vacancy: '8.1%' },
  { name: 'Saris', listings: 196, avgRent: 13500, changeQoQ: 2.3, demand: 'Moderate', vacancy: '9.0%' },
  { name: 'Megenagna', listings: 122, avgRent: 15000, changeQoQ: 1.7, demand: 'Low', vacancy: '11.4%' },
]

const PRICE_TREND_MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
const PRICE_TREND_VALUES = [16800, 17200, 17900, 18300, 18700, 19100, 19420]
const maxTrend = Math.max(...PRICE_TREND_VALUES)

const PROPERTY_TYPE_BREAKDOWN = [
  { type: '2 Bedroom Apartment', pct: 38, count: 1082 },
  { type: '1 Bedroom / Studio', pct: 27, count: 769 },
  { type: '3 Bedroom Apartment', pct: 19, count: 541 },
  { type: 'House / Villa', pct: 12, count: 342 },
  { type: 'Other', pct: 4, count: 113 },
]

const DEMAND_BARS = [
  { name: 'Bole', views: 9240, applications: 1120 },
  { name: 'Kazanchis', views: 7100, applications: 840 },
  { name: 'CMC', views: 5800, applications: 620 },
  { name: 'Old Airport', views: 4600, applications: 540 },
  { name: 'Yeka', views: 3900, applications: 390 },
  { name: 'Saris', views: 3200, applications: 290 },
]
const maxViews = Math.max(...DEMAND_BARS.map((d) => d.views))

/* ─── HELPERS ───────────────────────────────────────────────────────────── */
function Badge({ demand }: { demand: string }) {
  const cls =
    demand === 'Very High' ? 'bg-rust/10 text-rust' :
    demand === 'High' ? 'bg-amber-100 text-amber-700' :
    demand === 'Growing' ? 'bg-blue-50 text-blue-700' :
    'bg-sand text-charcoal/60'
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{demand}</span>
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, delay }}>
      {children}
    </motion.div>
  )
}

/* ─── PAGE ──────────────────────────────────────────────────────────────── */
export default function MarketInsightsPage() {
  const [period, setPeriod] = useState<'Last 3 Months' | 'Last 6 Months' | 'Last Year'>('Last 6 Months')

  return (
    <>
      <TopBar title="Market Insights" defaultPeriod={period as any} />

      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex items-center justify-between -mt-2">
          <p className="text-sm text-charcoal/60">
            Aggregated, privacy-preserving rental indicators for Addis Ababa.
          </p>
          <div className="flex items-center gap-1 rounded-lg border border-charcoal/10 bg-white p-1 shadow-sm">
            {(['Last 3 Months', 'Last 6 Months', 'Last Year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-all ${period === p ? 'bg-rust text-white shadow-sm' : 'text-charcoal/60 hover:text-charcoal'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MARKET_KPIS.map((k, i) => (
            <FadeIn key={k.label} delay={i * 0.07}>
              <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <p className="text-xs font-medium text-charcoal/50">{k.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-charcoal">{k.value}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold ${k.up ? 'text-verified' : 'text-rust'}`}>{k.change}</span>
                  <span className="text-[11px] text-charcoal/40">vs last period</span>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* ── CHARTS ROW ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Average Rent Trend */}
          <FadeIn delay={0.12}>
            <div className="rounded-xl border border-charcoal/8 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
              <div className="mb-5">
                <h3 className="font-display text-base font-bold text-charcoal">Avg Monthly Rent — 2-Bedroom</h3>
                <p className="text-xs text-charcoal/50">Addis Ababa composite · ETB</p>
              </div>
              <div className="flex items-end gap-2 h-40">
                {PRICE_TREND_VALUES.map((v, i) => {
                  const height = (v / maxTrend) * 100
                  const isLast = i === PRICE_TREND_VALUES.length - 1
                  return (
                    <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                      <div className="hidden group-hover:block text-[10px] font-mono font-semibold text-charcoal/70">
                        {(v / 1000).toFixed(1)}k
                      </div>
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${height}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }}
                        className={`w-full rounded-t-md ${isLast ? 'bg-rust' : 'bg-rust/30 group-hover:bg-rust/60'} transition-colors`}
                        style={{ minHeight: '4px' }}
                      />
                      <span className="text-[9px] font-mono text-charcoal/40">{PRICE_TREND_MONTHS[i]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </FadeIn>

          {/* Demand by Neighborhood */}
          <FadeIn delay={0.16}>
            <div className="rounded-xl border border-charcoal/8 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
              <div className="mb-5">
                <h3 className="font-display text-base font-bold text-charcoal">Demand by Neighborhood</h3>
                <p className="text-xs text-charcoal/50">Listing views vs applications (this period)</p>
              </div>
              <div className="space-y-3">
                {DEMAND_BARS.map((d) => (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-charcoal">{d.name}</span>
                      <span className="font-mono text-charcoal/50">{d.views.toLocaleString()} views · {d.applications.toLocaleString()} apps</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-sand overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(d.views / maxViews) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="absolute left-0 top-0 h-full rounded-full bg-rust/25"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(d.applications / maxViews) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                        className="absolute left-0 top-0 h-full rounded-full bg-rust"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* ── PROPERTY TYPE BREAKDOWN ── */}
        <FadeIn delay={0.2}>
          <div className="rounded-xl border border-charcoal/8 bg-white p-6 shadow-sm" style={{ borderRadius: '12px 12px 24px 12px' }}>
            <div className="mb-5">
              <h3 className="font-display text-base font-bold text-charcoal">Listing Mix by Property Type</h3>
              <p className="text-xs text-charcoal/50">Share of active verified listings</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PROPERTY_TYPE_BREAKDOWN.map((t) => (
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
                        whileInView={{ strokeDashoffset: 163.36 * (1 - t.pct / 100) }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.0, ease: 'easeOut' }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-charcoal">
                      {t.pct}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-charcoal">{t.type}</p>
                  <p className="text-[11px] text-charcoal/50">{t.count.toLocaleString()} listings</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ── NEIGHBORHOOD TABLE ── */}
        <FadeIn delay={0.24}>
          <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden" style={{ borderRadius: '12px 12px 24px 12px' }}>
            <div className="border-b border-charcoal/8 px-6 py-4">
              <h3 className="font-display text-base font-bold text-charcoal">Neighborhood Breakdown</h3>
              <p className="text-xs text-charcoal/50">Aggregated from verified listings · data is anonymized</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-sand/40 text-xs uppercase tracking-wider text-charcoal/45">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Neighborhood</th>
                    <th className="px-5 py-3 text-left font-medium">Active Listings</th>
                    <th className="px-5 py-3 text-left font-medium">Avg 2-Bed Rent</th>
                    <th className="px-5 py-3 text-left font-medium">QoQ Change</th>
                    <th className="px-5 py-3 text-left font-medium">Demand</th>
                    <th className="px-5 py-3 text-left font-medium">Vacancy Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/8">
                  {NEIGHBORHOOD_TABLE.map((row, i) => (
                    <tr key={row.name} className={`hover:bg-sand/20 transition-colors ${i % 2 === 0 ? '' : 'bg-cream/40'}`}>
                      <td className="px-5 py-3 font-display font-semibold text-charcoal">{row.name}</td>
                      <td className="px-5 py-3 text-charcoal/70">{row.listings.toLocaleString()}</td>
                      <td className="px-5 py-3 font-mono font-bold text-rust">ETB {row.avgRent.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-verified">+{row.changeQoQ}%</span>
                      </td>
                      <td className="px-5 py-3"><Badge demand={row.demand} /></td>
                      <td className="px-5 py-3 text-charcoal/60">{row.vacancy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>

      </main>
    </>
  )
}
