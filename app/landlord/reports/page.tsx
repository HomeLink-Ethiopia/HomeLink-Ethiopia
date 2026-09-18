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

interface Property {
  _id: string
  title: string
  verificationStatus?: string
  availability?: string
  createdAt?: string
  price?: number
  rentAmount?: number
}

interface MaintenanceRequest {
  _id: string
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  category?: string
  createdAt?: string
  propertyId?: { title?: string } | string
}

type Period = 'all' | 'month' | 'quarter'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([])
  const [period, setPeriod] = useState<Period>('all')
  const { t } = useLanguage()

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('hl_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [payRes, propRes, maintRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/payments/landlord`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/v1/properties/my`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/v1/maintenance/landlord`, { headers: authHeaders() }),
      ])

      if (payRes.status === 401 || propRes.status === 401 || maintRes.status === 401) {
        setError('Please log in as a landlord to see your reports.')
        return
      }
      if (!payRes.ok || !propRes.ok || !maintRes.ok) {
        throw new Error('request failed')
      }

      const payData = await payRes.json()
      const propData = await propRes.json()
      const maintData = await maintRes.json()

      setPayments(payData.data || payData.payments || [])
      setProperties(propData.data || propData.properties || [])
      setMaintenance(
        (maintData.data || maintData.requests || []).filter(
          (r: { status?: string }) => r.status !== 'closed'
        )
      )
    } catch {
      setError('Could not load your reports. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const periodStart = useCallback((p: Period): number => {
    if (p === 'all') return 0
    const days = p === 'month' ? 30 : 90
    return Date.now() - days * 24 * 60 * 60 * 1000
  }, [])

  const scopedPayments = payments.filter(
    (p) => new Date(p.dueDate).getTime() >= periodStart(period)
  )

  const collected = scopedPayments.filter((p) => p.status === 'paid' || p.status === 'collected')
  const pending = scopedPayments.filter((p) => p.status === 'pending')
  const overdue = scopedPayments.filter((p) => p.status === 'overdue')
  const totalCollected = collected.reduce((s, p) => s + (p.amount || 0), 0)
  const totalExpected =
    collected.reduce((s, p) => s + (p.amount || 0), 0) +
    pending.reduce((s, p) => s + (p.amount || 0), 0) +
    overdue.reduce((s, p) => s + (p.amount || 0), 0)
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0

  const verifiedCount = properties.filter((p) => p.verificationStatus === 'verified').length
  const availableCount = properties.filter((p) => p.availability === 'available').length
  const rentedCount = properties.filter(
    (p) => p.availability === 'rented' || p.availability === 'reserved'
  ).length

  const openMaintenance = maintenance.filter((m) => m.status !== 'resolved')
  const resolvedMaintenance = maintenance.filter((m) => m.status === 'resolved')

  const occupiedCount = rentedCount
  const occupancyRate =
    properties.length > 0 ? Math.round((occupiedCount / properties.length) * 100) : 0

  const fmtEtb = (n: number) => `${n.toLocaleString('en-US')} ETB`

  const statCards = [
    { label: 'Collected', value: fmtEtb(totalCollected), tone: 'text-green-700' },
    { label: 'Pending', value: fmtEtb(pending.reduce((s, p) => s + (p.amount || 0), 0)), tone: 'text-amber-700' },
    { label: 'Overdue', value: fmtEtb(overdue.reduce((s, p) => s + (p.amount || 0), 0)), tone: 'text-red-700' },
    { label: 'Collection rate', value: `${collectionRate}%`, tone: 'text-charcoal' },
  ]

  return (
    <div className="min-h-full bg-cream">
      <TopBar title={t.dashboard.landlord.reports?.title || 'Reports'} subtitle="Income and portfolio performance across your properties" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonTable />
        ) : (
          <>
            {/* Period selector */}
            <div className="mb-6 flex gap-2">
              {(['all', 'month', 'quarter'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-rust text-white'
                      : 'bg-white text-charcoal/70 hover:bg-sand'
                  }`}
                >
                  {p === 'all' ? 'All time' : p === 'month' ? 'Last 30 days' : 'Last 90 days'}
                </button>
              ))}
            </div>

            {/* Income stats */}
            <section className="mb-8">
              <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Rent income</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {statCards.map((c) => (
                  <div key={c.label} className="rounded-xl border border-charcoal/10 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">{c.label}</p>
                    <p className={`mt-1 font-display text-lg font-semibold sm:text-xl ${c.tone}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Portfolio stats */}
            <section className="mb-8">
              <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Portfolio</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-charcoal/10 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Total properties</p>
                  <p className="mt-1 font-display text-lg font-semibold sm:text-xl">{properties.length}</p>
                </div>
                <div className="rounded-xl border border-charcoal/10 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Verified</p>
                  <p className="mt-1 font-display text-lg font-semibold text-green-700 sm:text-xl">{verifiedCount}</p>
                </div>
                <div className="rounded-xl border border-charcoal/10 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Available</p>
                  <p className="mt-1 font-display text-lg font-semibold sm:text-xl">{availableCount}</p>
                </div>
                <div className="rounded-xl border border-charcoal/10 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Occupancy</p>
                  <p className="mt-1 font-display text-lg font-semibold sm:text-xl">{occupancyRate}%</p>
                </div>
              </div>
            </section>

            {/* Maintenance stats */}
            <section className="mb-8">
              <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Maintenance</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-charcoal/10 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Open requests</p>
                  <p className="mt-1 font-display text-lg font-semibold text-amber-700 sm:text-xl">{openMaintenance.length}</p>
                </div>
                <div className="rounded-xl border border-charcoal/10 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">Resolved</p>
                  <p className="mt-1 font-display text-lg font-semibold text-green-700 sm:text-xl">{resolvedMaintenance.length}</p>
                </div>
              </div>
            </section>

            {/* Overdue detail */}
            {overdue.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 font-display text-lg font-semibold text-charcoal">Overdue payments</h2>
                <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-charcoal/10 text-left text-xs uppercase tracking-wide text-charcoal/50">
                        <th className="px-4 py-3 font-medium">Property</th>
                        <th className="px-4 py-3 font-medium">Tenant</th>
                        <th className="px-4 py-3 font-medium">Due date</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdue.map((p) => (
                        <tr key={p._id} className="border-b border-charcoal/5 last:border-0">
                          <td className="px-4 py-3">
                            {typeof p.propertyId === 'object' ? p.propertyId?.title || '—' : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {typeof p.tenantId === 'object'
                              ? `${p.tenantId?.firstName || ''} ${p.tenantId?.lastName || ''}`.trim() || '—'
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-charcoal/70">
                            {new Date(p.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-700">{fmtEtb(p.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {payments.length === 0 && properties.length === 0 && (
              <EmptyState
                title="Nothing to report yet"
                description="Once you have properties and agreements, your income and portfolio reports appear here."
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
