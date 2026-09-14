'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const MOCK_REQUESTS = [
  {
    id: '1',
    tenantName: 'Tsedi Tesfaye',
    propertyTitle: 'Modern 2BR Apartment',
    issue: 'Broken water heater',
    priority: 'high' as const,
    status: 'pending' as const,
    submittedDate: '2024-01-18',
  },
  {
    id: '2',
    tenantName: 'Tsedi Tesfaye',
    propertyTitle: 'Modern 2BR Apartment',
    issue: 'Leaky faucet in kitchen',
    priority: 'medium' as const,
    status: 'in_progress' as const,
    submittedDate: '2024-01-15',
  },
]

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])
  const { t } = useLanguage()

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-rust text-white'
      case 'medium':
        return 'bg-gold text-charcoal'
      default:
        return 'bg-sand text-charcoal'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
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
        {loading ? (
          <SkeletonList count={3} />
        ) : MOCK_REQUESTS.length === 0 ? (
          <EmptyState
            icon="maintenance"
            title="No maintenance requests"
            description="When tenants report maintenance issues, they will appear here."
          />
        ) : (
          <div className="space-y-4">
            {MOCK_REQUESTS.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg border border-sand p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-charcoal">
                        {request.issue}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                          request.priority
                        )}`}
                      >
                        {getPriorityText(request.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal/60 mt-1">
                      {request.propertyTitle}
                    </p>
                    <p className="text-sm text-charcoal/60">
                      Tenant: {request.tenantName}
                    </p>
                    <p className="text-xs text-charcoal/40 mt-2">
                      Submitted {new Date(request.submittedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-verified text-white rounded text-sm hover:opacity-90">
                      Mark Complete
                    </button>
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
