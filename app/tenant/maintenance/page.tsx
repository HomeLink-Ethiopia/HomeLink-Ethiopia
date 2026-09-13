'use client'

import { useState } from 'react'
import TopBar from '@/components/tenant/TopBar'
import { useLanguage } from '@/lib/language-context'

// Mock maintenance requests data
const MOCK_REQUESTS = [
  {
    id: '1',
    issue: 'Broken water heater',
    priority: 'high' as const,
    status: 'pending' as const,
    submittedDate: '2024-01-18',
    propertyTitle: 'Modern 2BR in Bole',
  },
  {
    id: '2',
    issue: 'Leaky faucet in kitchen',
    priority: 'medium' as const,
    status: 'in_progress' as const,
    submittedDate: '2024-01-15',
    propertyTitle: 'Modern 2BR in Bole',
  },
  {
    id: '3',
    issue: 'Light bulb replacement',
    priority: 'low' as const,
    status: 'completed' as const,
    submittedDate: '2024-01-10',
    propertyTitle: 'Modern 2BR in Bole',
  },
]

export default function MaintenancePage() {
  const { t } = useLanguage()
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)
  const [newRequest, setNewRequest] = useState<{
    issue: string
    priority: 'high' | 'medium' | 'low'
    description: string
  }>({
    issue: '',
    priority: 'medium',
    description: '',
  })

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

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, send to backend
    console.log('Submitting maintenance request:', newRequest)
    setShowNewRequestForm(false)
    setNewRequest({ issue: '', priority: 'medium', description: '' })
  }

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-charcoal">
            {t.dashboard.tenant.maintenance.title}
          </h2>
          <button
            onClick={() => setShowNewRequestForm(!showNewRequestForm)}
            className="bg-rust text-white px-4 py-2 rounded-lg hover:bg-rust-dark transition-colors"
          >
            {showNewRequestForm
              ? t.common.cancel
              : t.dashboard.tenant.maintenance.newRequest}
          </button>
        </div>

        {showNewRequestForm && (
          <div className="bg-white rounded-lg border border-sand p-6">
            <h3 className="font-semibold text-charcoal mb-4">
              {t.dashboard.tenant.maintenance.newRequest}
            </h3>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t.dashboard.tenant.maintenance.issue}
                </label>
                <input
                  type="text"
                  value={newRequest.issue}
                  onChange={(e) =>
                    setNewRequest({ ...newRequest, issue: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="Brief description of the issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t.dashboard.tenant.maintenance.priority}
                </label>
                <select
                  value={newRequest.priority}
                  onChange={(e) =>
                    setNewRequest({
                      ...newRequest,
                      priority: e.target.value as 'high' | 'medium' | 'low',
                    })
                  }
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                >
                  <option value="low">{t.dashboard.tenant.maintenance.low}</option>
                  <option value="medium">{t.dashboard.tenant.maintenance.medium}</option>
                  <option value="high">{t.dashboard.tenant.maintenance.high}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Description
                </label>
                <textarea
                  value={newRequest.description}
                  onChange={(e) =>
                    setNewRequest({ ...newRequest, description: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="Detailed description of the maintenance issue"
                  required
                />
              </div>

              <button
                type="submit"
                className="bg-rust text-white px-6 py-2 rounded-lg hover:bg-rust-dark transition-colors"
              >
                {t.dashboard.tenant.maintenance.submitRequest}
              </button>
            </form>
          </div>
        )}

        {MOCK_REQUESTS.length === 0 ? (
          <div className="text-center py-12">
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
              {t.dashboard.tenant.maintenance.noRequests}
            </h3>
          </div>
        ) : (
          <div className="space-y-4">
            {MOCK_REQUESTS.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow"
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
                    <p className="text-xs text-charcoal/40 mt-2">
                      Submitted {new Date(request.submittedDate).toLocaleDateString()}
                    </p>
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
