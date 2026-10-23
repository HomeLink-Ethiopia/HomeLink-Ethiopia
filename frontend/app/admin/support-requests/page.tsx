'use client'

import { useCallback, useEffect, useState } from 'react'
import TopBar from '@/components/admin/TopBar'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface SupportMessage {
  _id: string
  name: string
  contact: string
  message: string
  status: 'new' | 'in_progress' | 'resolved'
  createdAt: string
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-rust/10 text-rust' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-700' },
  resolved: { label: 'Resolved', cls: 'bg-verified/10 text-verified' },
}

/**
 * Admin support inbox (sprint-support-inbox) — every message submitted from
 * the public /support contact form lands here so the team can triage and
 * resolve it. Fix for: "I can't find where the sending message went".
 */
export default function SupportRequestsPage() {
  const { t } = useLanguage()
  const [items, setItems] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/support/requests`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message || `Failed to load (${res.status})`)
      setItems(body?.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function updateStatus(id: string, status: SupportMessage['status']) {
    const token = localStorage.getItem('hl_token')
    await fetch(`${API_URL}/api/v1/support/requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status }),
    }).catch(() => null)
    load()
  }

  return (
    <>
      <TopBar title={t.sidebar?.supportRequests || 'Support Requests'} />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 animate-pulse rounded-xl border border-charcoal/10 bg-white/60" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-charcoal/10 bg-white p-10 text-center">
            <p className="font-display text-lg font-semibold text-charcoal">No support messages yet</p>
            <p className="mt-1 text-sm text-charcoal/60">
              Messages submitted from the public support form will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((m) => {
              const st = STATUS_STYLE[m.status] || STATUS_STYLE.new
              return (
                <div
                  key={m._id}
                  className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm"
                  style={{ borderRadius: '12px 12px 24px 12px' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-charcoal">{m.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/55">{m.contact} · {new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {m.status !== 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(m._id, 'in_progress')}
                          className="rounded bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/20 transition-colors"
                        >
                          In Progress
                        </button>
                      )}
                      {m.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(m._id, 'resolved')}
                          className="rounded bg-verified/10 px-2.5 py-1 text-[11px] font-semibold text-verified hover:bg-verified/20 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">{m.message}</p>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
