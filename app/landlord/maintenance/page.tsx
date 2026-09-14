'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Request {
  _id: string
  issue?: string
  title?: string
  description?: string
  priority?: string
  status?: string
  createdAt?: string
  propertyId?: { title?: string } | string
  tenantId?: { firstName?: string; lastName?: string } | string
}

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<Request[]>([])
  const { t } = useLanguage()

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/maintenance/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setRequests(data.data || data.requests || [])
      } else if (res.status === 401) {
        setError('Please log in as a landlord to see maintenance requests.')
      } else {
        setError(`Could not load maintenance requests (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const tenantName = (r: Request) =>
    typeof r.tenantId === 'object' ? `${r.tenantId?.firstName || ''} ${r.tenantId?.lastName || ''}`.trim() : 'Tenant'

  const propertyTitle = (r: Request) =>
    typeof r.propertyId === 'object' ? r.propertyId?.title : 'Property'

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': case 'urgent':
        return 'bg-rust text-white'
      case 'medium':
        return 'bg-gold text-charcoal'
      default:
        return 'bg-sand text-charcoal'
    }
  }

  const getPriorityText = (priority?: string) => {
    switch (priority) {
      case 'high': case 'urgent':
        return t.dashboard.tenant.maintenance.high
      case 'medium':
        return t.dashboard.tenant.maintenance.medium
      default:
        return t.dashboard.tenant.maintenance.low
    }
  }

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.maintenance.title}
        subtitle={t.dashboard.landlord.maintenance.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
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
            description="When tenants report maintenance issues on your properties, they will appear here."
          />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-lg border border-sand p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-charcoal">
                        {request.issue || request.title || request.description || 'Maintenance request'}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}
                      >
                        {getPriorityText(request.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal/60 mt-1">{propertyTitle(request)}</p>
                    <p className="text-sm text-charcoal/60">Tenant: {tenantName(request)}</p>
                    {request.createdAt && (
                      <p className="text-xs text-charcoal/40 mt-2">
                        Submitted {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    )}
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
