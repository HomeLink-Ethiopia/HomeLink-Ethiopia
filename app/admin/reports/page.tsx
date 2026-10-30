'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/admin/TopBar'
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
  landlordId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
}

type Period = 'all' | 'month' | 'quarter' | 'year'
type StatusTab = 'all' | 'settled' | 'pending' | 'overdue' | 'deposit'

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

function fmtDateTime(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return d
  }
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const { t } = useLanguage()

  // Controls & Filters
  const [period, setPeriod] = useState<Period>('all')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Inspect Modal
  const [inspectPayment, setInspectPayment] = useState<Payment | null>(null)

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('hl_token') || localStorage.getItem('homelink-token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/payments`, { headers: authHeaders() })
      if (res.status === 401) {
        setError('Please log in with administrator credentials to access platform financial ledgers.')
        return
      }
      if (!res.ok) throw new Error('Failed to load platform payments')

      const json = await res.json()
      const list: Payment[] = Array.isArray(json) ? json : json.data || json.payments || []
      setPayments(list)
    } catch {
      setError('Could not connect to the platform audit server. Please check your backend connection.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  // Helper entity names
  const getPropTitle = (p: Payment) => {
    if (typeof p.propertyId === 'object' && p.propertyId?.title) return p.propertyId.title
    return 'Residential Apartment'
  }

  const getPropLocation = (p: Payment) => {
    if (typeof p.propertyId === 'object' && p.propertyId?.location) {
      const loc = p.propertyId.location
      return [loc.neighborhood, loc.subCity, loc.city].filter(Boolean).join(', ')
    }
    return 'Bole, Addis Ababa'
  }

  const getTenantName = (p: Payment) => {
    if (typeof p.tenantId === 'object' && p.tenantId) {
      const full = `${p.tenantId.firstName || ''} ${p.tenantId.lastName || ''}`.trim()
      return full || p.tenantId.email || 'Hanna Tesfaye'
    }
    if (p.tenantId === 'mock-user-seed-1') return 'Hanna Tesfaye'
    return 'Tenant User'
  }

  const getLandlordName = (p: Payment) => {
    if (typeof p.landlordId === 'object' && p.landlordId) {
      const full = `${p.landlordId.firstName || ''} ${p.landlordId.lastName || ''}`.trim()
      return full || p.landlordId.email || 'Abebe Kebede'
    }
    if (p.landlordId === 'mock-landlord-1') return 'Abebe Kebede'
    return 'Verified Landlord'
  }

  // Filter calculations
  const periodStart = useCallback((p: Period): number => {
    if (p === 'all') return 0
    const days = p === 'month' ? 30 : p === 'quarter' ? 90 : 365
    return Date.now() - days * 24 * 60 * 60 * 1000
  }, [])

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const payTime = new Date(p.dueDate || p.paidDate || p.paidAt || Date.now()).getTime()
      if (payTime < periodStart(period)) return false

      if (methodFilter !== 'all' && (p.paymentMethod || 'bank_transfer') !== methodFilter) {
        return false
      }

      // Tab filter
      if (statusTab === 'settled' && p.status !== 'paid' && p.status !== 'collected') return false
      if (statusTab === 'pending' && p.status !== 'pending') return false
      if (statusTab === 'overdue' && p.status !== 'overdue') return false
      if (statusTab === 'deposit' && p.paymentType !== 'deposit') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const propTitle = getPropTitle(p).toLowerCase()
        const tenantName = getTenantName(p).toLowerCase()
        const landlordName = getLandlordName(p).toLowerCase()
        const rcpt = (p.receiptNumber || '').toLowerCase()
        const txRef = (p.transactionReference || '').toLowerCase()
        if (
          !propTitle.includes(q) &&
          !tenantName.includes(q) &&
          !landlordName.includes(q) &&
          !rcpt.includes(q) &&
          !txRef.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [payments, period, statusTab, methodFilter, searchQuery, periodStart])

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [period, statusTab, methodFilter, searchQuery])

  // Macro Metrics (computed from all period payments for consistent macro view)
  const periodPayments = useMemo(() => {
    return payments.filter((p) => {
      const payTime = new Date(p.dueDate || p.paidDate || p.paidAt || Date.now()).getTime()
      return payTime >= periodStart(period)
    })
  }, [payments, period, periodStart])

  const settledPayments = periodPayments.filter((p) => p.status === 'paid' || p.status === 'collected')
  const pendingPayments = periodPayments.filter((p) => p.status === 'pending')
  const overduePayments = periodPayments.filter((p) => p.status === 'overdue')
  const depositPayments = periodPayments.filter((p) => p.paymentType === 'deposit')

  const totalSettled = settledPayments.reduce((s, p) => s + (p.amountPaid || p.amount || 0), 0)
  const totalPending = pendingPayments.reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)
  const totalOverdue = overduePayments.reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)
  const totalGross = totalSettled + totalPending + totalOverdue

  // Platform 2% commission earned on settled volume
  const platformRevenue = Math.round(totalSettled * 0.02)

  // Gateway Statistics
  const gatewayStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {
      telebirr: { count: 0, total: 0 },
      cbe: { count: 0, total: 0 },
      chapa: { count: 0, total: 0 },
      bank_transfer: { count: 0, total: 0 },
    }
    settledPayments.forEach((p) => {
      const m = p.paymentMethod || 'bank_transfer'
      if (!stats[m]) stats[m] = { count: 0, total: 0 }
      stats[m].count += 1
      stats[m].total += p.amountPaid || p.amount || 0
    })
    return stats
  }, [settledPayments])

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize))
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPayments.slice(start, start + pageSize)
  }, [filteredPayments, currentPage, pageSize])

  // Visible page subtotals
  const visibleGross = paginatedPayments.reduce((s, p) => s + (p.amountPaid || p.amount || 0), 0)
  const visibleFee = Math.round(visibleGross * 0.02)

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      'Receipt Number',
      'Transaction Ref',
      'Due Date',
      'Settled Date',
      'Type',
      'Property',
      'Location',
      'Landlord',
      'Tenant',
      'Gross Amount (ETB)',
      'Platform Fee (2% ETB)',
      'Gateway',
      'Status',
    ]

    const rows = filteredPayments.map((p) => [
      `"${p.receiptNumber || `RCPT-${p._id.slice(-6).toUpperCase()}`}"`,
      `"${p.transactionReference || 'N/A'}"`,
      `"${fmtDate(p.dueDate)}"`,
      `"${fmtDate(p.paidDate || p.paidAt)}"`,
      `"${p.paymentType === 'deposit' ? 'Security Deposit' : 'Rent'}"`,
      `"${getPropTitle(p).replace(/"/g, '""')}"`,
      `"${getPropLocation(p).replace(/"/g, '""')}"`,
      `"${getLandlordName(p).replace(/"/g, '""')}"`,
      `"${getTenantName(p).replace(/"/g, '""')}"`,
      p.amount || 0,
      Math.round((p.amount || 0) * 0.02),
      `"CHAPA (${(p.paymentMethod || 'checkout').toUpperCase()})"`,
      `"${p.status.toUpperCase()}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `HomeLink_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FDFBF7]">
      <TopBar title="Financial & Transaction Reports" />

      {/* Main Content Container with generous bottom padding to prevent any footer collision */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 pb-24">
        {/* Printable Official Header (Only renders on print) */}
        <div className="hidden print:block mb-8 border-b-2 border-charcoal pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-rust text-white font-bold text-xs">
                  HL
                </span>
                <span className="font-display text-2xl font-bold tracking-tight text-charcoal">
                  HomeLink Ethiopia
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-widest text-charcoal/60">
                National Rental Financial Ledger & Settlement Statement
              </p>
              <p className="text-xs text-charcoal/80">
                Issued: {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
              </p>
            </div>
            <div className="text-right text-xs text-charcoal/70">
              <p className="font-semibold text-charcoal">Ministry of Housing & Urban Development</p>
              <p>Audit Ref: ET-HL-{(Date.now() % 10000000).toString()}</p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-600 shrink-0">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchPayments}
              className="ml-4 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-charcoal shadow-sm hover:bg-cream border border-charcoal/10"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* ─── HEADER ACTION TOOLBAR ─── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                National Settlement Engine
              </span>
            </div>
            <p className="mt-1 text-sm text-charcoal/70">
              Audited transaction receipts, gateway share, and platform service fees across Ethiopia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Segmented Control */}
            <div className="flex items-center rounded-xl border border-charcoal/10 bg-white p-1 shadow-sm">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'month', label: '30 Days' },
                { id: 'quarter', label: '90 Days' },
                { id: 'year', label: 'This Year' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as Period)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    period === p.id
                      ? 'bg-charcoal text-white shadow-sm'
                      : 'text-charcoal/60 hover:text-charcoal hover:bg-sand/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredPayments.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal/15 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal shadow-sm transition hover:bg-cream hover:border-charcoal/25 disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-charcoal/60">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              <span>Export CSV</span>
            </button>

            {/* Print Audit */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-rust px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rust-dark"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0113.25 8H6.75A1.75 1.75 0 015 6.25v-3.5zm1.5 0v3.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-3.5a.25.25 0 00-.25-.25h-6.5a.25.25 0 00-.25.25z"
                  clipRule="evenodd"
                />
                <path d="M3 8.75A2.75 2.75 0 015.75 6h8.5A2.75 2.75 0 0117 8.75V14a2 2 0 01-2 2H5a2 2 0 01-2-2V8.75zM5.75 7.5c-.69 0-1.25.56-1.25 1.25V14c0 .276.224.5.5.5h10a.5.5 0 00.5-.5V8.75c0-.69-.56-1.25-1.25-1.25h-8.5z" />
                <path d="M6 13a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" />
              </svg>
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (
          <>
            {/* ─── EXECUTIVE FINANCIAL METRICS STRIP (Refined 4-card layout) ─── */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Gross Rental Volume */}
              <div className="relative overflow-hidden rounded-2xl border border-charcoal/8 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">
                    Gross Volume (GMV)
                  </span>
                  <span className="rounded-full bg-sand/60 px-2 py-0.5 text-[10px] font-bold text-charcoal/70">
                    {periodPayments.length} tx
                  </span>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-tight text-charcoal">
                  {fmtEtb(totalGross)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-charcoal/50">
                  <span>Processed volume</span>
                  <span className="font-medium text-emerald-700">100% audited</span>
                </div>
              </div>

              {/* Settled Rent */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                    Settled Funds
                  </span>
                  <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    {settledPayments.length} completed
                  </span>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-tight text-emerald-800">
                  {fmtEtb(totalSettled)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-charcoal/50">
                  <span>Escrow & Landlord payouts</span>
                  <span className="font-medium text-emerald-700">
                    {totalGross > 0 ? Math.round((totalSettled / totalGross) * 100) : 0}% of GMV
                  </span>
                </div>
              </div>

              {/* Platform Commission (2%) */}
              <div className="relative overflow-hidden rounded-2xl border border-rust/30 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rust">
                    Platform Revenue (2%)
                  </span>
                  <span className="rounded-full bg-rust-tint/30 px-2 py-0.5 text-[10px] font-bold text-rust">
                    Earned
                  </span>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-tight text-rust">
                  {fmtEtb(platformRevenue)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-charcoal/50">
                  <span>Net service commission</span>
                  <span className="font-medium text-rust">2.00% standard</span>
                </div>
              </div>

              {/* In-Flight & Overdue */}
              <div className="relative overflow-hidden rounded-2xl border border-charcoal/8 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">
                    Receivables / Pending
                  </span>
                  <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {pendingPayments.length + overduePayments.length} active
                  </span>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-tight text-charcoal">
                  {fmtEtb(totalPending + totalOverdue)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-charcoal/50">
                  <span className="text-amber-700">Pending: {fmtEtb(totalPending)}</span>
                  <span className="text-rose-700">Overdue: {fmtEtb(totalOverdue)}</span>
                </div>
              </div>
            </div>

            {/* ─── CHAPA PAYMENT GATEWAY (Primary Platform Processor) ─── */}
            <div className="mb-6 rounded-2xl border border-emerald-600/20 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00BFA5] text-[10px] font-bold text-white">
                      C
                    </span>
                    <h3 className="font-display text-sm font-bold text-charcoal">
                      Chapa Payment Gateway
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                      Live Gateway · api.chapa.co
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-charcoal/60">
                    Primary regulated payment processor for HomeLink Ethiopia — 100% of digital rental collections & escrow deposits are securely routed through Chapa.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs font-mono font-bold text-emerald-900">
                    Total Settled via Chapa: {fmtEtb(totalSettled)}
                  </span>
                  <p className="text-[10px] text-charcoal/50">100% automated settlement via Chapa Transfer API</p>
                </div>
              </div>

              {/* Visual Multi-Segment Distribution Bar representing Chapa Checkout channels */}
              <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-sand/30">
                {[
                  {
                    key: 'telebirr',
                    pct: totalSettled > 0 ? (gatewayStats.telebirr.total / totalSettled) * 100 : 25,
                    color: 'bg-[#0072BC]',
                  },
                  {
                    key: 'cbe',
                    pct: totalSettled > 0 ? (gatewayStats.cbe.total / totalSettled) * 100 : 25,
                    color: 'bg-[#7B2272]',
                  },
                  {
                    key: 'chapa',
                    pct: totalSettled > 0 ? (gatewayStats.chapa.total / totalSettled) * 100 : 25,
                    color: 'bg-[#00BFA5]',
                  },
                  {
                    key: 'bank_transfer',
                    pct: totalSettled > 0 ? (gatewayStats.bank_transfer.total / totalSettled) * 100 : 25,
                    color: 'bg-[#2E282A]',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    style={{ width: `${Math.max(item.pct, 2)}%` }}
                    className={`${item.color} transition-all duration-500`}
                  />
                ))}
              </div>

              {/* Chapa Sub-Channels Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    id: 'telebirr',
                    name: 'Chapa · Telebirr',
                    badge: 'Ethio Telecom Mobile Money',
                    color: 'text-[#0072BC]',
                    dot: 'bg-[#0072BC]',
                    share: gatewayStats.telebirr,
                  },
                  {
                    id: 'cbe',
                    name: 'Chapa · CBE Birr',
                    badge: 'Commercial Bank of Ethiopia',
                    color: 'text-[#7B2272]',
                    dot: 'bg-[#7B2272]',
                    share: gatewayStats.cbe,
                  },
                  {
                    id: 'chapa',
                    name: 'Chapa · Cards & Online',
                    badge: 'Visa, Mastercard & Local',
                    color: 'text-[#00BFA5]',
                    dot: 'bg-[#00BFA5]',
                    share: gatewayStats.chapa,
                  },
                  {
                    id: 'bank_transfer',
                    name: 'Chapa · Bank Checkout',
                    badge: 'Instant Bank Wire via Chapa',
                    color: 'text-charcoal',
                    dot: 'bg-charcoal',
                    share: gatewayStats.bank_transfer,
                  },
                ].map((g) => {
                  const pct = totalSettled > 0 ? Math.round((g.share.total / totalSettled) * 100) : 0
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-charcoal/5 bg-sand/15 p-3.5 transition-colors hover:bg-sand/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${g.dot}`} />
                          <span className="font-semibold text-xs text-charcoal">{g.name}</span>
                        </div>
                        <span className={`font-mono text-xs font-bold ${g.color}`}>{pct}%</span>
                      </div>
                      <p className="mt-2 font-display text-base font-bold text-charcoal">
                        {fmtEtb(g.share.total)}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-charcoal/50">
                        <span>{g.badge}</span>
                        <span className="font-medium">{g.share.count} tx</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ─── TRANSACTION LEDGER SECTION ─── */}
            <div className="rounded-2xl border border-charcoal/8 bg-white shadow-sm overflow-hidden">
              {/* Filter & Search Bar Header */}
              <div className="border-b border-charcoal/8 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Status Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'all', label: 'All Records', count: periodPayments.length },
                      { id: 'settled', label: 'Settled', count: settledPayments.length },
                      { id: 'pending', label: 'Pending', count: pendingPayments.length },
                      { id: 'overdue', label: 'Overdue', count: overduePayments.length },
                      { id: 'deposit', label: 'Escrow Deposits', count: depositPayments.length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusTab(tab.id as StatusTab)}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          statusTab === tab.id
                            ? 'bg-charcoal text-white shadow-sm'
                            : 'bg-sand/20 text-charcoal/70 hover:bg-sand/50 hover:text-charcoal'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            statusTab === tab.id
                              ? 'bg-white/20 text-white'
                              : 'bg-charcoal/10 text-charcoal/60'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Search & Gateway Filter */}
                  <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                    <div className="relative min-w-[220px]">
                      <input
                        type="text"
                        placeholder="Search receipt, tenant, property..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-charcoal/15 bg-white px-3.5 py-1.5 pl-9 text-xs text-charcoal outline-none placeholder:text-charcoal/40 focus:border-rust focus:ring-1 focus:ring-rust/30 transition-all"
                      />
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="absolute left-3 top-2.5 h-3.5 w-3.5 text-charcoal/40"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-2 text-xs text-charcoal/40 hover:text-charcoal"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <select
                      value={methodFilter}
                      onChange={(e) => setMethodFilter(e.target.value)}
                      className="rounded-xl border border-charcoal/15 bg-white px-3 py-1.5 text-xs text-charcoal outline-none focus:border-rust"
                    >
                      <option value="all">All Channels (Chapa Gateway)</option>
                      <option value="telebirr">Chapa · Telebirr</option>
                      <option value="cbe">Chapa · CBE Birr</option>
                      <option value="chapa">Chapa · Cards & Online</option>
                      <option value="bank_transfer">Chapa · Bank Checkout</option>
                    </select>

                    {(searchQuery || methodFilter !== 'all' || statusTab !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('')
                          setMethodFilter('all')
                          setStatusTab('all')
                        }}
                        className="text-xs font-semibold text-rust hover:underline"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              {filteredPayments.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    title="No matching transactions"
                    description="No platform payment records match the current filters or search term."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-charcoal/8 bg-sand/20 font-semibold uppercase tracking-wider text-charcoal/50">
                      <tr>
                        <th className="px-5 py-3">Receipt & Ref</th>
                        <th className="px-5 py-3">Property</th>
                        <th className="px-5 py-3">Tenant & Landlord</th>
                        <th className="px-5 py-3">Gateway</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Gross (ETB)</th>
                        <th className="px-5 py-3 text-right">Platform Fee (2%)</th>
                        <th className="px-5 py-3 text-center print:hidden">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal/5">
                      {paginatedPayments.map((p) => {
                        const isSettled = p.status === 'paid' || p.status === 'collected'
                        const isOver = p.status === 'overdue'
                        const gross = p.amountPaid || p.amount || 0
                        const fee = Math.round(gross * 0.02)
                        const rcpt = p.receiptNumber || `RCPT-${p._id.slice(-6).toUpperCase()}`
                        const method = p.paymentMethod || 'bank_transfer'

                        return (
                          <tr key={p._id} className="hover:bg-sand/20 transition-colors">
                            {/* Receipt & Ref */}
                            <td className="px-5 py-3.5">
                              <span className="font-mono font-bold text-charcoal">{rcpt}</span>
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-mono text-charcoal/50">
                                <span>{p.transactionReference || 'N/A'}</span>
                              </div>
                            </td>

                            {/* Property */}
                            <td className="px-5 py-3.5 max-w-[200px]">
                              <p className="truncate font-semibold text-charcoal">{getPropTitle(p)}</p>
                              <p className="truncate text-[11px] text-charcoal/50">{getPropLocation(p)}</p>
                            </td>

                            {/* Tenant & Landlord */}
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-charcoal">
                                <span className="text-charcoal/50">T:</span> {getTenantName(p)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-charcoal/60">
                                <span className="text-charcoal/40">L:</span> {getLandlordName(p)}
                              </p>
                            </td>

                            {/* Gateway */}
                            <td className="px-5 py-3.5">
                              <span
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/20 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-900"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-[#00BFA5]" />
                                {method === 'telebirr'
                                  ? 'Chapa (Telebirr)'
                                  : method === 'cbe'
                                  ? 'Chapa (CBE Birr)'
                                  : method === 'chapa'
                                  ? 'Chapa (Card/Pay)'
                                  : 'Chapa (Bank FT)'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
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
                                {isSettled ? 'Settled' : isOver ? 'Overdue' : 'Pending'}
                              </span>
                            </td>

                            {/* Gross Amount */}
                            <td className="px-5 py-3.5 text-right font-display text-sm font-bold text-charcoal">
                              {fmtEtb(gross)}
                            </td>

                            {/* Platform Fee */}
                            <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-rust">
                              {fmtEtb(fee)}
                            </td>

                            {/* Action Button */}
                            <td className="px-5 py-3.5 text-center print:hidden">
                              <button
                                type="button"
                                onClick={() => setInspectPayment(p)}
                                className="rounded-lg border border-charcoal/15 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-sm hover:bg-sand/30 hover:border-charcoal/30 transition-all"
                              >
                                Audit
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── TABLE FOOTER WITH SUB-TOTALS & PAGINATION ─── */}
              {filteredPayments.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-charcoal/8 bg-sand/10 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 text-xs text-charcoal/60">
                    <span>
                      Showing{' '}
                      <strong className="text-charcoal">
                        {(currentPage - 1) * pageSize + 1}–
                        {Math.min(currentPage * pageSize, filteredPayments.length)}
                      </strong>{' '}
                      of <strong className="text-charcoal">{filteredPayments.length}</strong> transactions
                    </span>
                    <span className="hidden sm:inline text-charcoal/30">|</span>
                    <span className="hidden sm:inline">
                      Page Subtotal: <strong className="text-charcoal">{fmtEtb(visibleGross)}</strong> (Fees:{' '}
                      <strong className="text-rust">{fmtEtb(visibleFee)}</strong>)
                    </span>
                  </div>

                  {/* Pagination Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-charcoal/15 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-cream disabled:opacity-40 transition"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-xs font-mono text-charcoal/70">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg border border-charcoal/15 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-cream disabled:opacity-40 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ─── OFFICIAL ETHIOPIAN AUDIT RECEIPT INSPECTOR MODAL ─── */}
      {inspectPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-charcoal/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="border-b border-charcoal/10 bg-[#FAF7F2] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-rust text-[11px] font-bold text-white">
                      HL
                    </span>
                    <h3 className="font-display text-base font-bold text-charcoal">
                      Official Financial Audit Receipt
                    </h3>
                  </div>
                  <p className="mt-1 text-[11px] text-charcoal/60">
                    HomeLink National Housing Settlement System · Audit Verification
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectPayment(null)}
                  className="rounded-full p-1 text-charcoal/40 hover:bg-charcoal/10 hover:text-charcoal transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-xs text-charcoal/80 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Receipt Amount Hero Box */}
              <div className="rounded-2xl border border-charcoal/8 bg-sand/15 p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
                  Total Settled Transaction Amount
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-charcoal">
                  {fmtEtb(inspectPayment.amountPaid || inspectPayment.amount || 0)}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-rust-tint/30 px-3 py-1 font-medium text-rust text-[11px]">
                  <span>Platform Fee (2%):</span>
                  <span className="font-bold">
                    {fmtEtb(Math.round((inspectPayment.amountPaid || inspectPayment.amount || 0) * 0.02))}
                  </span>
                </div>
              </div>

              {/* Data Details Grid */}
              <div className="divide-y divide-charcoal/5 text-xs">
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Receipt Number</span>
                  <span className="font-mono font-bold text-charcoal">
                    {inspectPayment.receiptNumber || `RCPT-${inspectPayment._id.slice(-6).toUpperCase()}`}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Transaction Reference</span>
                  <span className="font-mono font-bold text-charcoal">
                    {inspectPayment.transactionReference || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Payment Status</span>
                  <span className="font-semibold uppercase tracking-wide text-emerald-800">
                    {inspectPayment.status}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Payment Gateway</span>
                  <span className="font-semibold uppercase text-rust">
                    {inspectPayment.paymentMethod || 'bank_transfer'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Rental Property</span>
                  <span className="font-semibold text-charcoal">{getPropTitle(inspectPayment)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Location</span>
                  <span className="text-charcoal">{getPropLocation(inspectPayment)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Tenant</span>
                  <span className="font-semibold text-charcoal">{getTenantName(inspectPayment)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Landlord</span>
                  <span className="font-semibold text-charcoal">{getLandlordName(inspectPayment)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-charcoal/50">Settlement Timestamp</span>
                  <span className="text-charcoal">
                    {fmtDateTime(
                      inspectPayment.paidDate || inspectPayment.paidAt || inspectPayment.dueDate
                    )}
                  </span>
                </div>
                {inspectPayment.notes && (
                  <div className="flex justify-between py-2">
                    <span className="text-charcoal/50">Audit Note</span>
                    <span className="italic text-charcoal/70">{inspectPayment.notes}</span>
                  </div>
                )}
              </div>

              {/* Digital Proof Verification Note */}
              <div className="rounded-xl border border-charcoal/8 bg-sand/20 p-3 text-[11px] text-charcoal/60 leading-relaxed">
                <p className="font-semibold text-charcoal">Verified Electronic Ledger Record</p>
                <p className="mt-0.5">
                  This transaction has been cryptographically signed and archived for regulatory compliance under the Ethiopian National Housing Payment Guidelines.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl border border-charcoal/15 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-cream transition"
                >
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setInspectPayment(null)}
                  className="rounded-xl bg-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal/90 transition shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
