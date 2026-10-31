'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Viewing {
  _id: string
  propertyId?: { title?: string; location?: { subCity?: string } } | string
  preferredDate?: string
  scheduledDate?: string
  preferredTime?: string
  scheduledTime?: string
  date?: string
  time?: string
  requestedSlots?: any[]
  tenantNote?: string
  message?: string
  landlordResponse?: string
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'pending'
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-gold text-charcoal',
  pending: 'bg-gold text-charcoal',
  confirmed: 'bg-verified text-white',
  completed: 'bg-charcoal/15 text-charcoal',
  cancelled: 'bg-rust text-white',
  rescheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Awaiting landlord',
  pending: 'Awaiting landlord',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Declined / Cancelled',
  rescheduled: 'Rescheduled',
}

export default function ViewingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewings, setViewings] = useState<Viewing[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchViewings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/viewings/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setViewings(data.data || data.viewings || [])
      } else if (res.status === 401) {
        setError('Please log in as a tenant to see your viewing requests.')
      } else {
        setError(`Could not load viewing requests (${res.status}). Please try again later.`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchViewings() }, [fetchViewings])

  async function cancelViewing(id: string) {
    setCancellingId(id)
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/viewings/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
      })
      if (res.ok) {
        setViewings((prev) => prev.map((v) => (v._id === id ? { ...v, status: 'cancelled' } : v)))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not cancel the viewing (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const propertyTitle = (v: Viewing) =>
    (typeof v.propertyId === 'object' ? v.propertyId?.title : null) || 'Property'
  const propertyArea = (v: Viewing) =>
    (typeof v.propertyId === 'object' ? v.propertyId?.location?.subCity : null) || ''

  const getSlotDate = (v: Viewing) => {
    if (v.preferredDate) return v.preferredDate
    if (v.scheduledDate) return v.scheduledDate
    if (v.date) return v.date
    if (Array.isArray(v.requestedSlots) && v.requestedSlots.length > 0) {
      const slot = v.requestedSlots[0]
      return typeof slot === 'string' ? slot : slot?.date
    }
    return undefined
  }

  const getSlotTime = (v: Viewing) => {
    if (v.preferredTime) return v.preferredTime
    if (v.scheduledTime) return v.scheduledTime
    if (v.time) return v.time
    if (Array.isArray(v.requestedSlots) && v.requestedSlots.length > 0) {
      const slot = v.requestedSlots[0]
      if (typeof slot === 'string' && slot.includes('T')) {
        const t = slot.split('T')[1]?.slice(0, 5)
        if (t && t !== '00:00') return t
      } else if (typeof slot === 'object' && slot) {
        return slot.startTime || slot.time
      }
    }
    if (v.date && v.date.includes('T')) {
      const t = v.date.split('T')[1]?.slice(0, 5)
      if (t && t !== '00:00') return t
    }
    return undefined
  }

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—')

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">Property Viewings</h1>
            <p className="mt-1 text-sm text-charcoal/60">Track your viewing requests and confirmed visits.</p>
          </div>
          <a
            href="/explore"
            className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-dark"
          >
            Request a viewing
          </a>
        </div>

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
            title="No viewing requests yet"
            description="When you schedule a viewing from a property page, its status will appear here."
            actionLabel="Browse Properties"
            actionHref="/explore"
          />
        ) : (
          <div className="space-y-4">
            {viewings.map((v) => (
              <div key={v._id} className="rounded-lg border border-sand bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-charcoal">{propertyTitle(v)}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[v.status] || STATUS_STYLE.requested}`}>
                        {STATUS_LABEL[v.status] || v.status}
                      </span>
                    </div>
                    {propertyArea(v) && <p className="mt-0.5 text-sm text-charcoal/60">{propertyArea(v)}</p>}

                    {(() => {
                      const reqDate = getSlotDate(v)
                      const reqTime = getSlotTime(v)
                      const confDate = v.scheduledDate || reqDate
                      const confTime = v.scheduledTime || reqTime
                      return (
                        <div className="mt-3 grid gap-2 text-sm text-charcoal/70 sm:grid-cols-2">
                          <p>
                            <span className="font-medium text-charcoal">Requested slot:</span>{' '}
                            <span className="font-semibold text-charcoal">{fmtDate(reqDate)}</span>
                            {reqTime ? <span className="font-bold text-rust"> at {reqTime}</span> : ''}
                          </p>
                          {v.status === 'confirmed' && (
                            <p>
                              <span className="font-medium text-verified">Confirmed visit:</span>{' '}
                              <span className="font-semibold text-charcoal">{fmtDate(confDate)}</span>
                              {confTime ? <span className="font-bold text-verified"> at {confTime}</span> : ''}
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {(v.message || v.tenantNote) && (
                      <p className="mt-2 rounded bg-cream/60 px-3 py-2 text-xs text-charcoal/60">Your note: {v.message || v.tenantNote}</p>
                    )}
                    {v.landlordResponse && (
                      <p className="mt-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">Landlord: {v.landlordResponse}</p>
                    )}
                    <p className="mt-2 text-xs text-charcoal/40">
                      Requested {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {(v.status === 'requested' || v.status === 'confirmed') && (
                    <button
                      type="button"
                      onClick={() => cancelViewing(v._id)}
                      disabled={cancellingId === v._id}
                      className="rounded-lg border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/60 transition-colors hover:border-rust hover:text-rust disabled:opacity-50"
                    >
                      {cancellingId === v._id ? 'Cancelling…' : 'Cancel viewing'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
