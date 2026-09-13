'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const MOCK_PAYMENTS = [
  {
    id: '1',
    tenantName: 'Tsedi Tesfaye',
    propertyTitle: 'Modern 2BR Apartment',
    amount: 18000,
    dueDate: '2024-02-01',
    paidDate: '2024-02-01',
    status: 'collected' as const,
  },
  {
    id: '2',
    tenantName: 'Tsedi Tesfaye',
    propertyTitle: 'Modern 2BR Apartment',
    amount: 18000,
    dueDate: '2024-03-01',
    paidDate: null,
    status: 'pending' as const,
  },
  {
    id: '3',
    tenantName: 'Meron Alemu',
    propertyTitle: 'Spacious 3BR House',
    amount: 25000,
    dueDate: '2024-01-01',
    paidDate: null,
    status: 'overdue' as const,
  },
]

export default function RentPaymentsPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])
  const { t } = useLanguage()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'collected':
        return 'bg-verified text-white'
      case 'pending':
        return 'bg-gold text-charcoal'
      case 'overdue':
        return 'bg-rust text-white'
      default:
        return 'bg-sand text-charcoal'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'collected':
        return t.dashboard.landlord.rentPayments.collected
      case 'pending':
        return t.dashboard.landlord.rentPayments.pending
      case 'overdue':
        return t.dashboard.landlord.rentPayments.overdue
      default:
        return status
    }
  }

  const totalCollected = MOCK_PAYMENTS.filter((p) => p.status === 'collected').reduce(
    (sum, p) => sum + p.amount,
    0
  )
  const totalPending = MOCK_PAYMENTS.filter((p) => p.status === 'pending').reduce(
    (sum, p) => sum + p.amount,
    0
  )
  const totalOverdue = MOCK_PAYMENTS.filter((p) => p.status === 'overdue').reduce(
    (sum, p) => sum + p.amount,
    0
  )

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.rentPayments.title}
        subtitle={t.dashboard.landlord.rentPayments.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : MOCK_PAYMENTS.length === 0 ? (
          <EmptyState
            icon="payment"
            title="No rent payments"
            description="Payment records for your properties will appear here."
          />
        ) : (
        <>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-sand p-6">
            <p className="text-sm text-charcoal/60">
              {t.dashboard.landlord.rentPayments.collected}
            </p>
            <p className="text-2xl font-bold text-verified mt-2">
              ETB {totalCollected.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-sand p-6">
            <p className="text-sm text-charcoal/60">
              {t.dashboard.landlord.rentPayments.pending}
            </p>
            <p className="text-2xl font-bold text-gold mt-2">
              ETB {totalPending.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-sand p-6">
            <p className="text-sm text-charcoal/60">
              {t.dashboard.landlord.rentPayments.overdue}
            </p>
            <p className="text-2xl font-bold text-rust mt-2">
              ETB {totalOverdue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Payments Table */}
        {MOCK_PAYMENTS.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-sand">
            <p className="text-charcoal/60">
              {t.dashboard.landlord.rentPayments.noPayments}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-sand overflow-hidden">
            <table className="min-w-full divide-y divide-sand">
              <thead className="bg-cream">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sand">
                {MOCK_PAYMENTS.map((payment) => (
                  <tr key={payment.id} className="hover:bg-cream/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {payment.tenantName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {payment.propertyTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {new Date(payment.dueDate).toLocaleDateString()}
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
        </>
        )}
      </main>
    </>
  )
}
