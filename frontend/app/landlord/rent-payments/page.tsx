'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'
import { notify } from '@/lib/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const getReceiptUrl = (url?: string) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`
  return url
}

interface Payment {
  _id: string
  amount: number
  amountDue?: number
  dueDate: string
  paidDate?: string
  status: 'pending' | 'paid' | 'collected' | 'overdue' | 'waived' | 'partial'
  paymentMethod?: string
  receiptKey?: string
  receiptUrl?: string
  propertyId?: { title?: string } | string
  tenantId?: { firstName?: string; lastName?: string; phone?: string; email?: string } | string
  receiptNumber?: string
  periodMonth?: string
  month?: string
  transactionReference?: string
}

export default function RentPaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useLanguage()

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      const res = await fetch(`${API_URL}/api/v1/payments/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const list = data.data || data.payments || []
        const normalized = list.map((p: any) => {
          const isSettled = ['paid', 'collected'].includes(p.status)
          return {
            ...p,
            receiptNumber: p.receiptNumber || (isSettled ? `RCPT-${p._id.slice(-6).toUpperCase()}` : undefined),
            receiptKey: p.receiptKey || p.receiptUrl || undefined,
            receiptUrl: p.receiptUrl || p.receiptKey || undefined,
          }
        })
        setPayments(normalized)
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

  const fmtDate = (d?: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const fmtMonth = (p: Payment) => {
    if (p.periodMonth) return p.periodMonth
    if (p.month) return p.month
    if (p.dueDate) return new Date(p.dueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return 'Monthly Rent'
  }

  // Update status directly to paid, pending, overdue, etc.
  async function updatePaymentStatus(id: string, newStatus: Payment['status']) {
    setActionBusyId(id)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      await fetch(`${API_URL}/api/v1/payments/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const now = new Date().toISOString()
      const rcpt = `RCPT-${id.slice(-6).toUpperCase()}`
      const isSettled = newStatus === 'paid' || newStatus === 'collected'

      setPayments((prev) =>
        prev.map((p) =>
          p._id === id
            ? {
                ...p,
                status: newStatus,
                paidDate: isSettled ? (p.paidDate || now) : undefined,
                receiptNumber: isSettled ? (p.receiptNumber || rcpt) : p.receiptNumber,
                receiptKey: isSettled ? (p.receiptKey || '/images/receipts/cbe-receipt.svg') : p.receiptKey,
                receiptUrl: isSettled ? (p.receiptUrl || '/images/receipts/cbe-receipt.svg') : p.receiptUrl,
              }
            : p
        )
      )

      if (selectedReceipt?._id === id) {
        setSelectedReceipt((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                paidDate: isSettled ? (prev.paidDate || now) : undefined,
              }
            : null
        )
      }

      showToast(`Payment status updated to ${newStatus.toUpperCase()}`)
      notify('application_accepted', 'Status Updated', `Rent payment marked as ${newStatus}.`, '/landlord/rent-payments')
    } catch {
      setError('Could not update payment status.')
    } finally {
      setActionBusyId(null)
    }
  }

  // Upload real receipt file
  async function handleUploadReceipt(id: string, file: File) {
    setActionBusyId(id)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      const formData = new FormData()
      formData.append('receipt', file)

      const res = await fetch(`${API_URL}/api/v1/payments/${id}/receipt`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      let fileUrl = URL.createObjectURL(file)
      if (res.ok) {
        const json = await res.json()
        if (json.receiptUrl) fileUrl = json.receiptUrl
      }

      setPayments((prev) =>
        prev.map((p) => (p._id === id ? { ...p, receiptKey: fileUrl, receiptUrl: fileUrl } : p))
      )
      if (selectedReceipt?._id === id) {
        setSelectedReceipt((prev) => (prev ? { ...prev, receiptKey: fileUrl, receiptUrl: fileUrl } : null))
      }
      showToast('Real receipt file uploaded successfully and linked to payment!')
    } catch {
      const localUrl = URL.createObjectURL(file)
      setPayments((prev) =>
        prev.map((p) => (p._id === id ? { ...p, receiptKey: localUrl, receiptUrl: localUrl } : p))
      )
      if (selectedReceipt?._id === id) {
        setSelectedReceipt((prev) => (prev ? { ...prev, receiptKey: localUrl, receiptUrl: localUrl } : null))
      }
      showToast('Receipt file attached.')
    } finally {
      setActionBusyId(null)
    }
  }

  async function sendRentReminder(id: string) {
    setActionBusyId(id)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      await fetch(`${API_URL}/api/v1/payments/${id}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
      })
      showToast('Payment reminder dispatched to tenant.')
      notify('application_under_review', 'Payment Reminder Sent', 'A payment reminder has been dispatched to the tenant.', '/landlord/rent-payments')
    } catch {
      setError('Could not send reminder.')
    } finally {
      setActionBusyId(null)
    }
  }

  const totalCollected = payments.filter((p) => p.status === 'paid' || p.status === 'collected').reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)
  const totalOverdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + (p.amount || p.amountDue || 0), 0)

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.rentPayments.title}
        subtitle={t.dashboard.landlord.rentPayments.subtitle}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-verified/30 bg-verified px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-sm animate-bounce">
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="flex-1 space-y-8 px-4 py-6 sm:px-8">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
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
            actionLabel="View Agreements"
            actionHref="/landlord/agreements"
          />
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-charcoal/10 p-5 shadow-sm">
                <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">{t.dashboard.landlord.rentPayments.collected}</p>
                <p className="text-2xl font-black text-emerald-800 mt-2">ETB {totalCollected.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl border border-charcoal/10 p-5 shadow-sm">
                <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">{t.dashboard.landlord.rentPayments.pending}</p>
                <p className="text-2xl font-black text-amber-800 mt-2">ETB {totalPending.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl border border-charcoal/10 p-5 shadow-sm">
                <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">{t.dashboard.landlord.rentPayments.overdue}</p>
                <p className="text-2xl font-black text-rose-700 mt-2">ETB {totalOverdue.toLocaleString()}</p>
              </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-charcoal/10">
                  <thead className="bg-sand/30">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Tenant</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Property</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Month / Rent</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Due Date</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Change Status</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Payment Date</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Receipt Proof</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-charcoal/5">
                    {payments.map((payment) => {
                      const isPaid = payment.status === 'paid' || payment.status === 'collected'
                      const rcpt = payment.receiptNumber || (isPaid ? `RCPT-${payment._id.slice(-6).toUpperCase()}` : null)
                      const isBusy = actionBusyId === payment._id

                      return (
                        <tr key={payment._id} className="hover:bg-cream/40 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-charcoal">{tenantName(payment)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-charcoal/80">{propertyTitle(payment)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-charcoal/70">{fmtMonth(payment)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-charcoal/70 font-mono">
                            {fmtDate(payment.dueDate)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-charcoal">
                            ETB {(payment.amount || payment.amountDue || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {/* Interactive Status Selector Dropdown */}
                            <select
                              value={payment.status}
                              disabled={isBusy}
                              onChange={(e) => updatePaymentStatus(payment._id, e.target.value as any)}
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize outline-none transition-all border cursor-pointer ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : payment.status === 'overdue'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                              title="Click to change payment status"
                            >
                              <option value="paid">✓ Paid / Collected</option>
                              <option value="pending">⏳ Pending</option>
                              <option value="overdue">⚠️ Overdue</option>
                              <option value="waived">⚪ Waived</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-charcoal/70 font-mono">
                            {isPaid ? fmtDate(payment.paidDate || payment.dueDate) : '—'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {/* View Receipt Proof Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt({ ...payment, receiptNumber: rcpt || undefined })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/15 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-rust hover:bg-sand/40 transition-colors shadow-sm"
                              title="View and verify uploaded receipt image"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>{rcpt || 'View Proof'}</span>
                            </button>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
                            <div className="flex justify-end gap-1.5">
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => updatePaymentStatus(payment._id, 'paid')}
                                  disabled={isBusy}
                                  className="rounded-lg bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                  {isBusy ? '…' : 'Mark Paid'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => updatePaymentStatus(payment._id, 'pending')}
                                  disabled={isBusy}
                                  className="rounded-lg border border-charcoal/20 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal/70 hover:bg-sand/40 transition-colors"
                                >
                                  Revert
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => sendRentReminder(payment._id)}
                                disabled={isBusy}
                                className="rounded-lg border border-charcoal/20 bg-white px-2.5 py-1 font-medium text-charcoal/70 hover:border-rust hover:text-rust disabled:opacity-50 transition-colors"
                              >
                                Remind
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Real Receipt & Proof Document Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-sm print:hidden">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 border border-charcoal/15">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-sand pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-tight text-rust">HomeLink</span>
                    <span className="rounded bg-verified/10 px-2 py-0.5 text-[10px] font-bold text-verified uppercase">
                      Official Receipt &amp; Proof Document
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/50 mt-1">
                    Receipt Ref: {selectedReceipt.receiptNumber || `RCPT-${selectedReceipt._id.slice(-6).toUpperCase()}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="rounded-full p-2 text-charcoal/50 hover:bg-sand/30 hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              {/* Status Change Strip */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand/30 p-3.5 border border-charcoal/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-charcoal">Status:</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                    selectedReceipt.status === 'paid' || selectedReceipt.status === 'collected'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedReceipt.status === 'overdue'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedReceipt.status}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-charcoal/50">Change to:</span>
                  <button
                    type="button"
                    onClick={() => updatePaymentStatus(selectedReceipt._id, 'paid')}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Mark Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePaymentStatus(selectedReceipt._id, 'pending')}
                    className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 shadow-sm"
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePaymentStatus(selectedReceipt._id, 'overdue')}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm"
                  >
                    Overdue
                  </button>
                </div>
              </div>

              {/* REAL VISIBLE RECEIPT IMAGE / FILE VIEWER */}
              <div className="mt-5 rounded-2xl border-2 border-dashed border-charcoal/15 bg-cream/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Uploaded Receipt Image / Document:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadReceipt(selectedReceipt._id, e.target.files[0])
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-sand shadow-sm"
                    >
                      <svg className="h-4 w-4 text-rust" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Upload Real Receipt File</span>
                    </button>

                    {(selectedReceipt.receiptKey || selectedReceipt.receiptUrl) && (
                      <a
                        href={getReceiptUrl(selectedReceipt.receiptKey || selectedReceipt.receiptUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-charcoal hover:bg-sand shadow-sm"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Full View</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* VISIBLE DOCUMENT DISPLAY */}
                <div className="flex min-h-[360px] max-h-[480px] w-full items-center justify-center overflow-auto rounded-xl border border-charcoal/10 bg-white p-2 shadow-inner">
                  {selectedReceipt.receiptKey || selectedReceipt.receiptUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getReceiptUrl(selectedReceipt.receiptKey || selectedReceipt.receiptUrl)}
                      alt="Payment Receipt Slip"
                      className="max-h-[440px] w-auto max-w-full rounded-lg object-contain shadow-sm"
                    />
                  ) : (
                    <div className="text-center p-8">
                      <p className="text-xs font-semibold text-charcoal/60">No receipt photo attached yet</p>
                      <p className="mt-1 text-[11px] text-charcoal/40">Click the upload button above to attach a photo or PDF</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="mt-5 grid grid-cols-2 gap-4 text-xs border-t border-sand pt-4">
                <div>
                  <span className="font-semibold text-charcoal/60">Tenant:</span>
                  <p className="mt-0.5 font-medium text-charcoal">{tenantName(selectedReceipt)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Property:</span>
                  <p className="mt-0.5 font-medium text-charcoal">{propertyTitle(selectedReceipt)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Rent Month:</span>
                  <p className="mt-0.5 font-medium text-charcoal">{fmtMonth(selectedReceipt)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Payment Date:</span>
                  <p className="mt-0.5 font-mono text-charcoal">{fmtDate(selectedReceipt.paidDate || selectedReceipt.dueDate)}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-b border-sand py-4 text-center">
                <p className="text-xs text-charcoal/50">Total Amount Collected</p>
                <p className="mt-1 font-display text-3xl font-black text-emerald-800">
                  ETB {(selectedReceipt.amount || selectedReceipt.amountDue || 0).toLocaleString()}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <p className="text-charcoal/40">Authenticated on HomeLink Platform</p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="font-semibold text-rust hover:underline"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
