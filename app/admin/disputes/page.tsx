'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ThreadMsg {
  from: string
  fromName?: string
  text: string
  at?: string
}

interface Dispute {
  _id: string
  reason: string
  description: string
  status: 'open' | 'under_review' | 'resolved' | 'rejected' | 'withdrawn'
  filedByRole: string
  propertyId?: { title?: string } | null
  filedBy?: { firstName?: string; lastName?: string; email?: string; role?: string }
  againstUserId?: { firstName?: string; lastName?: string; email?: string; role?: string }
  resolution?: string
  thread: ThreadMsg[]
  createdAt: string
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-stone-200 text-stone-600',
}

const FILTERS = ['all', 'open', 'under_review', 'resolved', 'rejected', 'withdrawn'] as const

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [resolution, setResolution] = useState('')
  const [actionError, setActionError] = useState('')

  const getToken = () => localStorage.getItem('hl_token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`${API_URL}/api/v1/disputes`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setDisputes(json.data || [])
    } catch {
      setError('Could not load disputes. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter)
  const active = filtered.find((d) => d._id === activeId) ?? filtered[0] ?? null

  async function sendMessage() {
    if (!message.trim() || !active) return
    await fetch(`${API_URL}/api/v1/disputes/${active._id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ text: message.trim() }),
    })
    setMessage('')
    await load()
  }

  async function review(decision: 'resolve' | 'reject') {
    if (!active) return
    if (!resolution.trim()) {
      setActionError('A written decision reason is required — both parties will see it.')
      return
    }
    setActionError('')
    const res = await fetch(`${API_URL}/api/v1/disputes/${active._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ decision, resolution: resolution.trim() }),
    })
    const json = await res.json()
    if (!res.ok) {
      setActionError(json.message || 'Review failed')
      return
    }
    setResolution('')
    await load()
  }

  return (
    <>
      <TopBar title="Disputes" />
      <main className="flex-1 space-y-5 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-rust text-white'
                  : 'border border-charcoal/10 bg-white text-charcoal/60 hover:bg-sand'
              }`}
            >
              {f.replace(/_/g, ' ')}{' '}
              {f !== 'all' && (
                <span className="opacity-60">({disputes.filter((d) => d.status === f).length})</span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonList count={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="document"
            title="No disputes"
            description={filter === 'all' ? 'No disputes have been filed yet.' : `No ${filter.replace(/_/g, ' ')} disputes.`}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
            {/* queue */}
            <div className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-white">
              {filtered.map((d) => (
                <button
                  key={d._id}
                  type="button"
                  onClick={() => setActiveId(d._id)}
                  className={`w-full p-4 text-left transition-colors ${active?._id === d._id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize text-charcoal/60">
                      {d.reason.replace(/_/g, ' ')}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[d.status]}`}>
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-charcoal">
                    {d.filedBy?.firstName} {d.filedBy?.lastName} vs {d.againstUserId?.firstName || '—'}
                  </p>
                  <p className="truncate text-xs text-charcoal/40">{d.description}</p>
                </button>
              ))}
            </div>

            {/* detail */}
            {active && (
              <div className="rounded-lg border border-charcoal/10 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[active.status]}`}>
                        {active.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs capitalize text-charcoal/40">{active.filedByRole} filed</span>
                    </div>
                    <h2 className="mt-1 font-display text-lg font-semibold capitalize text-charcoal">
                      {active.reason.replace(/_/g, ' ')}
                    </h2>
                    <p className="text-xs text-charcoal/40">
                      Filed {new Date(active.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* parties */}
                <div className="mt-4 grid grid-cols-1 gap-3 border-y border-charcoal/10 py-3 sm:grid-cols-2">
                  <div className="rounded bg-cream p-3">
                    <p className="text-xs text-charcoal/40">Filed by ({active.filedBy?.role})</p>
                    <p className="text-sm font-medium text-charcoal">
                      {active.filedBy?.firstName} {active.filedBy?.lastName}
                    </p>
                    <p className="text-xs text-charcoal/50">{active.filedBy?.email}</p>
                  </div>
                  <div className="rounded bg-cream p-3">
                    <p className="text-xs text-charcoal/40">Against ({active.againstUserId?.role || '—'})</p>
                    <p className="text-sm font-medium text-charcoal">
                      {active.againstUserId?.firstName} {active.againstUserId?.lastName}
                    </p>
                    <p className="text-xs text-charcoal/50">{active.againstUserId?.email}</p>
                  </div>
                </div>

                <p className="mt-3 rounded bg-cream p-3 text-sm text-charcoal/80">{active.description}</p>

                {active.resolution && (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Decision</p>
                    <p className="mt-1 text-sm text-emerald-800">{active.resolution}</p>
                  </div>
                )}

                {/* thread */}
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  Communication thread
                </h3>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {active.thread.map((m, i) => (
                    <div key={i} className="rounded bg-cream p-2.5">
                      <p className="text-xs font-medium capitalize text-charcoal">
                        {m.from}{' '}
                        <span className="font-normal text-charcoal/40">{m.fromName ? `· ${m.fromName}` : ''}</span>
                        {m.at && (
                          <span className="ml-2 font-normal text-charcoal/30">
                            {new Date(m.at).toLocaleString()}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-charcoal/70">{m.text}</p>
                    </div>
                  ))}
                  {active.thread.length === 0 && (
                    <p className="text-xs text-charcoal/40">No messages yet.</p>
                  )}
                </div>

                {/* admin actions */}
                {!['resolved', 'rejected', 'withdrawn'].includes(active.status) ? (
                  <div className="mt-4 space-y-3 border-t border-charcoal/10 pt-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Message both parties (moves dispute to under review)…"
                        className="flex-1 rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={sendMessage}
                        className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        Send
                      </button>
                    </div>
                    <label className="block text-sm">
                      <span className="text-charcoal/70">Decision reason *</span>
                      <textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        rows={2}
                        placeholder="Written decision shared with both parties and recorded in the audit trail."
                        className="mt-1 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
                      />
                    </label>
                    {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => review('resolve')}
                        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Resolve dispute
                      </button>
                      <button
                        type="button"
                        onClick={() => review('reject')}
                        className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Reject dispute
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-charcoal/10 pt-3 text-xs text-charcoal/40">
                    This dispute is closed — decision recorded in the audit trail.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
