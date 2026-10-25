'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Payment {
  _id: string
  amount: number
  amountDue?: number
  amountPaid?: number
  balance?: number
  dueDate: string
  paidDate?: string
  paidAt?: string
  periodMonth?: string
  paymentType?: 'rent' | 'deposit'
  paymentMethod?: 'telebirr' | 'cbe' | 'chapa' | 'bank_transfer'
  transactionReference?: string
  receiptNumber?: string
  receiptUrl?: string
  receiptKey?: string
  notes?: string
  status: 'pending' | 'paid' | 'collected' | 'overdue'
  propertyId?: {
    _id?: string
    title?: string
    location?: { city?: string; subCity?: string; neighborhood?: string }
  } | string
  tenantId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
}

interface Property {
  _id: string
  title: string
  location?: { city?: string; subCity?: string; neighborhood?: string }
  verificationStatus?: string
  availability?: string
  createdAt?: string
  price?: number
  rentAmount?: number
}

interface MaintenanceRequest {
  _id: string
  title?: string
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  category?: string
  cost?: number
  createdAt?: string
  propertyId?: { _id?: string; title?: string } | string
}

type Period = 'all' | 'month' | 'quarter' | 'year'

function fmtEtb(n?: number) {
  return n !== undefined && !isNaN(n) ? `${n.toLocaleString('en-US')} ETB` : '0 ETB'
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([])
  const { t } = useLanguage()

  // Filters
  const [period, setPeriod] = useState<Period>('all')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Receipt Modal State
  const [inspectReceipt, setInspectReceipt] = useState<Payment | null>(null)

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
        setError('Please log in as a landlord to access your financial and portfolio reports.')
        return
      }

      if (!payRes.ok || !propRes.ok || !maintRes.ok) {
        throw new Error('Failed to load reporting data')
      }

      const payData = await payRes.json()
      const propData = await propRes.json()
      const maintData = await maintRes.json()

      const payList: Payment[] = Array.isArray(payData) ? payData : payData.data || payData.payments || []
      const propList: Property[] = Array.isArray(propData) ? propData : propData.data || propData.properties || []
      const rawMaint: MaintenanceRequest[] = Array.isArray(maintData) ? maintData : maintData.data || maintData.requests || maintData.tickets || []

      setPayments(payList)
      setProperties(propList)
      setMaintenance(rawMaint)
    } catch {
      setError('Could not connect to the reports server. Please ensure the backend is active.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Filter calculations
  const periodStart = useCallback((p: Period): number => {
    if (p === 'all') return 0
    const days = p === 'month' ? 30 : p === 'quarter' ? 90 : 365
    return Date.now() - days * 24 * 60 * 60 * 1000
  }, [])

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Period filter
      const payTime = new Date(p.dueDate || p.paidDate || p.paidAt || Date.now()).getTime()
      if (payTime < periodStart(period)) return false

      // Property filter
      if (selectedPropertyId !== 'all') {
        const pId = typeof p.propertyId === 'object' ? p.propertyId?._id : p.propertyId
        if (pId !== selectedPropertyId) return false
      }

      // Status filter
      if (selectedStatus === 'paid' && p.status !== 'paid' && p.status !== 'collected') return false
      if (selectedStatus === 'pending' && p.status !== 'pending') return false
      if (selectedStatus === 'overdue' && p.status !== 'overdue') return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const propTitle = (typeof p.propertyId === 'object' ? p.propertyId?.title : '')?.toLowerCase() || ''
        const tenantName = (typeof p.tenantId === 'object' ? `${p.tenantId?.firstName || ''} ${p.tenantId?.lastName || ''}` : '')?.toLowerCase() || ''
        const rcpt = (p.receiptNumber || '').toLowerCase()
        const txRef = (p.transactionReference || '').toLowerCase()
        const pMethod = (p.paymentMethod || '').toLowerCase()
        if (!propTitle.includes(q) && !tenantName.includes(q) && !rcpt.includes(q) && !txRef.includes(q) && !pMethod.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [payments, period, selectedPropertyId, selectedStatus, searchQuery, periodStart])

  // Financial Aggregations
  const collectedPayments = filteredPayments.filter((p) => p.status === 'paid' || p.status === 'collected')
  const pendingPayments = filteredPayments.filter((p) => p.status === 'pending')
  const overduePayments = filteredPayments.filter((p) => p.status === 'overdue')

  const totalCollected = collectedPayments.reduce((s, p) => s + (p.amountPaid || p.amount || 0), 0)
  const totalPending = pendingPayments.reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)
  const totalOverdue = overduePayments.reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)
  const grossExpected = totalCollected + totalPending + totalOverdue

  const collectionRate = grossExpected > 0 ? Math.round((totalCollected / grossExpected) * 100) : 0

  // Estimated maintenance costs (if cost field exists or standard allocation)
  const totalMaintenanceExpense = maintenance.reduce((sum, m) => sum + (m.cost || (m.status === 'resolved' ? 2500 : 0)), 0)
  const netOperatingIncome = Math.max(0, totalCollected - totalMaintenanceExpense)

  // Payment Method Breakdown — digital collections settled via Chapa
  const methodStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {
      chapa: { count: 0, total: 0 },
      bank_transfer: { count: 0, total: 0 },
    }
    collectedPayments.forEach((p) => {
      const m = p.paymentMethod || 'chapa'
      const key = m === 'bank_transfer' ? 'bank_transfer' : 'chapa'
      if (!stats[key]) stats[key] = { count: 0, total: 0 }
      stats[key].count += 1
      stats[key].total += p.amountPaid || p.amount || 0
    })
    return stats
  }, [collectedPayments])

  // Property names and tenant name helpers
  const getPropTitle = (p: Payment) => {
    return (typeof p.propertyId === 'object' ? p.propertyId?.title : null) || 'Rental Property'
  }

  const getTenantName = (p: Payment) => {
    if (typeof p.tenantId === 'object' && p.tenantId) {
      const full = `${p.tenantId.firstName || ''} ${p.tenantId.lastName || ''}`.trim()
      return full || p.tenantId.email || 'Tenant'
    }
    return 'Tenant'
  }

  const getTenantContact = (p: Payment) => {
    if (typeof p.tenantId === 'object' && p.tenantId) {
      return p.tenantId.phone || p.tenantId.email || '—'
    }
    return '—'
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Receipt #',
      'Due Date',
      'Paid Date',
      'Billing Month',
      'Property',
      'Tenant Name',
      'Tenant Contact',
      'Amount (ETB)',
      'Payment Method',
      'Transaction Ref',
      'Status',
    ]

    const rows = filteredPayments.map((p) => [
      `"${p.receiptNumber || `RCPT-${p._id.slice(-6).toUpperCase()}`}"`,
      `"${fmtDate(p.dueDate)}"`,
      `"${fmtDate(p.paidDate || p.paidAt)}"`,
      `"${p.periodMonth || 'N/A'}"`,
      `"${getPropTitle(p).replace(/"/g, '""')}"`,
      `"${getTenantName(p).replace(/"/g, '""')}"`,
      `"${getTenantContact(p)}"`,
      p.amount || 0,
      `"${(p.paymentMethod || 'bank_transfer').toUpperCase()}"`,
      `"${p.transactionReference || 'N/A'}"`,
      `"${p.status.toUpperCase()}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `HomeLink_Landlord_Financial_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Portfolio metrics
  const verifiedCount = properties.filter((p) => p.verificationStatus === 'verified').length
  const rentedCount = properties.filter((p) => p.availability === 'rented' || p.availability === 'reserved').length
  const occupancyRate = properties.length > 0 ? Math.round((rentedCount / properties.length) * 100) : 0

  return (
    <div className="min-h-full bg-cream">
      {/* Top Header */}
      <TopBar
        title={t.dashboard?.landlord?.reports?.title || 'Financial Reports & Statements'}
        subtitle="Comprehensive revenue analytics, payment ledger, and legal audit statements"
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* Print Only Header Banner */}
        <div className="hidden print:block mb-8 border-b-2 border-charcoal pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal">HomeLink Ethiopia</h1>
              <p className="text-xs uppercase tracking-widest text-charcoal/60">Official Landlord Rental &amp; Income Statement</p>
              <p className="mt-1 text-xs text-charcoal/80">Issued: {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
            </div>
            <div className="text-right text-xs text-charcoal/70">
              <p className="font-semibold text-charcoal">National Housing Registry</p>
              <p>Addis Ababa, Ethiopia</p>
              <p className="font-mono text-[11px]">CERT-FIN-ETH-{(Date.now() % 1000000).toString()}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 shadow-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchAll}
              className="ml-4 rounded-lg bg-amber-200/80 px-3 py-1 text-xs font-semibold hover:bg-amber-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* ─── ACTION TOOLBAR ─── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          {/* Period selector */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-charcoal/10 bg-white p-1 shadow-sm">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'month', label: 'Last 30 Days' },
                { id: 'quarter', label: 'Last 90 Days' },
                { id: 'year', label: 'This Year' },
              ] as { id: Period; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  period === p.id
                    ? 'bg-rust text-white shadow-sm'
                    : 'text-charcoal/70 hover:bg-sand/40 hover:text-charcoal'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export & Print actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredPayments.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-xs font-semibold text-charcoal shadow-sm transition hover:bg-cream disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-charcoal/60">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-charcoal/90"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0113.25 8H6.75A1.75 1.75 0 015 6.25v-3.5zm1.5 0v3.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-3.5a.25.25 0 00-.25-.25h-6.5a.25.25 0 00-.25.25z" clipRule="evenodd" />
                <path d="M3 8.75A2.75 2.75 0 015.75 6h8.5A2.75 2.75 0 0117 8.75V14a2 2 0 01-2 2H5a2 2 0 01-2-2V8.75zM5.75 7.5c-.69 0-1.25.56-1.25 1.25V14c0 .276.224.5.5.5h10a.5.5 0 00.5-.5V8.75c0-.69-.56-1.25-1.25-1.25h-8.5z" />
                <path d="M6 13a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" />
              </svg>
              Print Statement
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (
          <>
            {/* ─── EXECUTIVE FINANCIAL METRICS ─── */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {/* Gross Billed */}
              <div className="rounded-2xl border border-charcoal/10 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Gross Revenue</p>
                <p className="mt-1 font-display text-xl font-bold text-charcoal sm:text-2xl">{fmtEtb(grossExpected)}</p>
                <p className="mt-1 text-[11px] text-charcoal/60">Expected rent total</p>
              </div>

              {/* Net Collected */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Collected</p>
                  <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {collectionRate}%
                  </span>
                </div>
                <p className="mt-1 font-display text-xl font-bold text-emerald-800 sm:text-2xl">{fmtEtb(totalCollected)}</p>
                <p className="mt-1 text-[11px] text-emerald-700/80">{collectedPayments.length} paid invoices</p>
              </div>

              {/* Pending */}
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending</p>
                <p className="mt-1 font-display text-xl font-bold text-amber-800 sm:text-2xl">{fmtEtb(totalPending)}</p>
                <p className="mt-1 text-[11px] text-amber-700/80">{pendingPayments.length} upcoming dues</p>
              </div>

              {/* Overdue */}
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Overdue Arrears</p>
                <p className="mt-1 font-display text-xl font-bold text-rose-800 sm:text-2xl">{fmtEtb(totalOverdue)}</p>
                <p className="mt-1 text-[11px] text-rose-700/80">{overduePayments.length} delayed payments</p>
              </div>

              {/* Maintenance Expenses */}
              <div className="rounded-2xl border border-charcoal/10 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Maintenance</p>
                <p className="mt-1 font-display text-xl font-bold text-charcoal/80 sm:text-2xl">{fmtEtb(totalMaintenanceExpense)}</p>
                <p className="mt-1 text-[11px] text-charcoal/60">{maintenance.length} requests logged</p>
              </div>

              {/* Net Operating Income (NOI) */}
              <div className="rounded-2xl border border-rust/30 bg-rust-tint/20 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rust">Net Income (NOI)</p>
                <p className="mt-1 font-display text-xl font-bold text-rust sm:text-2xl">{fmtEtb(netOperatingIncome)}</p>
                <p className="mt-1 text-[11px] text-rust/70">After repair deductions</p>
              </div>
            </div>

            {/* ─── ANALYTICS BARS: COLLECTION & PAYMENT CHANNELS ─── */}
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Collection Efficiency Gauge */}
              <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
                <h3 className="font-display text-base font-bold text-charcoal">Collection Performance</h3>
                <p className="text-xs text-charcoal/60">Rent settlement progress for selected period</p>

                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-charcoal mb-1.5">
                    <span>Efficiency Rate</span>
                    <span className="font-bold text-emerald-700">{collectionRate}% Settled</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-sand/50">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, collectionRate))}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 text-center text-xs text-charcoal/60 pt-2 border-t border-charcoal/5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Collected</p>
                      <p className="font-bold text-emerald-700">{fmtEtb(totalCollected)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Pending</p>
                      <p className="font-bold text-amber-700">{fmtEtb(totalPending)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Overdue</p>
                      <p className="font-bold text-rose-700">{fmtEtb(totalOverdue)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-charcoal">Settlement Gateways</h3>
                    <p className="text-xs text-charcoal/60">Digital banking &amp; mobile settlements via Chapa</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    Active: Chapa Gateway
                  </span>
                </div>

                <div className="mt-3.5 space-y-3">
                  {[
                    {
                      key: 'chapa',
                      name: 'Chapa Gateway',
                      desc: 'Instant settlement (Telebirr, CBE Birr & Card)',
                      color: 'bg-emerald-600',
                      share: methodStats.chapa,
                    },
                    {
                      key: 'bank_transfer',
                      name: 'Bank Transfer / FT',
                      desc: 'Escrow deposit via commercial banks',
                      color: 'bg-charcoal',
                      share: methodStats.bank_transfer,
                    },
                  ].map((chan) => {
                    const pct = totalCollected > 0 ? Math.round((chan.share.total / totalCollected) * 100) : 0
                    return (
                      <div key={chan.key} className="space-y-1 rounded-xl bg-sand/20 p-3">
                        <div className="flex justify-between text-xs font-medium text-charcoal">
                          <span className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${chan.color}`} />
                            <div>
                              <p className="font-semibold text-charcoal">{chan.name} ({chan.share.count})</p>
                              <p className="text-[10px] text-charcoal/50">{chan.desc}</p>
                            </div>
                          </span>
                          <span className="font-semibold text-charcoal/80">{fmtEtb(chan.share.total)} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/60 mt-2">
                          <div className={`h-full ${chan.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Portfolio Health Overview */}
              <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
                <h3 className="font-display text-base font-bold text-charcoal">Portfolio Yield</h3>
                <p className="text-xs text-charcoal/60">Property occupancy &amp; asset status</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-sand/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Occupancy</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-charcoal">{occupancyRate}%</p>
                    <p className="text-[10px] text-charcoal/60">{rentedCount} of {properties.length} rented</p>
                  </div>
                  <div className="rounded-xl bg-sand/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Verified Units</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-emerald-700">{verifiedCount}</p>
                    <p className="text-[10px] text-charcoal/60">Legally verified</p>
                  </div>
                  <div className="rounded-xl bg-sand/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Open Repairs</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-amber-700">
                      {maintenance.filter((m) => m.status !== 'resolved').length}
                    </p>
                    <p className="text-[10px] text-charcoal/60">Active tickets</p>
                  </div>
                  <div className="rounded-xl bg-sand/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Avg Monthly Rent</p>
                    <p className="mt-0.5 font-display text-xl font-bold text-rust">
                      {fmtEtb(properties.length > 0 ? Math.round(grossExpected / Math.max(1, properties.length)) : 0)}
                    </p>
                    <p className="text-[10px] text-charcoal/60">Per property</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── PROPERTY REVENUE BREAKDOWN TABLE ─── */}
            {properties.length > 0 && (
              <section className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-charcoal">Property Performance Breakdown</h2>
                    <p className="text-xs text-charcoal/60">Income, occupancy, and repair expenses per listed property</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-charcoal/10 bg-sand/30 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                        <tr>
                          <th className="px-4 py-3.5">Property</th>
                          <th className="px-4 py-3.5">Location</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Rent Rate</th>
                          <th className="px-4 py-3.5 text-right">Total Collected</th>
                          <th className="px-4 py-3.5 text-right">Overdue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal/5">
                        {properties.map((prop) => {
                          const propPayments = payments.filter((p) => {
                            const pId = typeof p.propertyId === 'object' ? p.propertyId?._id : p.propertyId
                            return pId === prop._id
                          })
                          const propCollected = propPayments
                            .filter((p) => p.status === 'paid' || p.status === 'collected')
                            .reduce((s, p) => s + (p.amountPaid || p.amount || 0), 0)
                          const propOverdue = propPayments
                            .filter((p) => p.status === 'overdue')
                            .reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)

                          const loc = prop.location
                            ? [prop.location.subCity, prop.location.city].filter(Boolean).join(', ')
                            : 'Addis Ababa'

                          return (
                            <tr key={prop._id} className="hover:bg-cream/40 transition">
                              <td className="px-4 py-3 font-semibold text-charcoal">
                                {prop.title}
                              </td>
                              <td className="px-4 py-3 text-xs text-charcoal/70">{loc}</td>
                              <td className="px-4 py-3 text-xs">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    prop.availability === 'rented'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {prop.availability === 'rented' ? 'Occupied' : 'Vacant / Available'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-charcoal">
                                {fmtEtb(prop.price || prop.rentAmount || 0)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                                {fmtEtb(propCollected)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-rose-700">
                                {propOverdue > 0 ? fmtEtb(propOverdue) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ─── MASTER PAYMENT & RENTAL LEDGER ─── */}
            <section className="mb-8">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-charcoal">Master Rental Transaction Ledger</h2>
                  <p className="text-xs text-charcoal/60">
                    Showing {filteredPayments.length} of {payments.length} total payment invoices
                  </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search tenant, receipt, ref…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 rounded-xl border border-charcoal/15 bg-white px-3 py-1.5 pl-8 text-xs text-charcoal outline-none placeholder:text-charcoal/40 focus:border-rust focus:w-60 transition-all"
                    />
                    <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-2 h-3.5 w-3.5 text-charcoal/40">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                  </div>

                  {/* Property filter */}
                  {properties.length > 0 && (
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="rounded-xl border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs text-charcoal outline-none focus:border-rust"
                    >
                      <option value="all">All Properties</option>
                      {properties.map((pr) => (
                        <option key={pr._id} value={pr._id}>
                          {pr.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Status filter */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="rounded-xl border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs text-charcoal outline-none focus:border-rust"
                  >
                    <option value="all">All Statuses</option>
                    <option value="paid">Settled / Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="rounded-2xl border border-charcoal/10 bg-white p-8 text-center">
                  <p className="font-display text-base font-semibold text-charcoal">No payment records found</p>
                  <p className="mt-1 text-xs text-charcoal/60">
                    Try adjusting your date period, status filter, or search query.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-charcoal/10 bg-sand/30 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                        <tr>
                          <th className="px-4 py-3.5">Receipt #</th>
                          <th className="px-4 py-3.5">Due Date</th>
                          <th className="px-4 py-3.5">Property</th>
                          <th className="px-4 py-3.5">Tenant</th>
                          <th className="px-4 py-3.5">Channel</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Amount (ETB)</th>
                          <th className="px-4 py-3.5 text-center print:hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal/5">
                        {filteredPayments.map((p) => {
                          const isSettled = p.status === 'paid' || p.status === 'collected'
                          const isOver = p.status === 'overdue'

                          return (
                            <tr key={p._id} className="hover:bg-cream/40 transition">
                              <td className="px-4 py-3.5">
                                <span className="font-mono text-xs font-bold text-charcoal">
                                  {p.receiptNumber || `RCPT-${p._id.slice(-6).toUpperCase()}`}
                                </span>
                                {p.transactionReference && (
                                  <p className="font-mono text-[10px] text-charcoal/50">{p.transactionReference}</p>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-charcoal/80">
                                <div>{fmtDate(p.dueDate)}</div>
                                {p.paidDate && (
                                  <div className="text-[10px] text-emerald-700">Paid: {fmtDate(p.paidDate)}</div>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-xs text-charcoal">{getPropTitle(p)}</p>
                                <p className="text-[10px] text-charcoal/50">{p.periodMonth ? `Rent: ${p.periodMonth}` : 'Residential Lease'}</p>
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-xs text-charcoal">{getTenantName(p)}</p>
                                <p className="text-[10px] text-charcoal/50">{getTenantContact(p)}</p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-sand/40 px-2 py-0.5 text-xs font-semibold uppercase text-charcoal">
                                  {p.paymentMethod === 'cbe' ? 'CBE Birr' : p.paymentMethod || 'Telebirr'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    isSettled
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : isOver
                                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isSettled ? 'bg-emerald-600' : isOver ? 'bg-rose-600' : 'bg-amber-600'
                                    }`}
                                  />
                                  {isSettled ? 'Paid & Verified' : isOver ? 'Overdue' : 'Pending Due'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-display text-sm font-bold text-charcoal">
                                <span className={isSettled ? 'text-emerald-700' : isOver ? 'text-rose-700' : 'text-charcoal'}>
                                  {fmtEtb(p.amount || p.amountDue || 0)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={() => setInspectReceipt(p)}
                                  className="rounded-lg border border-charcoal/15 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-cream shadow-sm"
                                >
                                  View Receipt
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Zero State for fresh landlord */}
            {payments.length === 0 && properties.length === 0 && (
              <EmptyState
                title="No financial records found"
                description="Once you publish properties and sign lease agreements, your complete income reports and digital tax ledgers will automatically appear here."
              />
            )}
          </>
        )}
      </div>

      {/* ─── DIGITAL RECEIPT MODAL ─── */}
      {inspectReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="border-b border-charcoal/10 bg-cream/60 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rust text-white font-display font-bold text-sm">
                    HL
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-charcoal">HomeLink Ethiopia</h3>
                    <p className="text-[10px] text-charcoal/50">Verified Landlord Receipt Archive</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    {inspectReceipt.status === 'paid' || inspectReceipt.status === 'collected'
                      ? 'Official Settled Receipt'
                      : 'Pending Invoice'}
                  </span>
                  <p className="font-mono text-xs text-charcoal/70">
                    {inspectReceipt.receiptNumber || `RCPT-${inspectReceipt._id.slice(-6).toUpperCase()}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-charcoal/10 bg-cream/30 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Invoice Amount</p>
                <p className="mt-1 font-display text-3xl font-bold text-charcoal">
                  {fmtEtb(inspectReceipt.amount || inspectReceipt.amountDue || 0)}
                </p>
                <p className="mt-0.5 text-xs text-charcoal/60">
                  {inspectReceipt.paidDate
                    ? `Paid on ${fmtDate(inspectReceipt.paidDate)}`
                    : `Due date: ${fmtDate(inspectReceipt.dueDate)}`}
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-charcoal/80">
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Property:</span>
                  <span className="font-semibold text-charcoal">{getPropTitle(inspectReceipt)}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Tenant:</span>
                  <span className="font-semibold text-charcoal">{getTenantName(inspectReceipt)}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Billing Period:</span>
                  <span className="font-semibold text-charcoal">{inspectReceipt.periodMonth || 'Residential Lease'}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Payment Channel:</span>
                  <span className="font-semibold uppercase text-rust">
                    {inspectReceipt.paymentMethod === 'cbe' ? 'CBE Birr' : inspectReceipt.paymentMethod || 'Telebirr'}
                  </span>
                </div>
                {inspectReceipt.transactionReference && (
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="text-charcoal/50">Transaction Ref:</span>
                    <span className="font-mono font-semibold text-charcoal">{inspectReceipt.transactionReference}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-charcoal/50">Status:</span>
                  <span className="font-semibold uppercase text-emerald-700">
                    {inspectReceipt.status}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-sand/30 p-3 text-center text-[10px] text-charcoal/60">
                Digitally archived by HomeLink Ethiopia under FDRE Real Estate Registration Guidelines.
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectReceipt(null)}
                  className="rounded-xl border border-charcoal/15 px-4 py-2.5 text-xs font-semibold text-charcoal hover:bg-cream"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = inspectReceipt.receiptNumber || `RCPT-${inspectReceipt._id.slice(-6).toUpperCase()}`
                    const txt = `
=====================================================
HOMELINK ETHIOPIA — OFFICIAL LANDLORD RENT RECORD
=====================================================
Receipt No:      ${num}
Transaction Ref: ${inspectReceipt.transactionReference || 'N/A'}
Gateway:         ${(inspectReceipt.paymentMethod || 'telebirr').toUpperCase()}
Settled Date:    ${fmtDate(inspectReceipt.paidDate || inspectReceipt.dueDate)}
-----------------------------------------------------
Property:        ${getPropTitle(inspectReceipt)}
Tenant:          ${getTenantName(inspectReceipt)} (${getTenantContact(inspectReceipt)})
Billing Period:  ${inspectReceipt.periodMonth || 'Residential Lease'}
Amount:          ${fmtEtb(inspectReceipt.amount || inspectReceipt.amountDue || 0)}
Status:          ${inspectReceipt.status.toUpperCase()}
=====================================================
`.trim()
                    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${num}.txt`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex-1 rounded-xl border border-charcoal/20 bg-white py-2.5 text-xs font-semibold text-charcoal shadow-sm hover:bg-cream"
                >
                  📥 Download (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 rounded-xl bg-charcoal py-2.5 text-xs font-semibold text-white shadow hover:bg-black"
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
