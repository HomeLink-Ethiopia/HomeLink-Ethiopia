'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface DisputeThread {
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
  propertyId?: { title?: string; location?: { city?: string; subCity?: string } } | null
  filedBy?: { firstName?: string; lastName?: string; email?: string }
  againstUserId?: { firstName?: string; lastName?: string; email?: string }
  resolution?: string
  thread: DisputeThread[]
  createdAt: string
}

const REASONS = [
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'property_condition', label: 'Property condition' },
  { value: 'deposit_refund', label: 'Deposit refund' },
  { value: 'unauthorized_entry', label: 'Unauthorized entry' },
  { value: 'misrepresentation', label: 'Listing misrepresented' },
  { value: 'lease_violation', label: 'Lease violation' },
  { value: 'other', label: 'Other' },
]

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-stone-200 text-stone-600',
}

export default function TenantDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [threadText, setThreadText] = useState('')

  // new dispute form
  const [showForm, setShowForm] = useState(false)
  const [agreementId, setAgreementId] = useState('')
  const [reason, setReason] = useState('deposit_refund')
  const [description, setDescription] = useState('')
  const [agreements, setAgreements] = useState<{ _id: string; propertyId?: { title?: string } }[]>([])

  const getToken = () => localStorage.getItem('hl_token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`${API_URL}/api/v1/disputes/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Could not load disputes')
      const json = await res.json()
      setDisputes(json.data || [])
    } catch {
      setError('Could not load your disputes. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // my agreements for the dispute target dropdown
    fetch(`${API_URL}/api/v1/agreements/my`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setAgreements(j.data || []))
      .catch(() => {})
  }, [load])

  async function fileDispute(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    setSuccess('')
    try {
      const res = await fetch(`${API_URL}/api/v1/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          agreementId: agreementId || undefined,
          reason,
          description: description.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed')
      setSuccess('Dispute filed. Our team will review it and mediate with the other party.')
      setDescription('')
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file dispute')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendMessage() {
    if (!threadText.trim() || !activeId) return
    await fetch(`${API_URL}/api/v1/disputes/${activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ text: threadText.trim() }),
    })
    setThreadText('')
    await load()
  }

  async function withdraw(id: string) {
    await fetch(`${API_URL}/api/v1/disputes/${id}/withdraw`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    await load()
  }

  const active = disputes.find((d) => d._id === activeId) ?? null

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-charcoal/60">
            Disagree with your landlord over a deposit, payment, or lease term? File a dispute and our
            team will mediate.
          </p>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 rounded bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust-dark"
          >
            {showForm ? 'Cancel' : 'File a Dispute'}
          </button>
        </div>

        {error && <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{success}</p>}

        {showForm && (
          <form onSubmit={fileDispute} className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-charcoal">New dispute</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-charcoal/70">Related agreement (optional)</span>
                <select
                  value={agreementId}
                  onChange={(e) => setAgreementId(e.target.value)}
                  className="mt-1 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
                >
                  <option value="">No specific agreement</option>
                  {agreements.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.propertyId?.title || a._id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-charcoal/70">Reason *</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm">
              <span className="text-charcoal/70">What happened? *</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                placeholder="Describe the issue clearly — dates, amounts, what was agreed, and what went wrong. This is shared with the mediator."
                className="mt-1 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 rounded bg-rust px-5 py-2 text-sm font-medium text-white hover:bg-rust-dark disabled:opacity-50"
            >
              {submitting ? 'Filing…' : 'Submit dispute'}
            </button>
          </form>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : disputes.length === 0 ? (
          <EmptyState
            icon="document"
            title="No disputes"
            description="You haven't filed any disputes. If something goes wrong with a landlord or property, file one here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
            <div className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-white">
              {disputes.map((d) => (
                <button
                  key={d._id}
                  type="button"
                  onClick={() => setActiveId(d._id)}
                  className={`w-full p-4 text-left transition-colors ${activeId === d._id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize text-charcoal/60">
                      {d.reason.replace(/_/g, ' ')}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[d.status]}`}>
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-charcoal">{d.description}</p>
                  <p className="mt-1 text-xs text-charcoal/40">
                    {new Date(d.createdAt).toLocaleDateString()} · vs {d.againstUserId?.firstName || 'landlord'}{' '}
                    {d.againstUserId?.lastName || ''}
                  </p>
                </button>
              ))}
            </div>

            {active && (
              <div className="rounded-lg border border-charcoal/10 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[active.status]}`}>
                      {active.status.replace(/_/g, ' ')}
                    </span>
                    <h2 className="mt-2 font-display text-lg font-semibold capitalize text-charcoal">
                      {active.reason.replace(/_/g, ' ')}
                    </h2>
                    <p className="text-xs text-charcoal/40">
                      Filed {new Date(active.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {['open', 'under_review'].includes(active.status) && (
                    <button
                      type="button"
                      onClick={() => withdraw(active._id)}
                      className="shrink-0 rounded border border-charcoal/20 px-3 py-1.5 text-xs text-charcoal/70 hover:bg-sand"
                    >
                      Withdraw
                    </button>
                  )}
                </div>

                <p className="mt-3 rounded bg-cream p-3 text-sm text-charcoal/80">{active.description}</p>

                {active.resolution && (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Admin decision
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">{active.resolution}</p>
                  </div>
                )}

                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  Communication
                </h3>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {active.thread.map((m, i) => (
                    <div key={i} className="rounded bg-cream p-2.5">
                      <p className="text-xs font-medium capitalize text-charcoal">
                        {m.from} <span className="font-normal text-charcoal/40">{m.fromName ? `· ${m.fromName}` : ''}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-charcoal/70">{m.text}</p>
                    </div>
                  ))}
                </div>
                {!['resolved', 'rejected', 'withdrawn'].includes(active.status) && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={threadText}
                      onChange={(e) => setThreadText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Add a message to the mediator…"
                      className="flex-1 rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      className="rounded bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust-dark"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
