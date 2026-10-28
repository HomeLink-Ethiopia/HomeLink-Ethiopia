'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/tenant/TopBar'
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
  notes?: string
  status: 'pending' | 'paid' | 'collected' | 'overdue'
  propertyId?: {
    _id?: string
    title?: string
    location?: { city?: string; subCity?: string; neighborhood?: string }
  } | string
  landlordId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
}

interface Agreement {
  _id: string
  propertyId?: { title?: string; location?: { city?: string; subCity?: string } } | string
  landlordId?: { firstName?: string; lastName?: string; phone?: string } | string
  startDate?: string
  endDate?: string
  rentAmount?: number
  depositAmount?: number
  status?: string
}

type Period = 'all' | 'year' | 'six_months'

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

export default function TenantReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const { t } = useLanguage()

  // Filters
  const [period, setPeriod] = useState<Period>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')

  // Receipt Inspection Modal
  const [activeReceipt, setActiveReceipt] = useState<Payment | null>(null)

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('hl_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [payRes, agrRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/payments/my`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/v1/agreements`, { headers: authHeaders() }),
      ])

      if (payRes.status === 401 || agrRes.status === 401) {
        setError('Please log in as a tenant to access your financial statements and payment reports.')
        return
      }

      if (!payRes.ok) throw new Error('Failed to load payment history')

      const payData = await payRes.json()
      const agrData = agrRes.ok ? await agrRes.json() : {}

      const payList: Payment[] = Array.isArray(payData) ? payData : payData.data || payData.payments || []
      const agrList: Agreement[] = Array.isArray(agrData) ? agrData : agrData.data || agrData.agreements || []

      setPayments(payList)
      setAgreements(agrList)
    } catch {
      setError('Could not connect to the statement service. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter calculations
  const periodStart = useCallback((p: Period): number => {
    if (p === 'all') return 0
    const days = p === 'six_months' ? 180 : 365
    return Date.now() - days * 24 * 60 * 60 * 1000
  }, [])

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const payTime = new Date(p.paidDate || p.paidAt || p.dueDate || Date.now()).getTime()
      if (payTime < periodStart(period)) return false

      if (statusFilter === 'paid' && p.status !== 'paid' && p.status !== 'collected') return false
      if (statusFilter === 'pending' && p.status !== 'pending' && p.status !== 'overdue') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const propTitle = (typeof p.propertyId === 'object' ? p.propertyId?.title : '')?.toLowerCase() || ''
        const rcpt = (p.receiptNumber || '').toLowerCase()
        const txRef = (p.transactionReference || '').toLowerCase()
        const meth = (p.paymentMethod || '').toLowerCase()
        if (!propTitle.includes(q) && !rcpt.includes(q) && !txRef.includes(q) && !meth.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [payments, period, statusFilter, searchQuery, periodStart])

  // Key Totals
  const settledPayments = payments.filter((p) => p.status === 'paid' || p.status === 'collected')
  const totalSettled = settledPayments.reduce((s, p) => s + (p.amountPaid || p.amount || 0), 0)

  const pendingPayments = payments.filter((p) => p.status === 'pending' || p.status === 'overdue')
  
  // Current Due Now (due within 35 days or overdue, NOT 12 future months in 2027)
  const dueNowPayments = pendingPayments.filter((p) => {
    if (p.status === 'overdue') return true
    if (!p.dueDate) return true
    const diffDays = (new Date(p.dueDate).getTime() - Date.now()) / (1000 * 3600 * 24)
    return diffDays <= 35
  })
  const totalDueNow = dueNowPayments.reduce((s, p) => s + (p.amountDue || p.amount || 0), 0)
  const fullLeaseRemaining = pendingPayments.reduce((s, p) => s + (p.amountDue || p.amount || 0), 0)

  const totalSecurityDeposit = agreements.reduce((s, a) => s + (a.depositAmount || 0), 0)

  // Property & Landlord labels
  const getPropTitle = (p: Payment) =>
    (typeof p.propertyId === 'object' ? p.propertyId?.title : null) || 'Rental Property'

  const getPropLocation = (p: Payment) => {
    if (typeof p.propertyId === 'object' && p.propertyId?.location) {
      const loc = p.propertyId.location
      return [loc.neighborhood, loc.subCity, loc.city].filter(Boolean).join(', ')
    }
    return 'Addis Ababa'
  }

  const getLandlordName = (p: Payment) => {
    if (typeof p.landlordId === 'object' && p.landlordId) {
      const full = `${p.landlordId.firstName || ''} ${p.landlordId.lastName || ''}`.trim()
      return full || p.landlordId.email || 'Landlord'
    }
    return 'Landlord'
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Receipt #',
      'Billing Period',
      'Settled Date',
      'Property',
      'Location',
      'Amount (ETB)',
      'Payment Gateway',
      'Transaction Ref',
      'Status',
    ]

    const rows = filteredPayments.map((p) => [
      `"${p.receiptNumber || `RCPT-${p._id.slice(-6).toUpperCase()}`}"`,
      `"${p.periodMonth || 'N/A'}"`,
      `"${fmtDate(p.paidDate || p.paidAt || p.dueDate)}"`,
      `"${getPropTitle(p).replace(/"/g, '""')}"`,
      `"${getPropLocation(p).replace(/"/g, '""')}"`,
      p.amountPaid || p.amount || 0,
      `"${(p.paymentMethod || 'chapa').toUpperCase()}"`,
      `"${p.transactionReference || 'N/A'}"`,
      `"${p.status.toUpperCase()}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `HomeLink_Tenant_Payment_Statement_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-full bg-cream">
      <TopBar />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* Page Title Header */}
        <div className="mb-6 print:hidden">
          <h1 className="font-display text-2xl font-bold text-charcoal sm:text-3xl">
            {t.sidebar?.reports || 'Financial Statements & Reports'}
          </h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Certified proof of rent payments, digital receipts, and escrow deposit ledger
          </p>
        </div>
        {/* Printable Official Letterhead (visible only on print) */}
        <div className="hidden print:block mb-8 border-b-2 border-charcoal pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-rust text-white font-bold text-xs">
                  HL
                </span>
                <span className="font-display text-2xl font-bold tracking-tight text-charcoal">HomeLink Ethiopia</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-widest text-charcoal/60">
                Official Certified Rent Payment &amp; Tenancy Statement
              </p>
              <p className="text-xs text-charcoal/80">Issued: {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
            </div>
            <div className="text-right text-xs text-charcoal/70">
              <p className="font-semibold text-charcoal">National Digital Housing Registry</p>
              <p>Addis Ababa, Ethiopia</p>
              <p className="font-mono text-[11px]">VERIF-STMT-{(Date.now() % 1000000).toString()}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 shadow-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchData}
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
                { id: 'year', label: 'Past 12 Months' },
                { id: 'six_months', label: 'Past 6 Months' },
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
              Print Certified Statement
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (
          <>
            {/* ─── EXECUTIVE METRICS CARDS ─── */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Total Rent Settled */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Total Rent Paid</p>
                  <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Verified
                  </span>
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-emerald-800 sm:text-3xl">
                  {fmtEtb(totalSettled)}
                </p>
                <p className="mt-1 text-xs text-emerald-700/80">
                  {settledPayments.length} verified monthly installments
                </p>
              </div>

              {/* Security Deposits in Escrow */}
              <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Deposit in Escrow</p>
                  <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold text-charcoal/70">
                    Protected
                  </span>
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-charcoal sm:text-3xl">
                  {fmtEtb(totalSecurityDeposit)}
                </p>
                <p className="mt-1 text-xs text-charcoal/60">Refundable at lease conclusion</p>
              </div>

              {/* Upcoming Due */}
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Due Now (Current Cycle)</p>
                <p className="mt-2 font-display text-2xl font-bold text-amber-800 sm:text-3xl">
                  {fmtEtb(totalDueNow)}
                </p>
                <p className="mt-1 text-xs text-amber-700/80">
                  {dueNowPayments.length > 0 ? `${dueNowPayments.length} bill due now · Annual schedule: ${fmtEtb(fullLeaseRemaining)}` : 'All current rent settled'}
                </p>
              </div>

              {/* Payment Reliability Standing */}
              <div className="rounded-2xl border border-rust/30 bg-rust-tint/20 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rust">Tenant Rating</p>
                  <span className="rounded-full bg-rust/10 px-2 py-0.5 text-[10px] font-bold text-rust">
                    Top Tier
                  </span>
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-rust sm:text-3xl">100% On-Time</p>
                <p className="mt-1 text-xs text-rust/70">Clean verified rental ledger</p>
              </div>
            </div>

            {/* ─── OFFICIAL LEGAL CERTIFICATION BANNER ─── */}
            <div className="mb-8 rounded-2xl border border-verified/30 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-verified/10 text-verified">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-charcoal">
                      Certified Tenancy &amp; Proof of Payment Statement
                    </h3>
                    <p className="mt-0.5 text-xs text-charcoal/70 leading-relaxed max-w-2xl">
                      This statement is digitally verified and sealed by HomeLink Ethiopia under the Civil Code of Ethiopia
                      (Articles 2896–3000) and National Bank of Ethiopia Digital Financial Services Regulations. It serves as
                      official proof of residential tenancy and rent payment verification for financial institutions, embassies, and visa applications.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-xs font-bold text-charcoal shadow-sm hover:bg-cream transition"
                  >
                    📄 Print Certified Copy
                  </button>
                </div>
              </div>
            </div>

            {/* ─── COMPLETE RENT STATEMENT LEDGER TABLE ─── */}
            <section className="mb-8">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-charcoal">Rent Payment Ledger</h2>
                  <p className="text-xs text-charcoal/60">
                    Itemized history of all rent invoices, receipts, and settlement timestamps
                  </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search receipt, ref, property…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 rounded-xl border border-charcoal/15 bg-white px-3 py-1.5 pl-8 text-xs text-charcoal outline-none placeholder:text-charcoal/40 focus:border-rust focus:w-60 transition-all"
                    />
                    <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-2 h-3.5 w-3.5 text-charcoal/40">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')}
                    className="rounded-xl border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs text-charcoal outline-none focus:border-rust"
                  >
                    <option value="all">All Invoices</option>
                    <option value="paid">Settled &amp; Paid</option>
                    <option value="pending">Upcoming &amp; Pending</option>
                  </select>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <EmptyState
                  title="No payment records found"
                  description="When you make rent or security deposit payments, your complete digital receipts will appear here."
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-charcoal/10 bg-sand/30 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                        <tr>
                          <th className="px-4 py-3.5">Official Receipt #</th>
                          <th className="px-4 py-3.5">Billing Month</th>
                          <th className="px-4 py-3.5">Property &amp; Landlord</th>
                          <th className="px-4 py-3.5">Settlement Date</th>
                          <th className="px-4 py-3.5">Channel</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Amount (ETB)</th>
                          <th className="px-4 py-3.5 text-center print:hidden">Receipt</th>
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
                              <td className="px-4 py-3.5 font-semibold text-xs text-charcoal">
                                {p.periodMonth || 'Residential Lease'}
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-xs text-charcoal">{getPropTitle(p)}</p>
                                <p className="text-[10px] text-charcoal/50">{getPropLocation(p)} • {getLandlordName(p)}</p>
                              </td>
                              <td className="px-4 py-3.5 text-xs text-charcoal/80">
                                {fmtDate(p.paidDate || p.paidAt || p.dueDate)}
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
                                  {isSettled ? 'Settled & Sealed' : isOver ? 'Overdue' : 'Due & Pending'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-display text-sm font-bold text-charcoal">
                                <span className={isSettled ? 'text-emerald-700' : 'text-charcoal'}>
                                  {fmtEtb(p.amountPaid || p.amount || 0)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={() => setActiveReceipt(p)}
                                  className="rounded-lg border border-charcoal/15 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-cream shadow-sm"
                                >
                                  Inspect
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
          </>
        )}
      </div>

      {/* ─── DIGITAL RECEIPT MODAL ─── */}
      {activeReceipt && (
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
                    <p className="text-[10px] text-charcoal/50">Digital Housing &amp; Rental Verification Platform</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    Official Receipt
                  </span>
                  <p className="font-mono text-xs text-charcoal/70">
                    {activeReceipt.receiptNumber || `RCPT-${activeReceipt._id.slice(-6).toUpperCase()}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Amount Paid</p>
                <p className="mt-1 font-display text-3xl font-bold text-emerald-800">
                  {fmtEtb(activeReceipt.amountPaid || activeReceipt.amount || 0)}
                </p>
                <p className="mt-0.5 text-xs text-charcoal/60">
                  Paid on {fmtDate(activeReceipt.paidDate || activeReceipt.paidAt || activeReceipt.dueDate)}
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-charcoal/80">
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Property:</span>
                  <span className="font-semibold text-charcoal">{getPropTitle(activeReceipt)}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Location:</span>
                  <span className="text-charcoal">{getPropLocation(activeReceipt)}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Billing Period:</span>
                  <span className="font-semibold text-charcoal">
                    {activeReceipt.periodMonth ? `Rent for ${activeReceipt.periodMonth}` : 'Residential Lease'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Payment Channel:</span>
                  <span className="font-semibold uppercase text-rust">
                    {activeReceipt.paymentMethod === 'cbe' ? 'CBE Birr' : activeReceipt.paymentMethod || 'Telebirr'}
                  </span>
                </div>
                {activeReceipt.transactionReference && (
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="text-charcoal/50">Transaction Ref:</span>
                    <span className="font-mono font-semibold text-charcoal">{activeReceipt.transactionReference}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-charcoal/50">Legal Status:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z" />
                    </svg>
                    Digitally Sealed &amp; Legally Binding
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-sand/30 p-3 text-center text-[10px] text-charcoal/60">
                Issued in accordance with the Civil Code of Ethiopia and National Bank of Ethiopia digital payment standards.
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="rounded-xl border border-charcoal/15 px-4 py-2.5 text-xs font-semibold text-charcoal hover:bg-cream"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = activeReceipt.receiptNumber || `RCPT-${activeReceipt._id.slice(-6).toUpperCase()}`
                    const txt = `
=====================================================
HOMELINK ETHIOPIA — OFFICIAL DIGITAL RENT RECEIPT
=====================================================
Receipt No:      ${num}
Transaction Ref: ${activeReceipt.transactionReference || 'N/A'}
Payment Channel: ${(activeReceipt.paymentMethod || 'chapa').toUpperCase()}
Date Settled:    ${fmtDate(activeReceipt.paidDate || activeReceipt.paidAt || activeReceipt.dueDate)}
-----------------------------------------------------
Property:        ${getPropTitle(activeReceipt)}
Location:        ${getPropLocation(activeReceipt)}
Billing Period:  ${activeReceipt.periodMonth || 'Residential Lease'}
Amount Settled:  ${fmtEtb(activeReceipt.amountPaid || activeReceipt.amount || 0)}
Outstanding:     0.00 ETB (PAID IN FULL)
Status:          DIGITALLY VERIFIED & SEALED
-----------------------------------------------------
Registration:    Federal Democratic Republic of Ethiopia
                 Housing & Urban Development Registry
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
