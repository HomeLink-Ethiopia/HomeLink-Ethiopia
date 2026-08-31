'use client'

import TopBar from '@/components/landlord/TopBar'
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
        {MOCK_REQUESTS.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-sand">
            <svg
              className="mx-auto h-12 w-12 text-charcoal/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-charcoal">
              {t.dashboard.landlord.maintenance.noRequests}
            </h3>
          </div>
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
