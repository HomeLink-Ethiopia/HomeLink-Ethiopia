'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { fetchFraudPriority, type AiFraudPriorityItem } from '@/services/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface PropertyRisk {
  propertyId: string
  title: string
  location: string | { address?: string; subCity?: string; city?: string }
  score: number
  signals: string[]
}

interface FraudReport {
  _id: string
  reportType: string
  status: string
  riskScore?: number
  createdAt: string
}

function RiskBadge({ score }: { score: number }) {
  const label = score >= 75 ? 'High Risk' : score >= 50 ? 'Medium Risk' : 'Low Risk'
  const cls = score >= 75 ? 'bg-red-50 text-red-700 border-red-200'
    : score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-green-50 text-green-700 border-green-200'
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
}

function RiskGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#dc2626' : score >= 50 ? '#f59e0b' : '#16a34a'
  const circumference = 2 * Math.PI * 28
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="-rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#F5F1EC" strokeWidth="4" />
        <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-charcoal">{score}</span>
    </div>
  )
}

export default function RiskMonitoringPage() {
  const [properties, setProperties] = useState<PropertyRisk[]>([])
  const [reports, setReports] = useState<FraudReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)
  // Sprint 13 — AI-prioritized queue (server ranks, humans decide)
  const [priorityQueue, setPriorityQueue] = useState<AiFraudPriorityItem[]>([])
  const [priorityNote, setPriorityNote] = useState('')

  const active = properties.find(p => p.propertyId === selectedId) ?? null

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      // Fetch all properties
      const propsRes = await fetch(`${API_URL}/api/v1/properties/all`, { headers })
      const propsData = propsRes.ok ? await propsRes.json() : { data: [] }
      const allProps = propsData.data || propsData.properties || []

      // Fetch fraud reports
      const fraudRes = await fetch(`${API_URL}/api/v1/fraud-reports`, { headers })
      const fraudData = fraudRes.ok ? await fraudRes.json() : { data: [] }
      setReports(fraudData.data || [])

      // AI prioritized review queue — server-side ranking across all listings
      try {
        const priority = await fetchFraudPriority()
        setPriorityQueue(priority.queue)
        setPriorityNote(priority.summary.note)
      } catch { /* queue is optional-side; main scoring still shows */ }

      // Calculate risk scores for each property
      if (allProps.length > 0) {
        setScoring(true)
        const scored = await Promise.all(
          allProps.map(async (p: any) => {
            try {
              const r = await fetch(`${API_URL}/api/v1/fraud-reports/risk-score/${p._id}`, { headers })
              if (r.ok) {
                const d = await r.json()
                return {
                  propertyId: p._id,
                  title: p.title || 'Untitled',
                  location: typeof p.location === 'string' ? p.location : p.location?.city || 'Unknown',
                  score: d.data?.score || d.score || 0,
                  signals: d.data?.signals || d.signals || [],
                }
              }
            } catch (e) { /* skip */ }
            return {
              propertyId: p._id,
              title: p.title || 'Untitled',
              location: typeof p.location === 'string' ? p.location : p.location?.city || 'Unknown',
              score: 0,
              signals: [],
            }
          })
        )
        setProperties(scored)
        setScoring(false)
      }
    } catch (e) {
      console.error('Fetch risk data error:', e)
    } finally {
      setLoading(false)
    }
  }

  const highRisk = properties.filter(p => p.score >= 75).length
  const mediumRisk = properties.filter(p => p.score >= 50 && p.score < 75).length
  const pendingReports = reports.filter(r => r.status === 'pending').length

  return (
    <>
      <TopBar title="Risk Monitoring" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'High Risk Properties', value: String(highRisk), color: 'text-red-600' },
            { label: 'Medium Risk Properties', value: String(mediumRisk), color: 'text-amber-600' },
            { label: 'Pending Reports', value: String(pendingReports), color: 'text-blue-600' },
            { label: 'Total Properties', value: String(properties.length), color: 'text-charcoal' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-charcoal/50">{kpi.label}</p>
              <p className={`mt-2 font-display text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Sprint 13 — AI prioritized review queue */}
        <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-charcoal">AI Prioritized Review Queue</h2>
              <p className="text-xs text-charcoal/50">Ranked by real risk signals — the AI only orders the queue, decisions stay with you.</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">HIGH: {priorityQueue.filter(q => q.riskLevel === 'HIGH').length}</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">MEDIUM: {priorityQueue.filter(q => q.riskLevel === 'MEDIUM').length}</span>
              <span className="rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-700">LOW: {priorityQueue.filter(q => q.riskLevel === 'LOW').length}</span>
            </div>
          </div>
          <div className="mt-4 divide-y divide-charcoal/8">
            {priorityQueue.length === 0 ? (
              <p className="py-4 text-sm text-charcoal/40">Nothing to prioritize — every listing is verified.</p>
            ) : (
              priorityQueue.slice(0, 10).map(q => (
                <button
                  key={String(q.propertyId)}
                  type="button"
                  onClick={() => setSelectedId(String(q.propertyId))}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-sand/20"
                >
                  <span className={`w-14 shrink-0 rounded px-2 py-1 text-center text-[11px] font-bold ${q.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : q.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {q.riskLevel}
                  </span>
                  <span className="w-10 shrink-0 font-mono text-sm font-bold text-charcoal">{q.riskScore}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-charcoal">{q.title}</span>
                    <span className="block truncate text-xs text-charcoal/50">
                      {q.signals.length > 0 ? q.signals.join(' · ') : 'No active signals'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-charcoal/40">{q.verificationStatus}</span>
                </button>
              ))
            )}
          </div>
          {priorityNote && <p className="mt-3 text-[11px] text-charcoal/40">{priorityNote}</p>}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-charcoal/5" />)}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState title="No properties found" description="Properties will appear here once landlords add them." />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Property Risk List */}
            <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-charcoal/8 px-5 py-4">
                <h3 className="font-display text-base font-bold text-charcoal">Property Risk Scores</h3>
                <p className="text-xs text-charcoal/50">
                  {scoring ? 'Calculating scores...' : 'Properties ranked by AI fraud risk score'}
                </p>
              </div>
              <div className="divide-y divide-charcoal/8">
                {properties.sort((a, b) => b.score - a.score).map(p => (
                  <button
                    key={p.propertyId}
                    type="button"
                    onClick={() => setSelectedId(p.propertyId === selectedId ? null : p.propertyId)}
                    className={`flex w-full items-center gap-4 p-4 text-left transition-colors ${selectedId === p.propertyId ? 'bg-rust-tint/30' : 'hover:bg-sand/30'}`}
                  >
                    <RiskGauge score={p.score} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <RiskBadge score={p.score} />
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-charcoal">{p.title}</p>
                      <p className="text-xs text-charcoal/50">
                        {typeof p.location === 'string' ? p.location : [p.location?.address, p.location?.subCity, p.location?.city].filter(Boolean).join(', ') || 'Unknown'}
                      </p>
                    </div>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-charcoal/30">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="space-y-4">
              {active ? (
                <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
                  <RiskBadge score={active.score} />
                  <h2 className="mt-2 font-display text-lg font-semibold text-charcoal">{active.title}</h2>
                  <p className="text-xs text-charcoal/50">
                    {typeof active.location === 'string'
                      ? active.location
                      : [active.location?.address, active.location?.subCity, active.location?.city].filter(Boolean).join(', ') || 'Unknown'}
                  </p>

                  {active.signals.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Risk Factors</h4>
                      <div className="mt-2 space-y-2">
                        {active.signals.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg bg-red-50/50 p-2.5 text-sm text-charcoal/70">
                            <svg viewBox="0 0 16 16" fill="#dc2626" className="mt-0.5 h-3.5 w-3.5 shrink-0">
                              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
                            </svg>
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <a
                      href={`/explore/${active.propertyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-lg bg-rust px-3 py-2 text-center text-xs font-semibold text-white hover:bg-rust-dark transition-colors"
                    >
                      View Property
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-charcoal/8 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm text-charcoal/40">Select a property to view risk details</p>
                </div>
              )}

              {/* Recent Fraud Reports Summary */}
              <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
                <h3 className="font-display text-sm font-semibold text-charcoal">Recent Reports</h3>
                <div className="mt-3 space-y-2.5">
                  {reports.length === 0 ? (
                    <p className="text-xs text-charcoal/40">No reports yet.</p>
                  ) : (
                    reports.slice(0, 5).map(r => (
                      <div key={r._id} className="flex items-center gap-3 text-xs">
                        <span className={`h-2.5 w-2.5 rounded-full ${r.status === 'pending' ? 'bg-red-500' : r.status === 'under_review' ? 'bg-amber-400' : 'bg-green-500'}`} />
                        <span className="min-w-0 flex-1 truncate text-charcoal/70">{r.reportType.replace('_', ' ')}</span>
                        <span className="font-mono text-charcoal/40">{r.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
