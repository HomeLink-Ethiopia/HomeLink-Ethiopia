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
  priority: 'low' | 'medium' | 'high'
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  propertyId?: { title?: string } | string
}

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-rust text-white',
  medium: 'bg-gold text-charcoal',
  low: 'bg-sand text-charcoal',
}

const STATUS_LABEL: Record<string, string> = {
  reported: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Completed',
  closed: 'Closed',
}

export default function MaintenancePage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)
  const [newRequest, setNewRequest] = useState<{
    issue: string
    priority: 'high' | 'medium' | 'low'
    description: string
  }>({ issue: '', priority: 'medium', description: '' })
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
      const res = await fetch(`${API_URL}/api/v1/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          title: newRequest.issue.trim(),
          description: newRequest.description.trim() || undefined,
          priority: newRequest.priority,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitMessage({ type: 'success', text: 'Request submitted. Your landlord will be notified.' })
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

  const propTitle = (r: MaintenanceRequest) =>
    (typeof r.propertyId === 'object' ? r.propertyId?.title : null) || ''

  const getPriorityText = (priority: string) =>
    priority.charAt(0).toUpperCase() + priority.slice(1)

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.maintenance.title}</h1>
            <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.maintenance.subtitle}</p>
          </div>
          <button
            onClick={() => setShowNewRequestForm(true)}
            className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90"
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

        {loading ? (
          <SkeletonList count={3} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon="maintenance"
            title="No maintenance requests"
            description="When you report an issue, its status will appear here."
          />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-charcoal">{request.title}</h3>
                    {propTitle(request) && (
                      <p className="text-sm text-charcoal/60 mt-1">{propTitle(request)}</p>
                    )}
                    {request.description && (
                      <p className="text-sm text-charcoal/50 mt-2">{request.description}</p>
                    )}
                    <p className="text-xs text-charcoal/40 mt-2">
                      Submitted {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${PRIORITY_STYLE[request.priority] || PRIORITY_STYLE.low}`}>
                      {getPriorityText(request.priority)}
                    </span>
                    <span className="rounded-full bg-charcoal/5 px-3 py-1 text-xs font-medium text-charcoal/70">
                      {STATUS_LABEL[request.status] || request.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New request modal */}
        {showNewRequestForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewRequestForm(false)}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-charcoal">New Maintenance Request</h3>
                <button onClick={() => setShowNewRequestForm(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
              </div>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal/70">Issue *</label>
                  <input
                    type="text"
                    value={newRequest.issue}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, issue: e.target.value }))}
                    placeholder="e.g., Broken water heater"
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal/70">Priority</label>
                  <select
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                    className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal/70">Details</label>
                  <textarea
                    value={newRequest.description}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Describe the problem and where it is"
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  />
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
