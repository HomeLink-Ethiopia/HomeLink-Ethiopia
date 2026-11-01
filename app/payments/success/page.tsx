'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ReceiptData {
  _id: string
  receiptNumber?: string
  amountPaid?: number
  amountDue?: number
  periodMonth?: string
  paidAt?: string
  paymentMethod?: string
  propertyId?: { title?: string; address?: string }
  tenantId?: { firstName?: string; lastName?: string; email?: string }
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tx_ref = searchParams.get('tx_ref') || ''
  
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')
  const [payment, setPayment] = useState<ReceiptData | null>(null)
  const [receiptNumber, setReceiptNumber] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!tx_ref) {
      setStatus('failed')
      setErrorMessage('Missing transaction reference.')
      setLoading(false)
      return
    }

    const verify = async () => {
      try {
        const token = localStorage.getItem('hl_token')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await fetch(`${API_URL}/api/v1/payments/chapa/verify/${encodeURIComponent(tx_ref)}`, { headers })
        const json = await res.json()

        if (res.ok && (json.status === 'success' || json.payment)) {
          setStatus('success')
          setPayment(json.payment)
          setReceiptNumber(json.receiptNumber || json.payment?.receiptNumber || 'RCPT-CHAPA-' + Date.now().toString().slice(-6))
        } else {
          setStatus('failed')
          setErrorMessage(json.message || 'Payment verification failed.')
        }
      } catch (err: unknown) {
        setStatus('failed')
        setErrorMessage(err instanceof Error ? err.message : 'Unable to connect to verification server.')
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [tx_ref])

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    if (!payment) return
    const text = `
=====================================================
HOMELINK ETHIOPIA — OFFICIAL DIGITAL RENT RECEIPT
=====================================================
Receipt No:     ${receiptNumber}
Transaction Ref: ${tx_ref}
Payment Channel: Chapa Online Gateway
Date Settled:    ${new Date(payment.paidAt || Date.now()).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })} (EAT)
-----------------------------------------------------
Property:        ${payment.propertyId?.title || 'Residential Rental'}
Period:          ${payment.periodMonth || 'Current Billing Cycle'}
Amount Settled:  ${(payment.amountPaid || payment.amountDue || 0).toLocaleString()} ETB
Outstanding:     0.00 ETB (PAID IN FULL)
Status:          AUTHENTIC & VERIFIED VIA CHAPA
-----------------------------------------------------
Payer:           ${payment.tenantId?.firstName || 'Tenant'} ${payment.tenantId?.lastName || ''}
Payee:           Landlord Account via HomeLink Escrow
Registration:    Federal Democratic Republic of Ethiopia
                 Housing & Urban Development Registry
=====================================================
`.trim()

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${receiptNumber}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-cream/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        {loading && (
          <div className="rounded-2xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-rust/20 border-t-rust" />
            <h2 className="font-display text-xl font-semibold text-charcoal">Verifying Chapa Payment…</h2>
            <p className="mt-2 text-sm text-charcoal/60">Contacting Chapa clearinghouse to confirm transaction settlement.</p>
            <p className="mt-1 font-mono text-xs text-charcoal/40">{tx_ref}</p>
          </div>
        )}

        {!loading && status === 'success' && (
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
            {/* Header */}
            <div className="border-b border-emerald-100 bg-emerald-50/70 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-md">
                ✓
              </div>
              <h1 className="font-display text-2xl font-bold text-emerald-950">Payment Confirmed!</h1>
              <p className="mt-1 text-sm text-emerald-800">Your rent has been settled in full via Chapa Gateway.</p>
            </div>

            {/* Receipt Body */}
            <div className="p-6 sm:p-8">
              <div className="rounded-xl border border-dashed border-charcoal/20 bg-cream/20 p-5">
                <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-rust">Official Receipt</span>
                    <p className="font-mono text-base font-bold text-charcoal">{receiptNumber}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-xs font-semibold text-emerald-800">
                    PAID IN FULL
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-charcoal/50">Amount Settled</p>
                    <p className="text-base font-bold text-charcoal">
                      {(payment?.amountPaid || payment?.amountDue || 0).toLocaleString()} <span className="text-xs font-medium">ETB</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-charcoal/50">Channel</p>
                    <p className="font-medium text-charcoal">Chapa Online Gateway</p>
                  </div>
                  <div>
                    <p className="text-charcoal/50">Transaction Ref</p>
                    <p className="truncate font-mono text-charcoal/80" title={tx_ref}>{tx_ref}</p>
                  </div>
                  <div>
                    <p className="text-charcoal/50">Settlement Date</p>
                    <p className="font-medium text-charcoal">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>

                <div className="mt-4 border-t border-charcoal/10 pt-3">
                  <p className="text-[10px] text-charcoal/50">Property Description</p>
                  <p className="text-xs font-semibold text-charcoal">{payment?.propertyId?.title || 'HomeLink Ethiopia Residence'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handlePrint}
                  className="flex-1 rounded-xl bg-charcoal px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-charcoal/90"
                >
                  🖨️ Print Digital Receipt
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 rounded-xl border border-charcoal/20 bg-white px-4 py-3 text-center text-sm font-semibold text-charcoal hover:bg-cream/40"
                >
                  📥 Download Receipt (.txt)
                </button>
              </div>

              <div className="mt-4 text-center">
                <Link
                  href="/tenant/payments"
                  className="text-xs font-medium text-rust hover:underline"
                >
                  ← Return to Rent Schedule & Invoices
                </Link>
              </div>
            </div>
          </div>
        )}

        {!loading && status === 'failed' && (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl font-bold text-red-600">
              ✕
            </div>
            <h2 className="font-display text-xl font-bold text-charcoal">Verification Issue</h2>
            <p className="mt-2 text-sm text-charcoal/70">{errorMessage}</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => router.refresh()}
                className="rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-white hover:bg-rust/90"
              >
                Retry Verification
              </button>
              <Link
                href="/tenant/payments"
                className="text-xs text-charcoal/60 hover:text-charcoal hover:underline"
              >
                Return to Payments
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-rust border-t-transparent" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
