'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Application {
  _id: string
  propertyId?: { title?: string; location?: { subCity?: string } } | string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  createdAt: string
  landlordName?: string
  landlordProfileId?: { legalName?: string }
  message?: string
}

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-gold text-charcoal',
  under_review: 'bg-gold text-charcoal',
  approved: 'bg-verified text-white',
  rejected: 'bg-rust text-white',
  withdrawn: 'bg-charcoal/20 text-charcoal',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export default function ApplicationsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<Application[]>([])

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
        setApplications(data.data || data.applications || [])
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

  const propertyName = (a: Application) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Property'

  const propertyArea = (a: Application) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.location?.subCity : null) || ''

  const landlord = (a: Application) =>
    a.landlordName || a.landlordProfileId?.legalName || 'Landlord'

  const getStatusText = (status: string) => {
    if (status === 'approved') return t.dashboard.tenant.applications.approved
    if (status === 'rejected') return t.dashboard.tenant.applications.rejected
    if (status === 'under_review') return 'Under Review'
    return t.dashboard.tenant.applications.pending
  }

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.applications.title}</h1>
          <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.applications.subtitle}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : applications.length === 0 ? (
          <EmptyState
            icon="document"
            title="No applications yet"
            description="When you apply for a property, your application status will appear here."
            actionLabel="Browse Properties"
            actionHref="/explore"
          />
        ) : (
          <div className="space-y-4">
            {applications.map((application) => (
              <div
                key={application._id}
                className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-charcoal">
                      {propertyName(application)}
                    </h3>
                    {propertyArea(application) && (
                      <p className="text-sm text-charcoal/60 mt-1">
                        {propertyArea(application)}
                      </p>
                    )}
                    <p className="text-sm text-charcoal/60 mt-1">
                      Landlord: {landlord(application)}
                    </p>
                    <p className="text-xs text-charcoal/40 mt-2">
                      Applied on {new Date(application.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        STATUS_STYLE[application.status] || STATUS_STYLE.submitted
                      }`}
                    >
                      {STATUS_LABEL[application.status]
                        ? getStatusText(application.status)
                        : application.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
