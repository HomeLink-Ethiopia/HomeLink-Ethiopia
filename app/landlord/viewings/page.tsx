'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Viewing {
  _id: string
  propertyId?: { title?: string } | string
  tenantId?: { firstName?: string; lastName?: string; phone?: string } | string
  preferredDate?: string
  scheduledDate?: string
  preferredTime?: string
  scheduledTime?: string
  message?: string
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled'
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-gold text-charcoal',
  confirmed: 'bg-verified text-white',
  completed: 'bg-charcoal/15 text-charcoal',
  cancelled: 'bg-charcoal/10 text-charcoal/50',
  rescheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
}

const TIME_SLOTS = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00']

export default function LandlordViewingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewings, setViewings] = useState<Viewing[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  const fetchViewings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/viewings/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setViewings(data.data || data.viewings || [])
      } else if (res.status === 401) {
        setError('Please log in as a landlord to see viewing requests.')
      } else {
        setError(`Could not load viewing requests (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchViewings() }, [fetchViewings])

  async function act(id: string, action: 'accept' | 'reject' | 'complete', extra?: Record<string, unknown>) {
    setBusyId(id)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/viewings/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify(extra || {}),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const updated = data.data || data.viewing
        setViewings((prev) => prev.map((v) => (v._id === id ? { ...v, ...(updated || {}), _id: id } : v)))
        setRescheduleId(null)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not update the viewing (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const propertyTitle = (v: Viewing) =>
    (typeof v.propertyId === 'object' ? v.propertyId?.title : null) || 'Property'
  const tenantName = (v: Viewing) =>
    typeof v.tenantId === 'object'
      ? `${v.tenantId?.firstName || ''} ${v.tenantId?.lastName || ''}`.trim() || 'Tenant'
      : 'Tenant'
  const tenantPhone = (v: Viewing) =>
    typeof v.tenantId === 'object' ? v.tenantId?.phone : undefined
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—')

  return (
    <>
      <TopBar title="Viewing Requests" subtitle="Accept, decline, or reschedule tenant visits to your properties." />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : viewings.length === 0 ? (
          <EmptyState
            icon="search"
            title="No viewing requests"
            description="When tenants request a viewing on your properties, you can manage them here."
          />
        ) : (
          <div className="space-y-4">
            {viewings.map((v) => {
              const isBusy = busyId === v._id
              const isRescheduling = rescheduleId === v._id
              return (
                <div key={v._id} className="rounded-lg border border-sand bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-charcoal">{propertyTitle(v)}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[v.status] || STATUS_STYLE.requested}`}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-charcoal/70">
                        <span className="font-medium text-charcoal">{tenantName(v)}</span>
                        {tenantPhone(v) ? ` • ${tenantPhone(v)}` : ''}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-charcoal/70 sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-charcoal">Requested:</span>{' '}
                          {fmtDate(v.preferredDate || v.scheduledDate)} at {v.preferredTime || v.scheduledTime || '—'}
                        </p>
                        {v.status === 'confirmed' && v.scheduledDate && (
                          <p>
                            <span className="font-medium text-verified">Confirmed for:</span>{' '}
                            {fmtDate(v.scheduledDate)} at {v.scheduledTime || v.preferredTime}
                          </p>
                        )}
                      </div>
                      {v.message && (
                        <p className="mt-2 rounded bg-cream/60 px-3 py-2 text-xs text-charcoal/60">Tenant note: {v.message}</p>
                      )}
                    </div>

                    {v.status === 'requested' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => act(v._id, 'accept')}
                          disabled={isBusy}
                          className="rounded-lg bg-verified px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {isBusy ? '…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRescheduleId(isRescheduling ? null : v._id); setNewDate(''); setNewTime('') }}
                          disabled={isBusy}
                          className="rounded-lg border border-charcoal/15 px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:border-rust hover:text-rust disabled:opacity-50"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => act(v._id, 'reject')}
                          disabled={isBusy}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {v.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => act(v._id, 'complete')}
                        disabled={isBusy}
                        className="rounded-lg border border-charcoal/15 px-4 py-2 text-sm font-medium text-charcoal/70 transition-colors hover:border-verified hover:text-verified disabled:opacity-50"
                      >
                        {isBusy ? '…' : 'Mark completed'}
                      </button>
                    )}
                  </div>

                  {isRescheduling && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                      <p className="mb-3 text-sm font-medium text-charcoal">Propose a new time</p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-charcoal/60">New date</label>
                          <input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="rounded-lg border border-charcoal/15 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-charcoal/60">New time</label>
                          <select
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            className="rounded-lg border border-charcoal/15 px-3 py-2 text-sm"
                          >
                            <option value="">Select…</option>
                            {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => act(v._id, 'accept', { scheduledDate: newDate, scheduledTime: newTime, reschedule: true })}
                          disabled={!newDate || !newTime || isBusy}
                          className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Send new time
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
