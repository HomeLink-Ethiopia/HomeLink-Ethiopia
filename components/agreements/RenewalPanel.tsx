'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export interface RenewalAgreement {
  _id: string
  status: string
  endDate?: string
  monthlyRentEtb?: number
  rentAmount?: number
  renewalProposal?: {
    proposedBy: 'tenant' | 'landlord'
    newEndDate: string
    newRentAmount: number
    message?: string
    suggestedByAI?: boolean
    status: 'proposed' | 'accepted' | 'rejected'
    proposedAt?: string
  }
}

interface Props {
  agreement: RenewalAgreement
  myRole: 'tenant' | 'landlord'
  onChanged: () => void
}

interface PriceSuggestion {
  suggested: number
  rangeLow: number
  rangeHigh: number
  marketEstimate: number
  currentRent: number
  changePct: number
  confidence: number
  explanation: string
}

function daysUntil(date?: string) {
  if (!date) return Infinity
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

/**
 * Smart Lease Renewal panel — shown on active agreements.
 * • Expiry banner with days remaining (mirrors the 60/30/15-day reminders)
 * • "Suggest fair price" button → AI market estimate with explanation
 * • Propose renewal → the other party gets a notification
 * • Accept/Reject a pending proposal → one-click dual digital signing
 */
export default function RenewalPanel({ agreement, myRole, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [newRent, setNewRent] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [message, setMessage] = useState('')
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const days = daysUntil(agreement.endDate)
  const showBanner = agreement.status === 'active' && days <= 90
  // Ignore ghost proposals (empty Mongoose subdocs without real content)
  const rawProposal = agreement.renewalProposal
  const proposal = rawProposal && rawProposal.proposedAt ? rawProposal : null
  const currentRent = agreement.monthlyRentEtb ?? agreement.rentAmount ?? 0

  // Default the form to the AI suggestion once loaded
  useEffect(() => {
    if (suggestion && !newRent) setNewRent(String(suggestion.suggested))
    if (suggestion && !newEnd) {
      const d = new Date(agreement.endDate || Date.now())
      d.setFullYear(d.getFullYear() + 1)
      setNewEnd(d.toISOString().slice(0, 10))
    }
  }, [suggestion]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!showBanner && !(proposal && proposal.status === 'proposed' && proposal.proposedBy !== myRole)) return null

  async function loadSuggestion() {
    setLoadingSuggestion(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/${agreement._id}/renewal-price`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setSuggestion(data.data)
      else setError(data.message || 'Could not get a price suggestion.')
    } catch {
      setError('Cannot reach the server.')
    } finally {
      setLoadingSuggestion(false)
    }
  }

  async function propose() {
    if (!newRent || !newEnd) {
      setError('Pick a new monthly rent and end date.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/${agreement._id}/renewal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          newEndDate: newEnd,
          newRentAmount: Number(newRent),
          message,
          suggestedByAI: Boolean(suggestion && Number(newRent) === suggestion.suggested),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowForm(false)
        onChanged()
      } else {
        setError(data.message || `Could not send the proposal (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server.')
    } finally {
      setBusy(false)
    }
  }

  async function respond(decision: 'accept' | 'reject') {
    setBusy(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/${agreement._id}/renewal/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) onChanged()
      else setError(data.message || `Could not respond (${res.status}).`)
    } catch {
      setError('Cannot reach the server.')
    } finally {
      setBusy(false)
    }
  }

  const urgencyCls = days <= 15 ? 'border-red-300 bg-red-50' : days <= 30 ? 'border-amber-300 bg-amber-50' : 'border-sky-300 bg-sky-50'
  const urgencyText = days <= 15 ? 'text-red-700' : days <= 30 ? 'text-amber-700' : 'text-sky-700'

  return (
    <div className={`rounded-lg border p-4 ${urgencyCls}`}>
      {/* Expiry banner */}
      {showBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${urgencyText}`}>
              🗓️ Lease expires in {days} day{days === 1 ? '' : 's'} ({agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '—'})
            </p>
            <p className="mt-0.5 text-xs text-charcoal/60">
              {days > 45
                ? 'Reminders are sent automatically at 60, 30 and 15 days before expiry.'
                : days > 20
                  ? 'Time to agree on renewal terms — propose or accept below.'
                  : 'Final stretch: agree on renewal terms to avoid losing your home.'}
            </p>
          </div>
          {!proposal || proposal.status !== 'proposed' ? (
            <button
              type="button"
              onClick={() => { setShowForm((v) => !v); if (!suggestion) loadSuggestion() }}
              className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white hover:bg-rust-dark"
            >
              {showForm ? 'Close' : 'Propose renewal'}
            </button>
          ) : null}
        </div>
      )}

      {/* Pending proposal from the other party */}
      {proposal && proposal.status === 'proposed' && proposal.proposedBy !== myRole && (
        <div className="mt-3 rounded-lg border border-charcoal/10 bg-white p-4">
          <p className="text-sm font-semibold text-charcoal">
            {proposal.proposedBy === 'landlord' ? 'Your landlord' : 'Your tenant'} proposed a renewal
            {proposal.suggestedByAI && <span className="ml-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">AI-suggested price</span>}
          </p>
          <p className="mt-1 text-sm text-charcoal/70">
            <span className="font-semibold">ETB {proposal.newRentAmount.toLocaleString()}/mo</span> (currently {`ETB ${currentRent.toLocaleString()}`}
            {currentRent > 0 && (() => { const pct = Math.round(((proposal.newRentAmount - currentRent) / currentRent) * 100); return pct !== 0 ? `, ${pct > 0 ? '+' : ''}${pct}%` : '' })()})
            {' '}until <span className="font-semibold">{new Date(proposal.newEndDate).toLocaleDateString()}</span>
          </p>
          {proposal.message && <p className="mt-1.5 text-xs italic text-charcoal/50">“{proposal.message}”</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => respond('accept')}
              className="rounded-lg bg-verified px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Accept & renew (one click)'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => respond('reject')}
              className="rounded-lg border border-charcoal/20 px-4 py-2 text-sm font-semibold text-charcoal/70 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* My pending proposal — waiting on the other party */}
      {proposal && proposal.status === 'proposed' && proposal.proposedBy === myRole && (
        <div className="mt-3 rounded-lg border border-charcoal/10 bg-white p-4">
          <p className="text-sm font-medium text-charcoal">
            ⏳ Your renewal proposal (ETB {proposal.newRentAmount.toLocaleString()}/mo until {new Date(proposal.newEndDate).toLocaleDateString()}) is waiting for the {myRole === 'tenant' ? 'landlord' : 'tenant'}&apos;s response. They have been notified.
          </p>
        </div>
      )}

      {/* Rejected proposal note */}
      {proposal && proposal.status === 'rejected' && (
        <p className="mt-2 text-xs text-charcoal/50">The last renewal proposal was declined. You can propose new terms.</p>
      )}

      {/* Propose form */}
      {showForm && (
        <div className="mt-3 rounded-lg border border-charcoal/10 bg-white p-4">
          <h4 className="text-sm font-semibold text-charcoal">Propose renewal terms</h4>

          {loadingSuggestion && <p className="mt-2 text-xs text-charcoal/50">Getting market price estimate…</p>}

          {suggestion && (
            <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="text-sm font-semibold text-sky-800">
                🤖 AI suggestion: ETB {suggestion.suggested.toLocaleString()}/mo
                <span className="ml-2 text-xs font-normal text-sky-600">
                  range ETB {suggestion.rangeLow.toLocaleString()}–{suggestion.rangeHigh.toLocaleString()}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-sky-700">{suggestion.explanation}</p>
              <p className="mt-1 text-[10px] text-sky-500">
                Market estimate ETB {suggestion.marketEstimate.toLocaleString()} • confidence {Math.round(suggestion.confidence * 100)}% • heuristic model, human decides
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-charcoal/70">New monthly rent (ETB)</span>
              <input
                type="number"
                min={1}
                value={newRent}
                onChange={(e) => setNewRent(e.target.value)}
                className="mt-1 w-full rounded-md border border-charcoal/20 px-3 py-2 text-sm"
                placeholder={String(currentRent)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-charcoal/70">New end date</span>
              <input
                type="date"
                value={newEnd}
                min={agreement.endDate}
                onChange={(e) => setNewEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-charcoal/20 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-charcoal/70">Message (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-charcoal/20 px-3 py-2 text-sm"
              placeholder="e.g. Great tenant, happy to renew at a small increase to cover inflation."
            />
          </label>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={propose}
            className="mt-3 rounded-lg bg-rust px-5 py-2 text-sm font-semibold text-white hover:bg-rust-dark disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send renewal proposal'}
          </button>
        </div>
      )}

      {error && !showForm && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
