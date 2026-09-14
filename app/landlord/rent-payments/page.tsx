'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Payment {
  _id: string
  amount: number
  dueDate: string
  paidDate?: string
  status: 'pending' | 'paid' | 'collected' | 'overdue'
  propertyId?: { title?: string } | string
  tenantId?: { firstName?: string; lastName?: string } | string
}

export default function RentPaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const { t } = useLanguage()

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/payments/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setPayments(data.data || data.payments || [])
      } else if (res.status === 401) {
        setError('Please log in as a landlord to see rent payments.')
      } else {
        setError(`Could not load rent payments (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const tenantName = (p: Payment) =>
    typeof p.tenantId === 'object' ? `${p.tenantId?.firstName || ''} ${p.tenantId?.lastName || ''}`.trim() : 'Tenant'

  const propertyTitle = (p: Payment) =>
    typeof p.propertyId === 'object' ? p.propertyId?.title : 'Property'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': case 'collected':
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
      case 'paid': case 'collected':
        return t.dashboard.landlord.rentPayments.collected
      case 'pending':
        return t.dashboard.landlord.rentPayments.pending
      case 'overdue':
        return t.dashboard.landlord.rentPayments.overdue
      default:
        return status
    }
  }

  const totalCollected = payments.filter((p) => p.status === 'paid' || p.status === 'collected').reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const totalOverdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + p.amount, 0)

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.rentPayments.title}
        subtitle={t.dashboard.landlord.rentPayments.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon="payment"
            title="No rent payments"
            description="Payment records for your rented properties will appear here."
          />
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-sand p-6">
                <p className="text-sm text-charcoal/60">{t.dashboard.landlord.rentPayments.collected}</p>
                <p className="text-2xl font-bold text-verified mt-2">ETB {totalCollected.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg border border-sand p-6">
                <p className="text-sm text-charcoal/60">{t.dashboard.landlord.rentPayments.pending}</p>
                <p className="text-2xl font-bold text-gold mt-2">ETB {totalPending.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg border border-sand p-6">
                <p className="text-sm text-charcoal/60">{t.dashboard.landlord.rentPayments.overdue}</p>
                <p className="text-2xl font-bold text-rust mt-2">ETB {totalOverdue.toLocaleString()}</p>
              </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-lg border border-sand overflow-hidden">
              <table className="min-w-full divide-y divide-sand">
                <thead className="bg-cream">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">Tenant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">Property</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-charcoal uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sand">
                  {payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-cream/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">{tenantName(payment)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">{propertyTitle(payment)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                        {new Date(payment.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-charcoal">
                        ETB {payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {getStatusText(payment.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}
