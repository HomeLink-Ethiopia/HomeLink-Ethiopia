'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface MaintenanceRequest {
  _id: string
  title: string
  issue?: string
  description?: string
  category?: 'plumbing' | 'electrical' | 'structural' | 'appliances' | 'pest_control' | 'other' | string
  priority: 'low' | 'medium' | 'high'
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'submitted' | string
  assignedTo?: string
  response?: string
  images?: { url: string }[] | string[]
  createdAt: string
  propertyId?: { title?: string } | string
}

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-rust text-white',
  medium: 'bg-gold text-charcoal',
  low: 'bg-sand text-charcoal',
}

const STATUS_LABELS: Record<string, string> = {
  reported: 'Reported',
  submitted: 'Reported',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  reported: 'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
}

const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'structural', label: 'Structural' },
  { value: 'appliances', label: 'Appliances' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'other', label: 'Other' },
]

export default function MaintenancePage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [newRequest, setNewRequest] = useState<{
    issue: string
    category: string
    priority: 'high' | 'medium' | 'low'
    description: string
    imageUrl: string
  }>({ issue: '', category: 'plumbing', priority: 'medium', description: '', imageUrl: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/maintenance/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const raw = Array.isArray(data) ? data : data.data || data.requests || []
        setRequests(Array.isArray(raw) ? raw.filter(Boolean) : [])
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

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRequest.issue.trim()) {
      setSubmitMessage({ type: 'error', text: 'Please describe the issue.' })
      return
    }
    setSubmitting(true)
    setSubmitMessage(null)
    try {
      const token = localStorage.getItem('hl_token')
      const imagesPayload = newRequest.imageUrl.trim() ? [{ url: newRequest.imageUrl.trim() }] : []
      const res = await fetch(`${API_URL}/api/v1/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          title: newRequest.issue.trim(),
          issue: newRequest.issue.trim(),
          category: newRequest.category,
          description: newRequest.description.trim() || undefined,
          priority: newRequest.priority,
          images: imagesPayload,
          mediaUrls: newRequest.imageUrl.trim() ? [newRequest.imageUrl.trim()] : [],
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitMessage({ type: 'success', text: 'Request submitted. Your landlord has been notified.' })
        setNewRequest({ issue: '', category: 'plumbing', priority: 'medium', description: '', imageUrl: '' })
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
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/maintenance/${id}/confirm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (res.ok) {
        setSubmitMessage({ type: 'success', text: 'Resolution confirmed! Ticket is now closed.' })
        fetchRequests()
      }
    } catch {
      setSubmitMessage({ type: 'error', text: 'Could not confirm resolution.' })
    } finally {
      setConfirmingId(null)
    }
  }

  const propTitle = (r: MaintenanceRequest) =>
    (typeof r.propertyId === 'object' ? r.propertyId?.title : null) || ''

  const getPriorityText = (priority?: string | null) =>
    priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium'

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === statusFilter || (statusFilter === 'reported' && r.status === 'submitted'))

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.maintenance.title}</h1>
            <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.maintenance.subtitle}</p>
          </div>
          <button
            onClick={() => setShowNewRequestForm(true)}
            className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90 transition-colors"
          >
            New Request
          </button>
        </div>

        {submitMessage && (
          <div className={`rounded-lg border p-4 ${
            submitMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <p className="text-sm font-medium">{submitMessage.text}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'reported', 'assigned', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-rust text-white'
                  : 'bg-sand/50 text-charcoal hover:bg-sand'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s] || s}
              {s !== 'all' && (
                <span className="ml-1 text-xs opacity-70">
                  ({requests.filter((r) => r.status === s || (s === 'reported' && r.status === 'submitted')).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonList count={3} />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon="maintenance"
            title="No maintenance requests"
            description="When you report an issue, its status will appear here."
          />
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const displayStatus = request.status === 'submitted' ? 'reported' : request.status
              return (
                <div
                  key={request._id}
                  className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-charcoal">{request.title || request.issue}</h3>
                        {request.category && (
                          <span className="rounded-full bg-charcoal/10 px-2.5 py-0.5 text-xs font-medium text-charcoal capitalize">
                            {request.category.replace('_', ' ')}
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[displayStatus] || STATUS_COLORS.reported}`}>
                          {STATUS_LABELS[displayStatus] || displayStatus}
                        </span>
                      </div>

                      {propTitle(request) && (
                        <p className="text-sm text-charcoal/60 mt-1">{propTitle(request)}</p>
                      )}
                      {request.description && (
                        <p className="text-sm text-charcoal/70 mt-2">{request.description}</p>
                      )}
                      <p className="text-xs text-charcoal/40 mt-2">
                        Submitted {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${PRIORITY_STYLE[request.priority] || PRIORITY_STYLE.low}`}>
                        {getPriorityText(request.priority)}
                      </span>
                    </div>
                  </div>

                  {/* Images preview */}
                  {request.images && request.images.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-medium text-charcoal/50 mb-2">Attached Images:</p>
                      <div className="flex gap-2 flex-wrap">
                        {request.images.map((img: any, i: number) => {
                          const src = typeof img === 'string' ? img : img.url
                          return (
                            <a
                              key={i}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative h-20 w-24 overflow-hidden rounded-lg border border-charcoal/10 hover:opacity-90 transition-opacity"
                            >
                              <img src={src} alt="Issue photo" className="h-full w-full object-cover" />
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Landlord Response / Worker info */}
                  {(request.assignedTo || request.response) && (
                    <div className="rounded-lg bg-sand/30 border border-charcoal/10 p-3 space-y-1.5">
                      {request.assignedTo && (
                        <p className="text-xs text-charcoal/70">
                          <span className="font-semibold text-charcoal">Assigned Technician:</span> {request.assignedTo}
                        </p>
                      )}
                      {request.response && (
                        <div>
                          <p className="text-xs font-semibold text-charcoal">Landlord Response:</p>
                          <p className="text-sm text-charcoal/80 mt-0.5">{request.response}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tenant resolution confirmation action */}
                  {request.status === 'resolved' && (
                    <div className="pt-2 flex items-center justify-between border-t border-charcoal/10">
                      <p className="text-xs text-emerald-700 font-medium">The landlord marked this issue as resolved. Has it been fixed to your satisfaction?</p>
                      <button
                        onClick={() => handleConfirmResolution(request._id)}
                        disabled={confirmingId === request._id}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {confirmingId === request._id ? 'Closing…' : 'Confirm & Close Ticket'}
                      </button>
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
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-charcoal">New Maintenance Request</h3>
                <button onClick={() => setShowNewRequestForm(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
              </div>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal/70">Issue *</label>
                  <input
                    type="text"
                    required
                    value={newRequest.issue}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, issue: e.target.value }))}
                    placeholder="e.g., Broken water heater in bathroom"
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-charcoal/70">Category *</label>
                    <select
                      value={newRequest.category}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-charcoal/70">Priority *</label>
                    <select
                      value={newRequest.priority}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                      className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    >
                      <option value="low">Low (can wait)</option>
                      <option value="medium">Medium (fix this week)</option>
                      <option value="high">High (urgent daily impact)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal/70">Description</label>
                  <textarea
                    value={newRequest.description}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Describe the problem, specific location, and when it started..."
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust resize-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal/70">Image / Photo URL (optional)</label>
                  <input
                    type="url"
                    value={newRequest.imageUrl}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  />
                  <p className="mt-1 text-[11px] text-charcoal/40">Provide a direct photo URL or screenshot of the damage</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewRequestForm(false)} className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-rust px-4 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50">
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

