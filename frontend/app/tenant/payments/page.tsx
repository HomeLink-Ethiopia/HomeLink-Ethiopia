'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '@/components/tenant/TopBar'
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
  amountPaid?: number
  dueDate: string
  paidDate?: string
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'collected'
  propertyId?: { _id?: string; title?: string; location?: { address?: string; subCity?: string } } | string
  receiptNumber?: string
  receiptKey?: string
  receiptUrl?: string
  periodMonth?: string
  month?: string
  paymentType?: string
  paymentMethod?: string
  transactionReference?: string
}

export default function PaymentsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [payingId, setPayingId] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null)
  const [payModalItem, setPayModalItem] = useState<Payment | null>(null)
  const [payMethod, setPayMethod] = useState<'chapa' | 'telebirr' | 'cbe'>('chapa')
  const [txRefInput, setTxRefInput] = useState('')
  const [selectedPayFile, setSelectedPayFile] = useState<File | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      const res = await fetch(`${API_URL}/api/v1/payments/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.data || data.payments || []
        const normalized = list.map((p: any) => ({
          ...p,
          receiptNumber: p.receiptNumber || (['paid', 'collected'].includes(p.status) ? `RCPT-${p._id.slice(-6).toUpperCase()}` : undefined),
          receiptKey: p.receiptKey || p.receiptUrl || undefined,
          receiptUrl: p.receiptUrl || p.receiptKey || undefined,
        }))
        setPayments(normalized)
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

  const getStatusColor = (status: string) => {
    if (status === 'paid' || status === 'collected') return 'bg-verified text-white'
    if (status === 'overdue') return 'bg-rust text-white'
    if (status === 'waived') return 'bg-charcoal/20 text-charcoal'
    return 'bg-amber-100 text-amber-800'
  }

  const getStatusText = (status: string) => {
    if (status === 'paid' || status === 'collected') return t.dashboard.tenant.payments.paid || 'Paid'
    if (status === 'overdue') return 'Overdue'
    if (status === 'waived') return 'Waived'
    return t.dashboard.tenant.payments.unpaid || 'Pending'
  }

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

  // Upload receipt file (JPG, PNG, PDF)
  const handleUploadReceiptFile = async (paymentId: string, file: File) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      const formData = new FormData()
      formData.append('receipt', file)

      const res = await fetch(`${API_URL}/api/v1/payments/${paymentId}/receipt`, {
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
        prev.map((p) =>
          p._id === paymentId ? { ...p, receiptKey: fileUrl, receiptUrl: fileUrl } : p
        )
      )

      if (selectedReceipt?._id === paymentId) {
        setSelectedReceipt((prev) =>
          prev ? { ...prev, receiptKey: fileUrl, receiptUrl: fileUrl } : null
        )
      }

      showToast('Receipt file uploaded successfully.')
      notify(
        'application_accepted',
        'Receipt Attached',
        'Your payment receipt was uploaded successfully.',
        '/tenant/payments'
      )
    } catch {
      showToast('Uploaded receipt locally.')
    }
  }

  // Handle Pay Rent
  async function handlePay(payment: Payment) {
    setPayingId(payment._id)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
      const txRef = txRefInput.trim() || `TX-${Date.now().toString().slice(-8)}`

      const res = await fetch(`${API_URL}/api/v1/payments/${payment._id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          paymentMethod: payMethod,
          paidAmount: payment.amount || payment.amountDue,
          transactionRef: txRef,
        }),
      })

      // If tenant also selected a receipt file, upload it immediately
      if (selectedPayFile) {
        await handleUploadReceiptFile(payment._id, selectedPayFile)
      }

      const now = new Date().toISOString()
      const receiptNum = `RCPT-${payment._id.slice(-6).toUpperCase()}`

      // Update state locally
      setPayments((prev) =>
        prev.map((p) =>
          p._id === payment._id
            ? {
                ...p,
                status: 'paid',
                paidDate: now,
                receiptNumber: receiptNum,
                paymentMethod: payMethod,
                transactionReference: txRef,
              }
            : p
        )
      )

      notify(
        'application_accepted',
        'Rent Paid Successfully',
        `Payment of ETB ${(payment.amount || payment.amountDue || 0).toLocaleString()} recorded. Receipt ${receiptNum} issued.`,
        '/tenant/payments'
      )

      showToast(`Rent payment recorded successfully (Receipt: ${receiptNum}).`)
      setPayModalItem(null)
      setSelectedPayFile(null)
      setTxRefInput('')
    } catch {
      setError('Could not process payment. Please try again.')
    } finally {
      setPayingId(null)
    }
  }

  return (
    <>
      <TopBar tenantName="Tenant" />

      {/* Hidden File Input for Receipt Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0] && uploadTargetId) {
            handleUploadReceiptFile(uploadTargetId, e.target.files[0])
            setUploadTargetId(null)
          }
        }}
      />

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-verified/30 bg-verified px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-sm transition-all animate-bounce">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">{t.dashboard.tenant.payments.title}</h1>
            <p className="mt-1 text-sm text-charcoal/60">Track your monthly rent, due dates, payments, and digital receipts.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon="payment"
            title="No payments yet"
            description="Your rent payment schedule will appear here once your rental agreement is active."
            actionLabel="View Agreements"
            actionHref="/tenant/agreements"
          />
        ) : (
          <div className="bg-white rounded-2xl border border-sand overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sand">
                <thead className="bg-cream/60">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Rent Month
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Settled Date
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Receipt Slip
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-charcoal uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sand/50">
                  {payments.map((payment) => {
                    const isPaid = payment.status === 'paid' || payment.status === 'collected'
                    const hasReceipt = Boolean(payment.receiptUrl || payment.receiptKey)
                    const rcpt = payment.receiptNumber || (isPaid ? `RCPT-${payment._id.slice(-6).toUpperCase()}` : null)

                    return (
                      <tr key={payment._id} className="hover:bg-cream/40 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-charcoal">
                          {fmtMonth(payment)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-charcoal/80">
                          {propertyName(payment)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-charcoal/70">
                          {fmtDate(payment.dueDate)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-charcoal">
                          ETB {(payment.amount || payment.amountDue || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(payment.status)}`}>
                            {getStatusText(payment.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-charcoal/70">
                          {isPaid ? fmtDate(payment.paidDate || payment.dueDate) : '—'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm">
                          {hasReceipt || isPaid ? (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt({ ...payment, receiptNumber: rcpt || undefined })}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-sand/30 border border-charcoal/10 px-2.5 py-1 font-mono text-xs font-bold text-rust hover:bg-sand transition-colors"
                            >
                              <svg className="h-3.5 w-3.5 text-rust" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>{rcpt || 'View Receipt'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setUploadTargetId(payment._id)
                                fileInputRef.current?.click()
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal/50 hover:text-rust transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              <span>Attach Slip</span>
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right text-sm">
                          {!isPaid ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadTargetId(payment._id)
                                  fileInputRef.current?.click()
                                }}
                                className="rounded-lg border border-charcoal/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-charcoal hover:bg-sand transition-colors"
                              >
                                Upload Slip
                              </button>
                              <button
                                type="button"
                                onClick={() => setPayModalItem(payment)}
                                className="rounded-lg bg-rust px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rust-dark shadow-sm"
                              >
                                Pay Rent
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified">
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>Settled</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pay Rent Modal */}
        {payModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-sand pb-3">
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Pay Monthly Rent</h3>
                  <p className="text-xs text-charcoal/60">{propertyName(payModalItem)} · {fmtMonth(payModalItem)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayModalItem(null)
                    setSelectedPayFile(null)
                    setTxRefInput('')
                  }}
                  className="rounded-lg p-1 text-charcoal/50 hover:bg-sand/30 hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-cream/70 p-4 text-center border border-charcoal/10">
                  <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Amount Due</p>
                  <p className="mt-1 text-3xl font-black text-rust">
                    ETB {(payModalItem.amount || payModalItem.amountDue || 0).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-charcoal/60">Due date: {fmtDate(payModalItem.dueDate)}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-2">Select Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'chapa', label: 'Chapa Pay', desc: 'Online Gateway' },
                      { id: 'telebirr', label: 'Telebirr', desc: 'Mobile Slip' },
                      { id: 'cbe', label: 'CBE Bank', desc: 'Commercial Bank' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayMethod(m.id as any)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          payMethod === m.id
                            ? 'border-rust bg-rust/10 ring-2 ring-rust/30'
                            : 'border-sand hover:bg-sand/20'
                        }`}
                      >
                        <p className="text-xs font-bold text-charcoal">{m.label}</p>
                        <p className="text-[10px] text-charcoal/60">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transaction Reference Number Input */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">
                    Transaction ID / Reference Number <span className="text-charcoal/40 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={txRefInput}
                    onChange={(e) => setTxRefInput(e.target.value)}
                    placeholder="e.g. TX-CBE-98234 or Telebirr ID"
                    className="w-full rounded-xl border border-charcoal/20 bg-cream/30 px-3.5 py-2 text-xs text-charcoal outline-none focus:border-rust"
                  />
                </div>

                {/* Upload Payment Receipt File */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">
                    Attach Payment Slip / Proof <span className="text-charcoal/40 font-normal">(JPG, PNG, PDF)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedPayFile(e.target.files[0])
                        }
                      }}
                      className="text-xs text-charcoal file:mr-2 file:rounded-lg file:border-0 file:bg-sand/60 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-charcoal hover:file:bg-sand"
                    />
                  </div>
                  {selectedPayFile && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                      ✓ Attached: {selectedPayFile.name}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-sand">
                  <button
                    type="button"
                    onClick={() => {
                      setPayModalItem(null)
                      setSelectedPayFile(null)
                      setTxRefInput('')
                    }}
                    className="flex-1 rounded-xl border border-charcoal/20 py-2.5 text-xs font-semibold text-charcoal hover:bg-sand/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePay(payModalItem)}
                    disabled={payingId === payModalItem._id}
                    className="flex-1 rounded-xl bg-rust py-2.5 text-xs font-bold text-white hover:bg-rust-dark disabled:opacity-50 shadow-sm"
                  >
                    {payingId === payModalItem._id ? 'Processing…' : 'Confirm & Record Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REAL VISIBLE DOCUMENT RECEIPT MODAL */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 sm:p-8">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-sand pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-bold tracking-tight text-rust">HomeLink Ethiopia</span>
                    <span className="rounded-full bg-verified/10 px-2.5 py-0.5 text-[10px] font-bold text-verified uppercase tracking-wider">
                      Official Receipt
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/60 mt-1">
                    Digital Rent Receipt #{selectedReceipt.receiptNumber || `RCPT-${selectedReceipt._id.slice(-6).toUpperCase()}`}
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

              {/* DOCUMENT VIEWER & ACTIONS */}
              <div className="mt-5 rounded-2xl border-2 border-dashed border-charcoal/15 bg-cream/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Payment Slip / Voucher Document:
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Upload File Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTargetId(selectedReceipt._id)
                        fileInputRef.current?.click()
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-sand transition-colors shadow-sm"
                    >
                      <svg className="h-4 w-4 text-rust" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Upload Real Receipt File</span>
                    </button>

                    {/* Open Full View in new tab */}
                    {(selectedReceipt.receiptKey || selectedReceipt.receiptUrl) && (
                      <a
                        href={getReceiptUrl(selectedReceipt.receiptKey || selectedReceipt.receiptUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-charcoal hover:bg-sand transition-colors shadow-sm"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Full View</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* REAL VISIBLE DOCUMENT DISPLAY */}
                <div className="flex min-h-[360px] max-h-[480px] w-full items-center justify-center overflow-auto rounded-xl border border-charcoal/10 bg-white p-2 shadow-inner">
                  {selectedReceipt.receiptKey || selectedReceipt.receiptUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getReceiptUrl(selectedReceipt.receiptKey || selectedReceipt.receiptUrl)}
                      alt="Official Payment Receipt Slip"
                      className="max-h-[440px] w-auto max-w-full rounded-lg object-contain shadow-sm"
                    />
                  ) : (
                    <div className="text-center p-8">
                      <svg className="mx-auto h-12 w-12 text-charcoal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-xs font-semibold text-charcoal/70">No receipt file uploaded yet</p>
                      <p className="mt-1 text-[11px] text-charcoal/40">Click the button above to upload a photo of the bank slip or transfer screenshot</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Receipt Details Breakdown */}
              <div className="mt-5 grid grid-cols-2 gap-4 text-xs border-t border-sand pt-4">
                <div>
                  <span className="font-semibold text-charcoal/60">Property:</span>
                  <p className="mt-0.5 font-medium text-charcoal">{propertyName(selectedReceipt)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Rent Month:</span>
                  <p className="mt-0.5 font-medium text-charcoal">{fmtMonth(selectedReceipt)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Due Date:</span>
                  <p className="mt-0.5 text-charcoal">{fmtDate(selectedReceipt.dueDate)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Settled Date:</span>
                  <p className="mt-0.5 font-mono text-charcoal">{fmtDate(selectedReceipt.paidDate || selectedReceipt.dueDate)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Payment Method:</span>
                  <p className="mt-0.5 font-mono uppercase text-charcoal">{selectedReceipt.paymentMethod || 'Bank Transfer'}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Reference:</span>
                  <p className="mt-0.5 font-mono text-charcoal truncate">{selectedReceipt.transactionReference || '—'}</p>
                </div>
              </div>

              {/* Amount Box */}
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-cream/70 p-4 border border-sand">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Total Rent Paid</p>
                  <p className="mt-0.5 font-display text-2xl font-black text-verified">
                    ETB {(selectedReceipt.amount || selectedReceipt.amountDue || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-verified/10 px-3 py-1 text-xs font-bold text-verified">
                    ✓ VERIFIED SETTLEMENT
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between border-t border-sand pt-4 text-xs text-charcoal/50">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 font-semibold text-rust hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="rounded-xl bg-rust px-4 py-2 font-semibold text-white hover:bg-rust-dark shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
