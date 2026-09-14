'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Payment {
  _id: string
  amount: number
  dueDate: string
  paidDate?: string
  status: 'pending' | 'paid' | 'overdue'
  propertyId?: { title?: string } | string
}

export default function PaymentsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/payments/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setPayments(data.data || data.payments || [])
      } else if (res.status === 401) {
        setError('Please log in as a tenant to see your payments.')
      } else {
        setError(`Could not load payments (${res.status}). Please try again later.`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const propertyName = (p: Payment) =>
    (typeof p.propertyId === 'object' ? p.propertyId?.title : null) || 'Rent'

  const getStatusColor = (status: string) => {
    if (status === 'paid') return 'bg-verified text-white'
    if (status === 'overdue') return 'bg-rust text-white'
    return 'bg-gold text-charcoal'
  }

  const getStatusText = (status: string) => {
    if (status === 'paid') return t.dashboard.tenant.payments.paid
    if (status === 'overdue') return 'Overdue'
    return t.dashboard.tenant.payments.unpaid
  }

  return (
    <>
      <TopBar tenantName={"Tenant"} />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.payments.title}</h1>
          <p className="mt-1 text-sm text-charcoal/60">{t.dashboard.tenant.payments.subtitle}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : payments.length === 0 ? (
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
                {payments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-cream/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {new Date(payment.paidDate || payment.dueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                      {propertyName(payment)}
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
        )}
      </main>
    </>
  )
}
