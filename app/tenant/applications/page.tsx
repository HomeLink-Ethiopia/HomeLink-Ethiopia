'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

// Mock applications data - in production this would come from a database
const MOCK_APPLICATIONS = [
  {
    id: '1',
    propertyTitle: 'Modern 2BR in Bole',
    propertyNeighborhood: 'Bole',
    appliedDate: '2024-01-15',
    status: 'pending' as const,
    landlordName: 'Abebe Tekle',
  },
  {
    id: '2',
    propertyTitle: 'Cozy Studio in Kazanchis',
    propertyNeighborhood: 'Kazanchis',
    appliedDate: '2024-01-10',
    status: 'approved' as const,
    landlordName: 'Selam Haile',
  },
  {
    id: '3',
    propertyTitle: 'Spacious 3BR in CMC',
    propertyNeighborhood: 'CMC',
    appliedDate: '2024-01-05',
    status: 'rejected' as const,
    landlordName: 'Dawit Gebru',
  },
]

export default function ApplicationsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-verified text-white'
      case 'rejected':
        return 'bg-rust text-white'
      default:
        return 'bg-gold text-charcoal'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return t.dashboard.tenant.applications.approved
      case 'rejected':
        return t.dashboard.tenant.applications.rejected
      default:
        return t.dashboard.tenant.applications.pending
    }
  }

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.applications.title}</h1>
          <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.applications.subtitle}</p>
        </div>
        {loading ? (
          <SkeletonList count={3} />
        ) : MOCK_APPLICATIONS.length === 0 ? (
          <EmptyState
            icon="document"
            title="No applications yet"
            description="When you apply for a property, your application status will appear here."
            actionLabel="Browse Properties"
            actionHref="/explore"
          />
        ) : (
          <div className="space-y-4">
            {MOCK_APPLICATIONS.map((application) => (
              <div
                key={application.id}
                className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-charcoal">
                      {application.propertyTitle}
                    </h3>
                    <p className="text-sm text-charcoal/60 mt-1">
                      {application.propertyNeighborhood}
                    </p>
                    <p className="text-sm text-charcoal/60 mt-1">
                      Landlord: {application.landlordName}
                    </p>
                    <p className="text-xs text-charcoal/40 mt-2">
                      Applied on {new Date(application.appliedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        application.status
                      )}`}
                    >
                      {getStatusText(application.status)}
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
