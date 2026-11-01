'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Application {
  _id: string
  propertyId?: { _id?: string; title?: string; location?: { subCity?: string; city?: string }; rentAmount?: number } | string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  createdAt: string
  landlordName?: string
  landlordProfileId?: { legalName?: string }
  message?: string
  moveInDate?: string
  durationMonths?: number
  monthlyIncome?: number
  numberOfOccupants?: number
  hasPets?: boolean
  landlordFeedback?: string
}

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-gold/20 text-charcoal border border-gold/40',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  withdrawn: 'bg-charcoal/10 text-charcoal/60 border border-charcoal/20',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Pending Review',
  under_review: 'Under Review',
  approved: 'Approved 🎉',
  rejected: 'Declined',
  withdrawn: 'Withdrawn',
}

export default function ApplicationsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/applications/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setApplications(Array.isArray(data) ? data : (data.data || data.applications || []))
      } else if (res.status === 401) {
        setError('Please log in as a tenant to see your applications.')
      } else {
        setError(`Could not load applications (${res.status}). Please try again later.`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  const handleWithdraw = async (appId: string) => {
    if (!confirm('Are you sure you want to withdraw this application? This cannot be undone.')) return
    setWithdrawingId(appId)
    setError('')
    setSuccessMsg('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/applications/${appId}/withdraw`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
      })
      if (res.ok) {
        setSuccessMsg('Application successfully withdrawn.')
        setApplications((prev) =>
          prev.map((a) => (a._id === appId ? { ...a, status: 'withdrawn' } : a))
        )
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.message || 'Failed to withdraw application.')
      }
    } catch {
      setError('Network error while withdrawing application.')
    } finally {
      setWithdrawingId(null)
    }
  }

  const propertyName = (a: Application) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Rental Property'

  const propertyArea = (a: Application) => {
    if (typeof a.propertyId === 'object' && a.propertyId?.location) {
      const loc = a.propertyId.location
      return [loc.subCity, loc.city].filter(Boolean).join(', ')
    }
    return ''
  }

  const rentAmount = (a: Application) =>
    typeof a.propertyId === 'object' ? a.propertyId?.rentAmount : null

  const landlord = (a: Application) =>
    a.landlordName || a.landlordProfileId?.legalName || 'Verified Landlord'

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.applications.title}</h1>
            <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.applications.subtitle}</p>
          </div>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-lg bg-rust px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rust/90 transition-colors"
          >
            Explore More Properties
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">{successMsg}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : applications.length === 0 ? (
          <EmptyState
            icon="document"
            title="No applications yet"
            description="When you apply for a property, your application status and next steps will appear here."
            actionLabel="Browse Verified Listings"
            actionHref="/explore"
          />
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const isApproved = application.status === 'approved'
              const canWithdraw = application.status === 'submitted' || application.status === 'under_review'
              const isExpanded = expandedId === application._id

              return (
                <div
                  key={application._id}
                  className={`bg-white rounded-xl border p-6 transition-all ${
                    isApproved ? 'border-emerald-300 shadow-sm ring-1 ring-emerald-200' : 'border-sand hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-charcoal">
                          {propertyName(application)}
                        </h3>
                        <span
                          className={`px-3 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_STYLE[application.status] || STATUS_STYLE.submitted
                          }`}
                        >
                          {STATUS_LABEL[application.status] || application.status}
                        </span>
                      </div>

                      {propertyArea(application) && (
                        <p className="text-sm text-charcoal/70 mt-1 flex items-center gap-1">
                          📍 {propertyArea(application)}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-charcoal/60 mt-2">
                        {rentAmount(application) && (
                          <span className="font-medium text-rust">
                            ETB {rentAmount(application)?.toLocaleString()} / month
                          </span>
                        )}
                        <span>Landlord: <strong className="text-charcoal/80">{landlord(application)}</strong></span>
                        <span>Applied: {new Date(application.createdAt).toLocaleDateString()}</span>
                      </div>

                      {application.landlordFeedback && (
                        <div className="mt-3 rounded-md bg-sand/30 p-2.5 text-xs text-charcoal/80 border border-sand">
                          <strong className="text-charcoal">Landlord Note:</strong> {application.landlordFeedback}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : application._id)}
                        className="rounded-lg border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:border-rust hover:text-rust transition-colors"
                      >
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>

                      {isApproved && (
                        <Link
                          href="/tenant/agreements"
                          className="rounded-lg bg-verified px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        >
                          <span>Review & Sign Lease Agreement</span>
                          <span>&rarr;</span>
                        </Link>
                      )}

                      {canWithdraw && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(application._id)}
                          disabled={withdrawingId === application._id}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          {withdrawingId === application._id ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-sand grid gap-4 text-xs sm:grid-cols-2 bg-cream/40 p-3.5 rounded-lg">
                      <div className="space-y-1.5">
                        <p><strong className="text-charcoal">Preferred Move-in Date:</strong> {application.moveInDate ? new Date(application.moveInDate).toLocaleDateString() : 'Flexible'}</p>
                        <p><strong className="text-charcoal">Lease Duration:</strong> {application.durationMonths ? `${application.durationMonths} months` : '12 months'}</p>
                        <p><strong className="text-charcoal">Occupants:</strong> {application.numberOfOccupants || 1} person(s)</p>
                        <p><strong className="text-charcoal">Pets:</strong> {application.hasPets ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="space-y-1.5">
                        {application.monthlyIncome && (
                          <p><strong className="text-charcoal">Declared Monthly Income:</strong> ETB {application.monthlyIncome.toLocaleString()}</p>
                        )}
                        {application.message && (
                          <p><strong className="text-charcoal">Application Note:</strong> &ldquo;{application.message}&rdquo;</p>
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
