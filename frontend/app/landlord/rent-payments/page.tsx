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
  amountDue?: number
  amountPaid?: number
  balance?: number
  dueDate: string
  paidDate?: string
  paidAt?: string
  periodMonth?: string
  paymentType?: 'rent' | 'deposit'
  paymentMethod?: string
  transactionReference?: string
  receiptNumber?: string
  receiptUrl?: string
  receiptKey?: string
  notes?: string
  status: 'pending' | 'paid' | 'collected' | 'overdue'
  proofSubmitted?: boolean
  propertyId?: { _id?: string; title?: string } | string
  tenantId?: { _id?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | string
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

export default function RentPaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [inspectReceipt, setInspectReceipt] = useState<Payment | null>(null)
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
        const list: Payment[] = Array.isArray(data) ? data : (data.data || data.payments || [])
        setPayments(list)
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

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const tenantName = (p: Payment) =>
    typeof p.tenantId === 'object'
      ? `${p.tenantId?.firstName || ''} ${p.tenantId?.lastName || ''}`.trim() || p.tenantId?.email || 'Tenant'
      : 'Tenant'

  const tenantContact = (p: Payment) =>
    typeof p.tenantId === 'object' ? p.tenantId?.phone || p.tenantId?.email || '' : ''

  const propertyTitle = (p: Payment) =>
    typeof p.propertyId === 'object' ? p.propertyId?.title : 'Rental Property'

  // Landlord action: Verify payment (approve proof or manual settlement)
  async function handleVerifyPayment(paymentId: string) {
    setBusyId(paymentId)
    setError('')
    setNotice('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/payments/${paymentId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'paid' }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPayments((prev) =>
          prev.map((p) =>
            p._id === paymentId
              ? {
                  ...p,
                  status: 'paid',
                  paidDate: new Date().toISOString(),
                  receiptNumber: p.receiptNumber || `RCPT-${paymentId.slice(-6).toUpperCase()}`,
                }
              : p
          )
        )
        setNotice('Payment verified and officially recorded! Tenant receipt generated.')
      } else {
        setError(data.message || 'Could not verify payment.')
      }
    } catch {
      setError('Network error while verifying payment.')
    } finally {
      setBusyId(null)
    }
  }

  // Landlord action: Send payment reminder
  async function handleSendReminder(paymentId: string) {
    setBusyId(paymentId)
    setError('')
    setNotice('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/payments/${paymentId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setNotice('Payment reminder notification dispatched to the tenant.')
      } else {
        setError(data.message || 'Could not send reminder.')
      }
    } catch {
      setError('Network error while sending reminder.')
    } finally {
      setBusyId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'collected':
        return 'bg-verified/10 text-verified'
      case 'pending':
        return 'bg-gold/20 text-charcoal'
      case 'overdue':
        return 'bg-rust/10 text-rust'
      default:
        return 'bg-sand text-charcoal'
    }
  }

  const totalCollected = payments
    .filter((p) => p.status === 'paid' || p.status === 'collected')
    .reduce((s, p) => s + (p.amount || 0), 0)
  const totalPending = payments
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + (p.amount || 0), 0)
  const totalOverdue = payments
    .filter((p) => p.status === 'overdue')
    .reduce((s, p) => s + (p.amount || 0), 0)

  const filteredPayments = payments.filter((p) => {
    if (activeTab === 'pending') return p.status === 'pending'
    if (activeTab === 'paid') return p.status === 'paid' || p.status === 'collected'
    if (activeTab === 'overdue') return p.status === 'overdue'
    return true
  })

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.rentPayments.title}
        subtitle="Track rent obligations, verify tenant payments, and inspect official receipts."
      />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">{error}</p>
          </div>
        )}

        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-verified/30 bg-verified/10 p-4">
            <p className="text-sm font-semibold text-verified">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-xs font-semibold text-charcoal/50 hover:text-charcoal"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">
              {t.dashboard.landlord.rentPayments.collected}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-verified">
              {fmtEtb(totalCollected)}
            </p>
            <p className="mt-1 text-xs text-charcoal/60">
              {payments.filter((p) => p.status === 'paid' || p.status === 'collected').length} rent records verified
            </p>
          </div>

          <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">
              {t.dashboard.landlord.rentPayments.pending}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-gold">
              {fmtEtb(totalPending)}
            </p>
            <p className="mt-1 text-xs text-charcoal/60">
              {payments.filter((p) => p.status === 'pending').length} payments awaiting settlement
            </p>
          </div>

          <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">
              {t.dashboard.landlord.rentPayments.overdue}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-rust">
              {fmtEtb(totalOverdue)}
            </p>
            <p className="mt-1 text-xs text-charcoal/60">
              {payments.filter((p) => p.status === 'overdue').length} overdue invoice(s)
            </p>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            All Invoices ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            Pending ({payments.filter((p) => p.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'overdue'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            Overdue ({payments.filter((p) => p.status === 'overdue').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paid')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'paid'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
            }`}
          >
            Collected &amp; Receipts ({payments.filter((p) => p.status === 'paid' || p.status === 'collected').length})
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            icon="payment"
            title="No rent payments in this view"
            description="Payment records for your rented properties will appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-stamp">
            <table className="min-w-full divide-y divide-charcoal/10 text-sm">
              <thead className="bg-cream/60">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Tenant
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Property
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Due Date &amp; Period
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Amount
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
                {filteredPayments.map((p) => {
                  const isBusy = busyId === p._id
                  const isPaid = p.status === 'paid' || p.status === 'collected'

                  return (
                    <tr key={p._id} className="transition-colors hover:bg-cream/30">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-charcoal">{tenantName(p)}</div>
                        <div className="text-xs text-charcoal/50">{tenantContact(p)}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-charcoal">{propertyTitle(p)}</div>
                        {p.paymentMethod && (
                          <div className="mt-0.5 text-xs text-charcoal/50 uppercase">
                            Via {p.paymentMethod === 'cbe' ? 'CBE Birr' : p.paymentMethod}
                            {p.transactionReference && ` · ${p.transactionReference.slice(-6)}`}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-charcoal">{fmtDate(p.dueDate)}</div>
                        <div className="text-xs text-charcoal/50">
                          {p.periodMonth ? `Period: ${p.periodMonth}` : (p.paymentType === 'deposit' ? 'Security Deposit' : 'Monthly Rent')}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-display text-base font-bold text-rust">{fmtEtb(p.amount)}</div>
                        {isPaid && p.paidDate && (
                          <div className="text-[11px] text-verified">Paid {fmtDate(p.paidDate)}</div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(
                            p.status
                          )}`}
                        >
                          {isPaid ? 'Paid' : p.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </span>
                        {p.proofSubmitted && !isPaid && (
                          <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            Proof uploaded
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isPaid ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleVerifyPayment(p._id)}
                                className="rounded-lg bg-verified px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-verified-dark disabled:opacity-50"
                              >
                                {isBusy ? '…' : 'Verify & Confirm'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSendReminder(p._id)}
                                className="rounded-lg border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust disabled:opacity-50"
                              >
                                {isBusy ? '…' : 'Remind'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInspectReceipt(p)}
                              className="rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal shadow-sm transition-colors hover:border-rust hover:text-rust"
                            >
                              View Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ─── DIGITAL RECEIPT MODAL ─── */}
      {inspectReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl print:shadow-none"
            style={{ borderRadius: '20px 20px 32px 20px' }}
          >
            <div className="border-b border-charcoal/10 bg-cream/60 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-verified uppercase tracking-wider">
                    Official Landlord Receipt Copy
                  </span>
                  <h3 className="mt-1 font-display text-lg font-bold text-charcoal">
                    {propertyTitle(inspectReceipt)}
                  </h3>
                  <p className="font-mono text-xs text-charcoal/60">
                    {inspectReceipt.receiptNumber || `RCPT-${inspectReceipt._id.slice(-6).toUpperCase()}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectReceipt(null)}
                  className="rounded-full p-1.5 text-charcoal/40 hover:bg-charcoal/10"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 p-6 text-xs text-charcoal/80">
              <div className="rounded-xl border border-verified/30 bg-verified/5 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Amount Collected</p>
                <p className="mt-1 font-display text-3xl font-bold text-verified">
                  {fmtEtb(inspectReceipt.amount)}
                </p>
                <p className="mt-0.5 text-xs text-charcoal/60">
                  Settled {fmtDate(inspectReceipt.paidDate || inspectReceipt.paidAt || inspectReceipt.dueDate)}
                </p>
              </div>

              <div className="space-y-2 border-y border-charcoal/10 py-3">
                <div className="flex justify-between">
                  <span className="text-charcoal/50">Tenant:</span>
                  <span className="font-semibold text-charcoal">{tenantName(inspectReceipt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/50">Period:</span>
                  <span className="text-charcoal">{inspectReceipt.periodMonth || 'Monthly Rent'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/50">Channel:</span>
                  <span className="font-semibold uppercase text-rust">
                    {inspectReceipt.paymentMethod === 'cbe' ? 'CBE Birr' : inspectReceipt.paymentMethod || 'Telebirr'}
                  </span>
                </div>
                {inspectReceipt.transactionReference && (
                  <div className="flex justify-between">
                    <span className="text-charcoal/50">Transaction Ref:</span>
                    <span className="font-mono font-semibold text-charcoal">{inspectReceipt.transactionReference}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectReceipt(null)}
                  className="rounded-xl border border-charcoal/15 px-3 py-2.5 text-xs font-semibold text-charcoal hover:bg-sand/30"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!inspectReceipt) return
                    const num = inspectReceipt.receiptNumber || `RCPT-${inspectReceipt._id.slice(-6).toUpperCase()}`
                    const txt = `
=====================================================
HOMELINK ETHIOPIA — LANDLORD RENT COLLECTION RECEIPT
=====================================================
Receipt No:      ${num}
Transaction Ref: ${inspectReceipt.transactionReference || 'N/A'}
Tenant:          ${tenantName(inspectReceipt)}
Payment Channel: ${(inspectReceipt.paymentMethod || 'chapa').toUpperCase()}
Date Settled:    ${new Date(inspectReceipt.paidDate || inspectReceipt.paidAt || Date.now()).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })} (EAT)
-----------------------------------------------------
Property:        ${propertyTitle(inspectReceipt)}
Period:          ${inspectReceipt.periodMonth || 'Monthly Rent'}
Amount Collected:${fmtEtb(inspectReceipt.amount)}
Settlement:      CLEARED & CREDITED TO ESCROW / ACCOUNT
-----------------------------------------------------
Landlord Copy — HomeLink Digital Housing Record
=====================================================
`.trim()
                    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `Landlord-${num}.txt`
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
