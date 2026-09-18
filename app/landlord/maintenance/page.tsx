'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface MaintenanceRequest {
  _id: string
  title?: string
  description?: string
  category?: string
  priority?: string
  status?: string
  assignedTo?: string
  response?: string
  respondedAt?: string
  images?: { url: string; uploadedAt?: string }[]
  createdAt?: string
  propertyId?: { title?: string; location?: string } | string
  tenantId?: { firstName?: string; lastName?: string; phone?: string } | string
}

const STATUS_LABELS: Record<string, string> = {
  reported: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  structural: 'Structural',
  appliances: 'Appliances',
  pest_control: 'Pest Control',
  other: 'Other',
}

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [assignValue, setAssignValue] = useState('')
  const [responseValue, setResponseValue] = useState('')
  const { t } = useLanguage()

  const getToken = () => localStorage.getItem('hl_token') || ''

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/maintenance/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(data.data || data.requests || [])
      } else if (res.status === 401) {
        setError('Please log in as a landlord to see maintenance requests.')
      } else {
        setError(`Could not load requests (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const updateStatus = async (id: string, status: string, extra?: Record<string, string>) => {
    setUpdatingId(id)
    try {
      const token = getToken()
      const body: Record<string, string> = { status, ...extra }
      const res = await fetch(`${API_URL}/api/v1/maintenance/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        fetchRequests()
        setSelectedId(null)
        setAssignValue('')
        setResponseValue('')
      }
    } catch { /* ignore */ }
    setUpdatingId(null)
  }

  const tenantName = (r: MaintenanceRequest) =>
    typeof r.tenantId === 'object' ? `${r.tenantId?.firstName || ''} ${r.tenantId?.lastName || ''}`.trim() : 'Tenant'

  const propertyTitle = (r: MaintenanceRequest) =>
    typeof r.propertyId === 'object' ? r.propertyId?.title : 'Property'

  const filtered = statusFilter === 'all' ? requests : requests.filter(r => r.status === statusFilter)
  const selected = requests.find(r => r._id === selectedId)

  const getPriorityColor = (p?: string) => {
    if (p === 'high') return 'bg-rust text-white'
    if (p === 'medium') return 'bg-gold text-charcoal'
    return 'bg-sand text-charcoal'
  }

  const getStatusColor = (s?: string) => {
    if (s === 'resolved' || s === 'closed') return 'text-green-600'
    if (s === 'in_progress' || s === 'assigned') return 'text-blue-600'
    return 'text-amber-600'
  }

  return (
    <>
      <TopBar title={t.dashboard.landlord.maintenance.title} subtitle={t.dashboard.landlord.maintenance.subtitle} />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'reported', 'assigned', 'in_progress', 'resolved', 'closed'].map(s => (
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
                  ({requests.filter(r => r.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonList count={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="maintenance"
            title="No maintenance requests"
            description="When tenants report maintenance issues, they will appear here."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-lg border border-sand p-6 cursor-pointer hover:border-rust/30 transition-colors"
                onClick={() => setSelectedId(selectedId === request._id ? null : request._id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-charcoal">
                        {request.title || request.description || 'Maintenance request'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                        {request.priority?.toUpperCase() || 'MEDIUM'}
                      </span>
                      {request.category && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-charcoal/10 text-charcoal">
                          {CATEGORY_LABELS[request.category] || request.category}
                        </span>
                      )}
                      <span className={`text-xs font-medium ${getStatusColor(request.status)}`}>
                        {STATUS_LABELS[request.status || 'reported'] || request.status}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal/60 mt-1">{propertyTitle(request)}</p>
                    <p className="text-sm text-charcoal/60">Tenant: {tenantName(request)}</p>
                    {request.description && (
                      <p className="text-sm text-charcoal/70 mt-2">{request.description}</p>
                    )}
                    {request.images && request.images.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {request.images.map((img, i) => (
                          <span key={i} className="text-xs text-rust underline">Image {i + 1}</span>
                        ))}
                      </div>
                    )}
                    {request.createdAt && (
                      <p className="text-xs text-charcoal/40 mt-2">
                        Submitted {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    )}
                    {request.response && (
                      <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
                        <p className="text-xs font-medium text-green-700">Your response:</p>
                        <p className="text-sm text-green-800 mt-1">{request.response}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-charcoal/40">
                    {selectedId === request._id ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    )}
                  </div>
                </div>

                {/* Expanded action panel */}
                {selectedId === request._id && (
                  <div className="mt-4 pt-4 border-t border-charcoal/10 space-y-4" onClick={e => e.stopPropagation()}>
                    {/* Status actions */}
                    <div className="flex flex-wrap gap-2">
                      {request.status === 'reported' && (
                        <button
                          onClick={() => updateStatus(request._id, 'assigned')}
                          disabled={updatingId === request._id}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      )}
                      {(request.status === 'reported' || request.status === 'assigned') && (
                        <button
                          onClick={() => updateStatus(request._id, 'in_progress')}
                          disabled={updatingId === request._id}
                          className="px-4 py-2 rounded-lg bg-gold text-charcoal text-sm font-medium hover:bg-gold/80 disabled:opacity-50"
                        >
                          Start Work
                        </button>
                      )}
                      {request.status === 'in_progress' && (
                        <button
                          onClick={() => updateStatus(request._id, 'resolved')}
                          disabled={updatingId === request._id}
                          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {request.status === 'resolved' && (
                        <button
                          onClick={() => updateStatus(request._id, 'closed')}
                          disabled={updatingId === request._id}
                          className="px-4 py-2 rounded-lg bg-charcoal/70 text-white text-sm font-medium hover:bg-charcoal disabled:opacity-50"
                        >
                          Close
                        </button>
                      )}
                    </div>

                    {/* Assign to */}
                    <div>
                      <label className="text-sm font-medium text-charcoal">Assign to (worker name)</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={assignValue}
                          onChange={(e) => setAssignValue(e.target.value)}
                          placeholder="e.g. Abebe Electrician"
                          className="flex-1 rounded-lg border border-charcoal/20 px-3 py-2 text-sm focus:border-rust focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            if (assignValue.trim()) {
                              updateStatus(request._id, 'assigned', { assignedTo: assignValue.trim() })
                              setAssignValue('')
                            }
                          }}
                          disabled={!assignValue.trim() || updatingId === request._id}
                          className="px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Response */}
                    <div>
                      <label className="text-sm font-medium text-charcoal">Response to tenant</label>
                      <textarea
                        value={responseValue}
                        onChange={(e) => setResponseValue(e.target.value)}
                        placeholder="Describe the action taken or schedule..."
                        rows={3}
                        className="w-full mt-1 rounded-lg border border-charcoal/20 px-3 py-2 text-sm focus:border-rust focus:outline-none resize-none"
                      />
                      <button
                        onClick={() => {
                          if (responseValue.trim()) {
                            updateStatus(request._id, request.status || 'reported', { response: responseValue.trim() })
                            setResponseValue('')
                          }
                        }}
                        disabled={!responseValue.trim() || updatingId === request._id}
                        className="mt-2 px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark disabled:opacity-50"
                      >
                        Send Response
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
