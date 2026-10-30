'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface MaintenanceUpdate {
  status?: string
  note?: string
  changedBy?: string
  at?: string
  date?: string
}

interface MaintenanceTicket {
  _id: string
  propertyId?: {
    _id?: string
    title?: string
    location?: { city?: string; subCity?: string; neighborhood?: string }
  } | string
  tenantId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
  landlordId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
  issue: string
  description?: string
  category?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved'
  assignedTo?: string
  scheduledDate?: string
  resolvedAt?: string
  updates?: MaintenanceUpdate[]
  history?: MaintenanceUpdate[]
  createdAt?: string
}

const STATUS_STYLES: Record<string, string> = {
  reported: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-stone-100 text-stone-600 border-stone-200',
}

const FILTERS = ['all', 'reported', 'assigned', 'in_progress', 'resolved'] as const

function fmtDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

export default function AdminMaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [search, setSearch] = useState('')
  const [inspectTicket, setInspectTicket] = useState<MaintenanceTicket | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/admin/maintenance`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Could not fetch maintenance tickets')
      const json = await res.json()
      setTickets(json.data || [])
    } catch {
      setError('Could not load maintenance tickets. Ensure backend is running and you are signed in as administrator.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getPropTitle = (t: MaintenanceTicket) => {
    if (typeof t.propertyId === 'object' && t.propertyId?.title) return t.propertyId.title
    return 'Residential Rental'
  }

  const getTenantName = (t: MaintenanceTicket) => {
    if (typeof t.tenantId === 'object' && t.tenantId) {
      return `${t.tenantId.firstName || ''} ${t.tenantId.lastName || ''}`.trim() || t.tenantId.email || 'Tenant'
    }
    return 'Tenant'
  }

  const getLandlordName = (t: MaintenanceTicket) => {
    if (typeof t.landlordId === 'object' && t.landlordId) {
      return `${t.landlordId.firstName || ''} ${t.landlordId.lastName || ''}`.trim() || t.landlordId.email || 'Landlord'
    }
    return 'Landlord'
  }

  const filtered = tickets
    .filter((t) => filter === 'all' || t.status === filter)
    .filter((t) => {
      if (!search.trim()) return true
      const s = search.toLowerCase()
      const prop = getPropTitle(t).toLowerCase()
      const tenant = getTenantName(t).toLowerCase()
      const landlord = getLandlordName(t).toLowerCase()
      const issue = (t.issue || '').toLowerCase()
      const desc = (t.description || '').toLowerCase()
      return prop.includes(s) || tenant.includes(s) || landlord.includes(s) || issue.includes(s) || desc.includes(s)
    })

  const urgentCount = tickets.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'resolved').length
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length
  const resolvedCount = tickets.filter((t) => t.status === 'resolved').length

  return (
    <>
      <TopBar title="Maintenance & Habitability Oversight" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-charcoal">Property Maintenance Oversight</h1>
          <p className="text-sm text-charcoal/60">
            Monitor tenant repair requests, landlord response times, and property safety compliance across all active residences.
          </p>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-charcoal/50">Total Tickets</p>
            <p className="mt-1 font-display text-2xl font-bold text-charcoal">{tickets.length}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-rose-800">Urgent / High Priority</p>
            <p className="mt-1 font-display text-2xl font-bold text-rose-700">{urgentCount}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-purple-800">In Progress</p>
            <p className="mt-1 font-display text-2xl font-bold text-purple-700">{inProgressCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-800">Resolved</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{resolvedCount}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-rust text-white shadow-sm'
                    : 'border border-charcoal/10 bg-white text-charcoal/70 hover:bg-sand'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by issue, property, or tenant…"
            className="w-full rounded-lg border border-charcoal/10 bg-white py-2 px-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none sm:w-72"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</p>}

        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No maintenance tickets found"
            description="No repair tickets match the selected filters."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <div className="divide-y divide-charcoal/10">
              {filtered.map((t) => {
                const propTitle = getPropTitle(t)
                const tenantName = getTenantName(t)
                const landlordName = getLandlordName(t)

                return (
                  <div key={t._id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-sand/15">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-charcoal">{t.issue}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium}`}>
                          {t.priority}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[t.status] || STATUS_STYLES.reported}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/70 line-clamp-1">
                        {t.description || 'No description provided.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal/60">
                        <span>🏠 {propTitle}</span>
                        <span>👤 <strong>Tenant:</strong> {tenantName}</span>
                        <span>🔑 <strong>Landlord:</strong> {landlordName}</span>
                        <span>📅 Reported: {fmtDate(t.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setInspectTicket(t)}
                        className="rounded-lg border border-charcoal/15 bg-white px-3.5 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
                      >
                        Inspect Progress
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Maintenance Detail Modal */}
        {inspectTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-charcoal">{inspectTicket.issue}</h2>
                  <p className="text-xs text-charcoal/50">Property: {getPropTitle(inspectTicket)} · ID: {inspectTicket._id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectTicket(null)}
                  className="rounded-lg p-1.5 text-charcoal/50 hover:bg-sand hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Status & Priority Overview */}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-sand/30 p-4">
                  <div>
                    <p className="text-charcoal/50">Priority & Severity</p>
                    <p className="mt-0.5 font-bold uppercase text-charcoal">{inspectTicket.priority}</p>
                    <p className="text-[11px] text-charcoal/60">Category: {inspectTicket.category || 'General Repair'}</p>
                  </div>
                  <div>
                    <p className="text-charcoal/50">Current Status</p>
                    <p className="mt-0.5 font-bold capitalize text-rust">{inspectTicket.status.replace('_', ' ')}</p>
                    <p className="text-[11px] text-charcoal/60">
                      {inspectTicket.scheduledDate ? `Scheduled: ${fmtDate(inspectTicket.scheduledDate)}` : inspectTicket.resolvedAt ? `Resolved: ${fmtDate(inspectTicket.resolvedAt)}` : 'Awaiting schedule'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="rounded-xl border border-charcoal/10 p-4">
                  <p className="font-semibold text-charcoal">Reported Problem Description:</p>
                  <p className="mt-1 leading-relaxed text-charcoal/80">{inspectTicket.description || inspectTicket.issue}</p>
                </div>

                {/* Updates Log */}
                <div>
                  <p className="font-semibold text-charcoal">Action Log & Resolution Notes:</p>
                  {((inspectTicket.updates && inspectTicket.updates.length > 0) || (inspectTicket.history && inspectTicket.history.length > 0)) ? (
                    <div className="mt-2 space-y-2">
                      {(inspectTicket.updates || inspectTicket.history || []).map((u, i) => (
                        <div key={i} className="rounded-lg border border-charcoal/10 bg-white p-3">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-charcoal capitalize">{u.status || 'Update'}</span>
                            <span className="text-charcoal/50">{fmtDate(u.at || u.date)}</span>
                          </div>
                          <p className="mt-1 text-charcoal/70">{u.note || 'Status updated.'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 italic text-charcoal/50">No technician updates recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-charcoal/10 pt-4">
                <button
                  type="button"
                  onClick={() => setInspectTicket(null)}
                  className="rounded-lg bg-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal/90"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

