'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

// Mock payments data
const MOCK_PAYMENTS = [
  {
    id: '1',
    propertyTitle: 'Modern 2BR in Bole',
    amount: 18000,
    date: '2024-01-01',
    status: 'paid' as const,
  },
  {
    id: '2',
    propertyTitle: 'Modern 2BR in Bole',
    amount: 18000,
    date: '2024-02-01',
    status: 'paid' as const,
  },
  {
    id: '3',
    propertyTitle: 'Modern 2BR in Bole',
    amount: 18000,
    date: '2024-03-01',
    status: 'unpaid' as const,
  },
]

export default function PaymentsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = (status: string) => {
    return status === 'paid'
      ? 'bg-verified text-white'
      : 'bg-rust text-white'
  }

  const getStatusText = (status: string) => {
    return status === 'paid'
      ? t.dashboard.tenant.payments.paid
      : t.dashboard.tenant.payments.unpaid
  }

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : MOCK_PAYMENTS.length === 0 ? (
          <EmptyState
            icon="payment"
            title="No payments yet"
            description="Your rent payment history will appear here once you move in."
          />
        ) : (
          <div className="bg-white rounded-lg border border-sand overflow-hidden">
            <table className="min-w-full divide-y divide-sand">
              <thead className="bg-cream">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    {t.dashboard.tenant.payments.date}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    {t.dashboard.tenant.payments.amount}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    {t.dashboard.tenant.payments.status}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sand">
                {MOCK_PAYMENTS.map((payment) => (
                  <tr key={payment.id} className="hover:bg-cream/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {new Date(payment.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {payment.propertyTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-charcoal">
                      ETB {payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          payment.status
                        )}`}
                      >
                        {getStatusText(payment.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
