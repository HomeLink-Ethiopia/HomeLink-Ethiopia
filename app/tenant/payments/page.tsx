'use client'

import TopBar from '@/components/tenant/TopBar'
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
        {MOCK_PAYMENTS.length === 0 ? (
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
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-charcoal">
              {t.dashboard.tenant.payments.noPayments}
            </h3>
          </div>
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
