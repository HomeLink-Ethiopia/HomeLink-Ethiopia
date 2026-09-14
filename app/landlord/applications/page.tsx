'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { notify } from '@/lib/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Application {
  _id: string
  propertyId?: { title?: string; rentAmount?: number } | string
  tenantId?: { firstName?: string; lastName?: string; email?: string; phone?: string } | string
  fullName?: string
  phone?: string
  email?: string
  employmentStatus?: string
  monthlyIncomeEtb?: number
  moveInDate?: string
  message?: string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-gold text-charcoal',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-verified text-white',
  rejected: 'bg-rust text-white',
  withdrawn: 'bg-charcoal/10 text-charcoal/50',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'New',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export default function LandlordApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apps, setApps] = useState<Application[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('all')

  const fetchApps = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/applications/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setApps(data.data || data.applications || [])
      } else if (res.status === 401) {
        setError('Please log in as a landlord to review applications.')
      } else {
        setError(`Could not load applications (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApps() }, [fetchApps])

  async function review(id: string, decision: 'under_review' | 'approved' | 'rejected') {
    setBusyId(id)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/applications/${id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({ status: decision }),
      })
      if (res.ok) {
        setApps((prev) => prev.map((a) => (a._id === id ? { ...a, status: decision } : a)))
        const app = apps.find((a) => a._id === id)
        const propTitle = (typeof app?.propertyId === 'object' ? app?.propertyId?.title : null) || 'your property'
        if (decision === 'approved') {
          notify('application_accepted', 'Application accepted', `You approved the application for ${propTitle}. The tenant has been notified.`, '/landlord/tenants')
        } else if (decision === 'rejected') {
          notify('application_rejected', 'Application rejected', `You rejected the application for ${propTitle}.`, '/landlord/applications')
        } else {
          notify('application_under_review', 'Application under review', `Started reviewing the application for ${propTitle}.`, '/landlord/applications')
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not update the application (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const propertyTitle = (a: Application) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Property'
  const propertyRent = (a: Application) =>
    typeof a.propertyId === 'object' ? a.propertyId?.rentAmount : undefined
  const applicantName = (a: Application) =>
    a.fullName || (typeof a.tenantId === 'object' ? `${a.tenantId?.firstName || ''} ${a.tenantId?.lastName || ''}`.trim() : '') || 'Applicant'
  const applicantEmail = (a: Application) =>
    a.email || (typeof a.tenantId === 'object' ? a.tenantId?.email : undefined)
  const applicantPhone = (a: Application) =>
    a.phone || (typeof a.tenantId === 'object' ? a.tenantId?.phone : undefined)

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.status === filter)
  const counts = {
    all: apps.length,
    submitted: apps.filter((a) => a.status === 'submitted').length,
    under_review: apps.filter((a) => a.status === 'under_review').length,
    approved: apps.filter((a) => a.status === 'approved').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
  }

  return (
    <>
      <TopBar title="Applications" subtitle="Review tenant applications for your properties." />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'submitted', 'under_review', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? 'bg-rust text-white' : 'border border-charcoal/15 text-charcoal/60 hover:border-rust hover:text-rust'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
              <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="document"
            title={filter === 'all' ? 'No applications yet' : `No ${STATUS_LABEL[filter]?.toLowerCase() || ''} applications`}
            description="When tenants apply for your properties, their applications will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((app) => {
              const isBusy = busyId === app._id
              const isExpanded = expandedId === app._id
              const actionable = app.status === 'submitted' || app.status === 'under_review'
              return (
                <div key={app._id} className="rounded-lg border border-sand bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-charcoal">{applicantName(app)}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[app.status] || STATUS_STYLE.submitted}`}>
                          {STATUS_LABEL[app.status] || app.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-charcoal/60">
                        {propertyTitle(app)}
                        {propertyRent(app) ? ` • ETB ${propertyRent(app)!.toLocaleString()}/mo` : ''}
                      </p>
                      <p className="mt-1 text-xs text-charcoal/40">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                        {app.moveInDate ? ` • Move-in ${new Date(app.moveInDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : app._id)}
                        className="rounded-lg border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/60 hover:border-rust hover:text-rust"
                      >
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>
                      {app.status === 'submitted' && (
                        <button
                          type="button"
                          onClick={() => review(app._id, 'under_review')}
                          disabled={isBusy}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Start review
                        </button>
                      )}
                      {actionable && (
                        <>
                          <button
                            type="button"
                            onClick={() => review(app._id, 'approved')}
                            disabled={isBusy}
                            className="rounded-lg bg-verified px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => review(app._id, 'rejected')}
                            disabled={isBusy}
                            className="rounded-lg border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 grid gap-4 rounded-lg bg-cream/50 p-4 sm:grid-cols-2">
                      <div className="space-y-1.5 text-sm">
                        <p><span className="font-medium text-charcoal">Email:</span> {applicantEmail(app) || '—'}</p>
                        <p><span className="font-medium text-charcoal">Phone:</span> {applicantPhone(app) || '—'}</p>
                        <p className="capitalize">
                          <span className="font-medium text-charcoal">Employment:</span> {(app.employmentStatus || '—').replace('_', ' ')}
                        </p>
                        <p>
                          <span className="font-medium text-charcoal">Monthly income:</span>{' '}
                          {app.monthlyIncomeEtb ? `ETB ${app.monthlyIncomeEtb.toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <p><span className="font-medium text-charcoal">Property:</span> {propertyTitle(app)}</p>
                        {app.moveInDate && (
                          <p><span className="font-medium text-charcoal">Preferred move-in:</span> {new Date(app.moveInDate).toLocaleDateString()}</p>
                        )}
                        {app.message && (
                          <p className="text-charcoal/70"><span className="font-medium text-charcoal">Note:</span> {app.message}</p>
                        )}
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
