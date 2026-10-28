'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface MaintenanceRequest {
  _id: string
  title: string
  description?: string
  category?: string
  priority: 'low' | 'medium' | 'high'
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  assignedTo?: string | { firstName?: string; lastName?: string; phone?: string }
  response?: string
  resolutionNote?: string
  tenantConfirmedResolution?: boolean
  scheduledDate?: string
  createdAt: string
  propertyId?: { _id?: string; title?: string; location?: { city?: string; subCity?: string } } | string
  agreementId?: string
}

interface AgreementRow {
  _id: string
  propertyId?: { _id?: string; title?: string } | string
  landlordId?: { _id?: string; firstName?: string; lastName?: string } | string
  status?: string
}

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-rust text-white',
  medium: 'bg-gold text-charcoal',
  low: 'bg-sand text-charcoal',
}

const STATUS_LABEL: Record<string, string> = {
  reported: 'Reported / Pending',
  assigned: 'Worker Assigned',
  in_progress: 'In Progress',
  resolved: 'Completed / Ready to Verify',
  closed: 'Closed & Confirmed',
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  appliances: 'Appliances',
  structural: 'Structural / Doors / Windows',
  pest_control: 'Pest Control',
  other: 'General Maintenance',
}

export default function MaintenancePage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)
  const [selectedAgreementId, setSelectedAgreementId] = useState('')
  const [category, setCategory] = useState('plumbing')
  const [newRequest, setNewRequest] = useState<{
    issue: string
    priority: 'high' | 'medium' | 'low'
    description: string
  }>({ issue: '', priority: 'medium', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''

  const fetchAgreements = useCallback(async () => {
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/agreements/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const d = await res.json()
        const rows: AgreementRow[] = Array.isArray(d) ? d : (d.data || d.agreements || [])
        setAgreements(rows)

        // URL query parameter check (?agreementId=...)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const targetId = urlParams.get('agreementId')
          if (targetId && rows.some(r => r._id === targetId)) {
            setSelectedAgreementId(targetId)
            setShowNewRequestForm(true)
          } else if (rows.length > 0 && !selectedAgreementId) {
            setSelectedAgreementId(rows[0]._id)
          }
        } else if (rows.length > 0 && !selectedAgreementId) {
          setSelectedAgreementId(rows[0]._id)
        }
      }
    } catch {
      /* ignore */
    }
  }, [selectedAgreementId])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/maintenance/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setRequests(data.data || data.requests || [])
      } else if (res.status === 401) {
        setError('Please log in as a tenant to see your maintenance requests.')
      } else {
        setError(`Could not load maintenance requests (${res.status}). Please try again later.`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgreements()
    fetchRequests()
  }, [fetchAgreements, fetchRequests])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRequest.issue.trim()) {
      setSubmitMessage({ type: 'error', text: 'Please describe the issue.' })
      return
    }
    setSubmitting(true)
    setSubmitMessage(null)
    try {
      const token = getToken()
      const agr = agreements.find(a => a._id === selectedAgreementId)
      const propId = agr && typeof agr.propertyId === 'object' && agr.propertyId ? agr.propertyId._id : (agr?.propertyId || '')

      const res = await fetch(`${API_URL}/api/v1/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agreementId: selectedAgreementId || undefined,
          propertyId: propId || undefined,
          category,
          title: newRequest.issue.trim(),
          description: newRequest.description.trim() || undefined,
          priority: newRequest.priority,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitMessage({ type: 'success', text: 'Maintenance request submitted! Your landlord has been notified.' })
        setNewRequest({ issue: '', priority: 'medium', description: '' })
        setShowNewRequestForm(false)
        fetchRequests()
      } else {
        setSubmitMessage({ type: 'error', text: j.message || `Submission failed (${res.status})` })
      }
    } catch {
      setSubmitMessage({ type: 'error', text: 'Submission failed — network error.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmResolution = async (id: string) => {
    setConfirmingId(id)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/maintenance/${id}/confirm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (res.ok) {
        setSubmitMessage({ type: 'success', text: 'Resolution confirmed! The ticket is now closed.' })
        fetchRequests()
      } else {
        const j = await res.json().catch(() => ({}))
        setSubmitMessage({ type: 'error', text: j.message || 'Could not confirm resolution.' })
      }
    } catch {
      setSubmitMessage({ type: 'error', text: 'Network error while confirming resolution.' })
    } finally {
      setConfirmingId(null)
    }
  }

  const propTitle = (r: MaintenanceRequest) =>
    (typeof r.propertyId === 'object' ? r.propertyId?.title : null) || 'Rental Property'

  const assignedWorker = (r: MaintenanceRequest) => {
    if (!r.assignedTo) return null
    if (typeof r.assignedTo === 'object') {
      return `${r.assignedTo.firstName || ''} ${r.assignedTo.lastName || ''} ${r.assignedTo.phone ? `(${r.assignedTo.phone})` : ''}`.trim()
    }
    return String(r.assignedTo)
  }

  const getPriorityText = (priority?: string | null) =>
    priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium'

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.maintenance.title}</h1>
            <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.maintenance.subtitle}</p>
          </div>
          <button
            onClick={() => setShowNewRequestForm(true)}
            className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rust-dark transition-colors flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New Request</span>
          </button>
        </div>

        {submitMessage && (
          <div className={`rounded-xl border p-4 ${
            submitMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <p className="text-sm font-medium">{submitMessage.text}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon="maintenance"
            title="No maintenance requests"
            description="When you report an issue with plumbing, electrical, or appliances, its tracking and status will appear here."
            actionLabel="Report an Issue"
            onAction={() => setShowNewRequestForm(true)}
          />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const worker = assignedWorker(request)
              const responseNote = request.response || request.resolutionNote

              return (
                <div
                  key={request._id}
                  className="bg-white rounded-xl border border-charcoal/10 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-charcoal">{request.title}</h3>
                        {request.category && (
                          <span className="rounded-full bg-charcoal/5 px-2.5 py-0.5 text-xs font-semibold text-charcoal/70">
                            {CATEGORY_LABELS[request.category] || request.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal/60 mt-1 font-medium">{propTitle(request)}</p>
                      {request.description && (
                        <p className="text-sm text-charcoal/75 mt-2 bg-cream/30 p-3 rounded-lg border border-charcoal/5">
                          {request.description}
                        </p>
                      )}
                      <p className="text-xs text-charcoal/40 mt-2">
                        Reported on {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${PRIORITY_STYLE[request.priority] || PRIORITY_STYLE.low}`}>
                        {getPriorityText(request.priority)} Priority
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        request.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        request.status === 'closed' ? 'bg-charcoal/10 text-charcoal/70' :
                        request.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {STATUS_LABEL[request.status] || request.status}
                      </span>
                    </div>
                  </div>

                  {/* Technician and landlord response banner */}
                  {(worker || responseNote) && (
                    <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛠️</span>
                        <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                          Landlord Action &amp; Technician Assigned
                        </p>
                      </div>

                      {worker && (
                        <p className="text-sm text-blue-950 font-medium">
                          <span className="font-semibold text-blue-800">Assigned Technician:</span> {worker}
                        </p>
                      )}

                      {responseNote && (
                        <p className="text-xs text-blue-900/90 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-blue-200/40">
                          <span className="font-semibold text-blue-950 block mb-0.5">Landlord Update:</span>
                          {responseNote}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Resolution Confirmation Action for Tenant */}
                  {request.status === 'resolved' && !request.tenantConfirmedResolution && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-emerald-900">Work Marked Completed by Landlord</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Please inspect the repair in your home. If satisfied, confirm the resolution to officially close this ticket.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConfirmResolution(request._id)}
                        disabled={confirmingId === request._id}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-colors disabled:opacity-50 shrink-0"
                      >
                        {confirmingId === request._id ? 'Confirming...' : '✓ Confirm Resolution & Close'}
                      </button>
                    </div>
                  )}

                  {request.tenantConfirmedResolution && (
                    <div className="rounded-lg bg-cream/40 border border-charcoal/10 px-3 py-2 text-xs text-charcoal/70 flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>You verified and confirmed the resolution of this ticket.</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* New request modal */}
        {showNewRequestForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewRequestForm(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between border-b border-charcoal/10 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-charcoal">New Maintenance Request</h3>
                  <p className="text-xs text-charcoal/50">Report an issue to your landlord with full tracking</p>
                </div>
                <button onClick={() => setShowNewRequestForm(false)} className="text-charcoal/40 hover:text-charcoal text-lg font-bold">✕</button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                {/* Related lease/property */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Rented Property / Lease *
                  </label>
                  <select
                    value={selectedAgreementId}
                    onChange={(e) => setSelectedAgreementId(e.target.value)}
                    className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm focus:border-rust focus:outline-none"
                  >
                    {agreements.length === 0 && <option value="">No active lease agreement found</option>}
                    {agreements.map((a) => {
                      const title = typeof a.propertyId === 'object' && a.propertyId ? a.propertyId.title : 'Rental Home'
                      const host = typeof a.landlordId === 'object' && a.landlordId ? `${a.landlordId.firstName || ''} ${a.landlordId.lastName || ''}`.trim() : ''
                      return (
                        <option key={a._id} value={a._id}>
                          {title} {host ? `(Landlord: ${host})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm focus:border-rust focus:outline-none"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                      Urgency / Priority *
                    </label>
                    <select
                      value={newRequest.priority}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                      className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm focus:border-rust focus:outline-none"
                    >
                      <option value="low">Low (Cosmetic, minor)</option>
                      <option value="medium">Medium (Standard repair)</option>
                      <option value="high">High (Urgent: leaks, electrical, heating)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Brief Summary / Issue *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRequest.issue}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, issue: e.target.value }))}
                    placeholder="e.g. Bathroom water heater cuts off power"
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm focus:border-rust focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Detailed Description
                  </label>
                  <textarea
                    value={newRequest.description}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Describe where the issue is, when it started, and any symptoms..."
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm focus:border-rust focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-charcoal/10">
                  <button
                    type="button"
                    onClick={() => setShowNewRequestForm(false)}
                    className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2 text-sm font-semibold text-charcoal/70 hover:bg-charcoal/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white hover:bg-rust-dark shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
