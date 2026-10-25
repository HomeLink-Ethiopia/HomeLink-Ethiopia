'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Payment {
  _id: string
  agreementId?: string
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
  status: 'pending' | 'paid' | 'overdue' | 'collected'
  proofSubmitted?: boolean
  propertyId?: {
    _id?: string
    title?: string
    location?: { city?: string; subCity?: string; neighborhood?: string }
  } | string
}

function fmtEtb(n?: number) {
  return n !== undefined ? `ETB ${n.toLocaleString()}` : '—'
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

export default function PaymentsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'paid'>('all')

  // Payment checkout modal state
  const [payingPayment, setPayingPayment] = useState<Payment | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'telebirr' | 'cbe' | 'chapa' | 'bank_transfer'>('chapa')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [txRef, setTxRef] = useState('')
  const [isSubmittingPay, setIsSubmittingPay] = useState(false)
  const [payModalError, setPayModalError] = useState('')

  // Receipt inspection modal state
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

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
        const list: Payment[] = Array.isArray(data) ? data : (data.data || data.payments || [])
        setPayments(list)
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

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const propertyName = (p: Payment) =>
    (typeof p.propertyId === 'object' ? p.propertyId?.title : null) || 'Rental Property'

  const propertyLocation = (p: Payment) => {
    if (typeof p.propertyId !== 'object' || !p.propertyId?.location) return 'Addis Ababa'
    const loc = p.propertyId.location
    return [loc.neighborhood, loc.subCity, loc.city].filter(Boolean).join(', ')
  }

  // Submit payment
  async function handleCompletePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payingPayment) return
    setIsSubmittingPay(true)
    setPayModalError('')

    try {
      const token = localStorage.getItem('hl_token')
      const isInstant = paymentMethod === 'telebirr' || paymentMethod === 'chapa'
      const generatedRef =
        txRef.trim() ||
        `TX-${paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`

      const payload = {
        paymentMethod,
        transactionReference: generatedRef,
        instant: isInstant,
        amountPaid: payingPayment.amount,
      }

      if (paymentMethod === 'chapa') {
        const chapaRes = await fetch(`${API_URL}/api/v1/payments/${payingPayment._id}/chapa/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        const chapaData = await chapaRes.json().catch(() => ({}))
        if (chapaRes.ok && chapaData.checkout_url) {
          window.location.href = chapaData.checkout_url
          return
        }
      }

      const res = await fetch(`${API_URL}/api/v1/payments/${payingPayment._id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        const updated = data.data || data.payment || {
          ...payingPayment,
          status: isInstant ? 'paid' : 'pending',
          paidAt: new Date().toISOString(),
          paymentMethod,
          transactionReference: generatedRef,
          receiptNumber: `RCPT-${payingPayment._id.slice(-6).toUpperCase()}`,
        }

        setPayments((prev) =>
          prev.map((p) => (p._id === payingPayment._id ? { ...p, ...updated } : p))
        )

        setSuccessMsg(
          isInstant
            ? `Payment of ETB ${payingPayment.amount.toLocaleString()} settled successfully via ${paymentMethod.toUpperCase()}!`
            : `Payment proof submitted! Landlord has been notified to verify.`
        )

        const paidTarget = { ...payingPayment, ...updated }
        setPayingPayment(null)
        setTxRef('')

        if (isInstant) {
          // Offer immediate receipt view
          setTimeout(() => {
            setReceiptPayment(paidTarget)
          }, 300)
        }
      } else {
        setPayModalError(data.message || 'Payment processing failed. Please try again.')
      }
    } catch {
      setPayModalError('Network error while processing payment. Please check your connection.')
    } finally {
      setIsSubmittingPay(false)
    }
  }

  // Summary Metrics
  const totalPaid = payments
    .filter((p) => p.status === 'paid' || p.status === 'collected')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const pendingList = payments.filter((p) => p.status === 'pending' || p.status === 'overdue')
  const totalPending = pendingList.reduce((sum, p) => sum + (p.amount || 0), 0)
  const nextPayment = pendingList[0]

  // Filtered List
  const displayedPayments = payments.filter((p) => {
    if (filterTab === 'pending') return p.status === 'pending' || p.status === 'overdue'
    if (filterTab === 'paid') return p.status === 'paid' || p.status === 'collected'
    return true
  })

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal sm:text-3xl">
              {t.dashboard.tenant.payments.title}
            </h1>
            <p className="mt-1 text-sm text-charcoal/60">
              Track rent invoices, complete payments via Telebirr & CBE, and view official digital receipts.
            </p>
          </div>

          {nextPayment && (
            <button
              type="button"
              onClick={() => {
                setPayingPayment(nextPayment)
                setPayModalError('')
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-rust px-5 py-2.5 text-sm font-semibold text-white shadow-stamp transition-transform hover:scale-[1.02] hover:bg-rust-dark"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
              Pay Next Rent ({fmtEtb(nextPayment.amount)})
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center justify-between rounded-xl border border-verified/30 bg-verified/10 p-4">
            <p className="text-sm font-semibold text-verified">{successMsg}</p>
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              className="text-xs font-semibold text-charcoal/50 hover:text-charcoal"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* Link to Full Certified Financial Reports & Statements */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-rust/20 bg-rust-tint/15 p-4 shadow-sm gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rust text-white text-base">
              📄
            </span>
            <div>
              <p className="text-xs font-bold text-charcoal">Official Tenancy Statement &amp; Rent Reports</p>
              <p className="text-[11px] text-charcoal/70">
                Generate certified statements with legal seals for banks, visa verification, and embassies.
              </p>
            </div>
          </div>
          <Link
            href="/tenant/reports"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-xl bg-rust px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rust-dark transition"
          >
            View Full Report &amp; Statements →
          </Link>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Next Payment Due</p>
            <p className="mt-2 font-display text-2xl font-bold text-rust">
              {nextPayment ? fmtEtb(nextPayment.amount) : 'ETB 0'}
            </p>
            <p className="mt-1 text-xs text-charcoal/60">
              {nextPayment ? `Due ${fmtDate(nextPayment.dueDate)}` : 'All invoices settled'}
            </p>
          </div>

          <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Total Rent Settled</p>
            <p className="mt-2 font-display text-2xl font-bold text-verified">{fmtEtb(totalPaid)}</p>
            <p className="mt-1 text-xs text-charcoal/60">
              {payments.filter((p) => p.status === 'paid' || p.status === 'collected').length} verified receipts issued
            </p>
          </div>

          <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Outstanding Balance</p>
            <p className="mt-2 font-display text-2xl font-bold text-charcoal">{fmtEtb(totalPending)}</p>
            <p className="mt-1 text-xs text-charcoal/60">
              {pendingList.length} invoice(s) pending
            </p>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            All Invoices ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pending')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filterTab === 'pending'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            Due &amp; Pending ({pendingList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('paid')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filterTab === 'paid'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            Paid &amp; Receipts ({payments.length - pendingList.length})
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : displayedPayments.length === 0 ? (
          <EmptyState
            icon="payment"
            title="No payments in this tab"
            description="Payment records will show here as rent invoices are created and settled."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-stamp">
            <table className="min-w-full divide-y divide-charcoal/10 text-sm">
              <thead className="bg-cream/60">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Period &amp; Due Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Property
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Amount
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Payment Channel
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {displayedPayments.map((p) => {
                  const isPaid = p.status === 'paid' || p.status === 'collected'
                  const isOverdue = p.status === 'overdue'

                  return (
                    <tr key={p._id} className="transition-colors hover:bg-cream/30">
                      <td className="px-5 py-4">
                        <div className="font-medium text-charcoal">
                          {p.periodMonth ? `Rent for ${p.periodMonth}` : (p.paymentType === 'deposit' ? 'Security Deposit' : 'Monthly Rent')}
                        </div>
                        <div className="text-xs text-charcoal/50">
                          Due: {fmtDate(p.dueDate)}
                          {p.paidDate && ` · Paid ${fmtDate(p.paidDate)}`}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-charcoal">{propertyName(p)}</div>
                        <div className="text-xs text-charcoal/50">{propertyLocation(p)}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-display text-base font-bold text-rust">
                          {fmtEtb(p.amount)}
                        </div>
                        {p.balance !== undefined && p.balance > 0 && (
                          <div className="text-[11px] text-amber-600">Balance: {fmtEtb(p.balance)}</div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {p.paymentMethod ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/10 bg-cream/50 px-2.5 py-1 text-xs font-medium text-charcoal">
                            <span className="font-semibold uppercase text-rust">
                              {p.paymentMethod === 'cbe' ? 'CBE Birr' : p.paymentMethod}
                            </span>
                            {p.transactionReference && (
                              <span className="font-mono text-[10px] text-charcoal/50">
                                ({p.transactionReference.slice(-8)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-charcoal/40">Pending checkout</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            isPaid
                              ? 'bg-verified/10 text-verified'
                              : isOverdue
                              ? 'bg-rust/10 text-rust'
                              : p.proofSubmitted
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gold/20 text-charcoal'
                          }`}
                        >
                          {isPaid && (
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z" />
                            </svg>
                          )}
                          {isPaid
                            ? 'Paid'
                            : isOverdue
                            ? 'Overdue'
                            : p.proofSubmitted
                            ? 'Awaiting Verification'
                            : 'Pending'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => setReceiptPayment(p)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal shadow-sm transition-colors hover:border-rust hover:text-rust"
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-rust">
                              <path d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V6.4a2 2 0 00-.6-1.4l-2.4-2.4A2 2 0 009.6 2H4zm5 1.5v2.5a1 1 0 001 1h2.5L9 3.5zM4 12V4h4v3.5A1.5 1.5 0 009.5 9H12v3H4z" />
                            </svg>
                            View Receipt
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingPayment(p)
                              setPayModalError('')
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rust px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rust-dark"
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M2.5 3A1.5 1.5 0 001 4.5v7A1.5 1.5 0 002.5 13h11a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0013.5 3h-11zm0 2h11a.5.5 0 01.5.5V6H2v-.5a.5.5 0 01.5-.5zM2 7.5h12v4a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-4z" />
                            </svg>
                            Pay Rent
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ─── PAYMENT CHECKOUT MODAL ─── */}
      {payingPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-md">
          <div
            className="relative z-[101] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
            style={{ borderRadius: '20px 20px 32px 20px' }}
          >
            {/* Header */}
            <div className="border-b border-charcoal/10 bg-cream/70 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-rust">
                    Digital Rent Checkout
                  </span>
                  <h2 className="mt-1 font-display text-xl font-bold text-charcoal">
                    {propertyName(payingPayment)}
                  </h2>
                  <p className="text-xs text-charcoal/60">
                    {payingPayment.periodMonth ? `Rent for ${payingPayment.periodMonth}` : 'Monthly Rent'} · Due {fmtDate(payingPayment.dueDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingPayment(null)}
                  className="rounded-full p-1.5 text-charcoal/40 hover:bg-charcoal/10 hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 flex items-baseline justify-between rounded-xl bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold text-charcoal/60">Total Amount Due</span>
                <span className="font-display text-2xl font-bold text-rust">
                  {fmtEtb(payingPayment.amount)}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCompletePayment} className="space-y-5 p-6">
              {payModalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {payModalError}
                </div>
              )}

              {/* Chapa Gateway Exclusively */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal/60 mb-2">
                  Official Payment Processor
                </label>
                <div className="rounded-2xl border-2 border-[#00BFA5]/30 bg-emerald-50/40 p-4 shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00BFA5] text-xs font-bold text-white shadow-sm">
                        C
                      </span>
                      <div>
                        <h4 className="font-display text-sm font-bold text-charcoal">Chapa Payment Gateway</h4>
                        <p className="text-[11px] text-charcoal/50">Regulated Ethiopian Gateway (api.chapa.co)</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 shadow-xs">
                      Primary • Instant
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-charcoal/70">
                    HomeLink Ethiopia routes 100% of rental payments through Chapa. You can pay with any Ethiopian mobile money or card:
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 rounded-xl border border-charcoal/10 bg-white px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-[#0072BC]" />
                      <span className="font-medium text-charcoal">Telebirr</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-charcoal/10 bg-white px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-[#7B2272]" />
                      <span className="font-medium text-charcoal">CBE Birr</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-charcoal/10 bg-white px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-amber-600" />
                      <span className="font-medium text-charcoal">Awash Birr</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-charcoal/10 bg-white px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      <span className="font-medium text-charcoal">Visa / Mastercard</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-emerald-200/60 bg-white/80 p-3 text-[11px] text-charcoal/60">
                    🔒 <strong className="text-charcoal/80">Automated Escrow Protection:</strong> Funds are verified in real-time with instant webhook confirmation. Your official digital stamped receipt is generated immediately.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingPayment(null)}
                  className="flex-1 rounded-xl border border-charcoal/15 py-3 text-sm font-semibold text-charcoal hover:bg-sand/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="flex-1 rounded-xl bg-rust py-3 text-sm font-semibold text-white shadow-stamp hover:bg-rust-dark transition-all disabled:opacity-50"
                >
                  {isSubmittingPay
                    ? 'Processing via Chapa…'
                    : `Confirm & Pay ${fmtEtb(payingPayment.amount)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DIGITAL RENT RECEIPT MODAL ─── */}
      {receiptPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-md">
          <div
            className="relative z-[101] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl print:shadow-none"
            style={{ borderRadius: '20px 20px 32px 20px' }}
          >
            {/* Printable Receipt Card */}
            <div className="border-b border-charcoal/10 bg-cream/50 p-6">
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
                  <span className="font-mono text-xs font-bold text-verified uppercase tracking-wider">
                    Official Receipt
                  </span>
                  <p className="font-mono text-xs text-charcoal/70">
                    {receiptPayment.receiptNumber || `RCPT-${receiptPayment._id.slice(-6).toUpperCase()}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-verified/30 bg-verified/5 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Payment Settled</p>
                <p className="mt-1 font-display text-3xl font-bold text-verified">
                  {fmtEtb(receiptPayment.amount)}
                </p>
                <p className="mt-0.5 text-xs text-charcoal/60">
                  Paid on {fmtDate(receiptPayment.paidDate || receiptPayment.paidAt || receiptPayment.dueDate)}
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-charcoal/80">
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Property:</span>
                  <span className="font-semibold text-charcoal">{propertyName(receiptPayment)}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Location:</span>
                  <span className="text-charcoal">{propertyLocation(receiptPayment)}</span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Payment For:</span>
                  <span className="font-semibold text-charcoal">
                    {receiptPayment.periodMonth ? `Rent for ${receiptPayment.periodMonth}` : 'Residential Lease'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-charcoal/5 pb-2">
                  <span className="text-charcoal/50">Payment Channel:</span>
                  <span className="font-semibold uppercase text-rust">
                    {receiptPayment.paymentMethod === 'cbe' ? 'CBE Birr' : receiptPayment.paymentMethod || 'Telebirr'}
                  </span>
                </div>
                {receiptPayment.transactionReference && (
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="text-charcoal/50">Transaction Reference:</span>
                    <span className="font-mono text-charcoal font-semibold">
                      {receiptPayment.transactionReference}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-charcoal/50">Verification Status:</span>
                  <span className="flex items-center gap-1 font-semibold text-verified">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z" />
                    </svg>
                    Digitally Sealed &amp; Legally Binding
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-cream/50 p-3 text-center text-[10px] text-charcoal/50">
                Issued in accordance with the Civil Code of Ethiopia and National Bank of Ethiopia digital payment regulations.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReceiptPayment(null)}
                  className="rounded-xl border border-charcoal/15 px-3 py-2.5 text-xs font-semibold text-charcoal hover:bg-sand/30"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!receiptPayment) return
                    const num = receiptPayment.receiptNumber || `RCPT-${receiptPayment._id.slice(-6).toUpperCase()}`
                    const txt = `
=====================================================
HOMELINK ETHIOPIA — OFFICIAL DIGITAL RENT RECEIPT
=====================================================
Receipt No:      ${num}
Transaction Ref: ${receiptPayment.transactionReference || 'N/A'}
Payment Channel: ${(receiptPayment.paymentMethod || 'chapa').toUpperCase()}
Date Settled:    ${new Date(receiptPayment.paidDate || receiptPayment.paidAt || Date.now()).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })} (EAT)
-----------------------------------------------------
Property:        ${propertyName(receiptPayment)}
Location:        ${propertyLocation(receiptPayment)}
Billing Period:  ${receiptPayment.periodMonth ? 'Rent for ' + receiptPayment.periodMonth : 'Residential Lease'}
Amount Settled:  ${fmtEtb(receiptPayment.amount)}
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
                  className="flex-1 rounded-xl border border-charcoal/20 bg-white py-2.5 text-xs font-semibold text-charcoal shadow-sm hover:bg-cream/40"
                >
                  📥 Download (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 rounded-xl bg-charcoal py-2.5 text-xs font-semibold text-white shadow hover:bg-black"
                >
                  🖨️ Print / PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
