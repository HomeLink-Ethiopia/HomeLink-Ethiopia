'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import RenewalPanel from '@/components/agreements/RenewalPanel'
import { notify } from '@/lib/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const getReceiptUrl = (url?: string) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`
  return url
}

interface Agreement {
  _id: string
  propertyId?: { _id?: string; title?: string; location?: { address?: string; subCity?: string; city?: string }; images?: any[] } | string
  tenantId?: { _id?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | string
  landlordId?: { _id?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | string
  monthlyRentEtb?: number
  depositAmount?: number
  startDate?: string
  endDate?: string
  paymentDueDay?: number
  status: 'draft' | 'pending_landlord' | 'pending_tenant' | 'active' | 'expired' | 'terminated'
  tenantSigned?: boolean
  landlordSigned?: boolean
  tenantSignedAt?: string
  landlordSignedAt?: string
  terms?: string[]
  specialConditions?: string
  createdAt: string
}

interface RentRecord {
  _id: string
  agreementId?: string
  amount?: number
  amountDue?: number
  dueDate?: string
  paidDate?: string
  status: 'pending' | 'paid' | 'overdue' | 'waived'
  receiptNumber?: string
  receiptUrl?: string
  receiptKey?: string
  periodMonth?: string
  month?: string
  paymentMethod?: string
  transactionReference?: string
}

function formatEtb(n?: number) {
  return n !== undefined ? `ETB ${n.toLocaleString()}` : '—'
}

function StatusBadge({ status }: { status: Agreement['status'] }) {
  const cls: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    draft: 'bg-charcoal/5 text-charcoal/60 border border-charcoal/10',
    pending_landlord: 'bg-amber-100 text-amber-800 border border-amber-200',
    pending_tenant: 'bg-blue-100 text-blue-800 border border-blue-200',
    expired: 'bg-charcoal/10 text-charcoal/50 border border-charcoal/15',
    terminated: 'bg-rose-100 text-rose-800 border border-rose-200',
  }
  const label: Record<string, string> = {
    active: 'Active Lease',
    draft: 'Draft',
    pending_landlord: 'Awaiting Landlord Confirmation',
    pending_tenant: 'Awaiting Your Signature',
    expired: 'Expired',
    terminated: 'Terminated',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls[status] || cls.draft}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-emerald-600' : status.startsWith('pending') ? 'bg-amber-600 animate-pulse' : 'bg-charcoal/40'}`} />
      {label[status] || status}
    </span>
  )
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

export default function AgreementsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showSignModal, setShowSignModal] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [rents, setRents] = useState<Record<string, RentRecord[]>>({})
  const [loadingRents, setLoadingRents] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<RentRecord | null>(null)

  const active = agreements.find((a) => a._id === selected)

  const fetchAgreements = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const raw = Array.isArray(data) ? data : data.data || data.agreements || []
        const list: Agreement[] = Array.isArray(raw) ? raw.filter(Boolean) : []
        setAgreements(list)
        if (list.length > 0) {
          setSelected((prev) => (prev && list.some(a => a._id === prev) ? prev : list[0]._id))
        }
      } else if (res.status === 401) {
        setError('Please log in as a tenant to see your agreements.')
      } else {
        setError(`Could not load agreements (${res.status}). Please try again later.`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgreements() }, [fetchAgreements])

  // Load rent schedule for active agreement
  const loadAgreementRents = useCallback(async (agreementId: string) => {
    if (!agreementId) return
    setLoadingRents(true)
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/payments/agreement/${agreementId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.data || []
        setRents((prev) => ({ ...prev, [agreementId]: list }))
      }
    } catch {
      // Quiet fallback
    } finally {
      setLoadingRents(false)
    }
  }, [])

  useEffect(() => {
    if (active && active.status === 'active') {
      loadAgreementRents(active._id)
    }
  }, [active, loadAgreementRents])

  // Sprint 8 workflow: tenant confirms the agreement after the landlord
  async function confirmAgreement(id: string) {
    if (!consentChecked) {
      setActionError('Please tick the consent box to confirm your electronic signature.')
      return
    }
    setSigning(true)
    setActionError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/${id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
      })
      if (res.ok) {
        setShowSignModal(false)
        setAgreements((prev) =>
          prev.map((a) =>
            a._id === id
              ? {
                  ...a,
                  tenantSigned: true,
                  tenantSignedAt: new Date().toISOString(),
                  status: a.landlordSigned ? 'active' : a.status,
                }
              : a
          )
        )
        const pTitle = typeof active?.propertyId === 'object' ? active.propertyId.title : 'the property'
        notify('application_accepted', 'Lease Activated!', `You have confirmed and signed the agreement for ${pTitle}. Rent schedule is now active.`, '/tenant/agreements')
        loadAgreementRents(id)
      } else {
        const data = await res.json().catch(() => ({}))
        setActionError(data.message || `Could not confirm the agreement (${res.status}).`)
      }
    } catch {
      setActionError('Cannot reach the server. Please try again.')
    } finally {
      setSigning(false)
    }
  }

  const propTitle = (a: Agreement) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Rental Property'

  const propAddress = (a: Agreement) => {
    if (typeof a.propertyId !== 'object' || !a.propertyId?.location) return ''
    const loc = a.propertyId.location
    return [loc.address, loc.subCity, loc.city].filter(Boolean).join(', ')
  }

  const tenantName = (a: Agreement) =>
    typeof a.tenantId === 'object' ? `${a.tenantId.firstName || ''} ${a.tenantId.lastName || ''}`.trim() : 'You (Tenant)'

  const landlordName = (a: Agreement) =>
    typeof a.landlordId === 'object' ? `${a.landlordId.firstName || ''} ${a.landlordId.lastName || ''}`.trim() : 'Landlord'

  const activeRentList = active ? rents[active._id] || [] : []

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-charcoal">Digital Rental Agreements</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Review legally binding digital agreements, confirm terms, and track rent payments.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm font-medium text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : agreements.length === 0 ? (
          <EmptyState
            icon="document"
            title="No agreements yet"
            description="Once you apply for a property and the landlord accepts, your digital rental agreement will appear here."
            actionLabel="Browse Properties"
            actionHref="/explore"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
            {/* Agreement Sidebar List */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-sand bg-white p-3 shadow-sm divide-y divide-sand/50">
                {agreements.map((a) => (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => {
                      setSelected(a._id)
                      setActionError('')
                    }}
                    className={`w-full rounded-xl p-3.5 text-left transition-all ${
                      selected === a._id
                        ? 'bg-cream border border-rust/30 shadow-sm'
                        : 'hover:bg-cream/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-charcoal/50">
                        AGR-{a._id.slice(-6).toUpperCase()}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-charcoal truncate">{propTitle(a)}</p>
                    <p className="mt-1 text-xs text-charcoal/60 font-medium">
                      {formatEtb(a.monthlyRentEtb)}/mo · {fmtDate(a.startDate)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Agreement Main Dossier */}
            {active ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-sand bg-white p-6 sm:p-8 shadow-sm">
                  {/* Top Bar Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-sand pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-rust bg-rust/10 px-2 py-0.5 rounded">
                          AGR-{active._id.slice(-8).toUpperCase()}
                        </span>
                        <StatusBadge status={active.status} />
                      </div>
                      <h2 className="mt-2 font-display text-2xl font-bold text-charcoal">{propTitle(active)}</h2>
                      {propAddress(active) && <p className="mt-1 text-xs text-charcoal/60">{propAddress(active)}</p>}
                    </div>

                    {active.status === 'active' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-emerald-600">
                          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z" />
                        </svg>
                        Legally Binding Agreement
                      </span>
                    )}
                  </div>

                  {/* Financial & Tenancy Key Details */}
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 bg-cream/50 p-4 rounded-xl border border-sand">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Monthly Rent</p>
                      <p className="mt-1 font-display text-xl font-black text-rust">{formatEtb(active.monthlyRentEtb)}</p>
                      <p className="text-[10px] text-charcoal/50">Due 5th of each month</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Security Deposit</p>
                      <p className="mt-1 font-display text-xl font-bold text-charcoal">{formatEtb(active.depositAmount)}</p>
                      <p className="text-[10px] text-charcoal/50">Refundable in escrow</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Commencement</p>
                      <p className="mt-1 text-sm font-semibold text-charcoal">{fmtDate(active.startDate)}</p>
                      <p className="text-[10px] text-charcoal/50">Lease start date</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Expiration</p>
                      <p className="mt-1 text-sm font-semibold text-charcoal">{fmtDate(active.endDate)}</p>
                      <p className="text-[10px] text-charcoal/50">Renewable upon notice</p>
                    </div>
                  </div>

                  {/* Parties & Digital Signatures Box */}
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-sand bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Tenant (You)</span>
                        {active.tenantSigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Digitally Signed
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Pending Signature
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-charcoal">{tenantName(active)}</p>
                      {typeof active.tenantId === 'object' && active.tenantId.email && (
                        <p className="text-xs text-charcoal/60">{active.tenantId.email}</p>
                      )}
                      {typeof active.tenantId === 'object' && active.tenantId.phone && (
                        <p className="text-xs text-charcoal/60 font-mono">{active.tenantId.phone}</p>
                      )}
                      {active.tenantSignedAt && (
                        <p className="mt-2 text-[10px] font-mono text-emerald-800">
                          Signed at: {new Date(active.tenantSignedAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-sand bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Landlord</span>
                        {active.landlordSigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Confirmed &amp; Signed
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Awaiting Confirmation
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-charcoal">{landlordName(active)}</p>
                      {typeof active.landlordId === 'object' && active.landlordId.email && (
                        <p className="text-xs text-charcoal/60">{active.landlordId.email}</p>
                      )}
                      {typeof active.landlordId === 'object' && active.landlordId.phone && (
                        <p className="text-xs text-charcoal/60 font-mono">{active.landlordId.phone}</p>
                      )}
                      {active.landlordSignedAt && (
                        <p className="mt-2 text-[10px] font-mono text-emerald-800">
                          Confirmed at: {new Date(active.landlordSignedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Workflow Stage Callouts */}
                  {active.status === 'pending_landlord' && (
                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Step 2 in Progress: Landlord Confirmation
                      </div>
                      <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">
                        The landlord has approved your application and is reviewing this rental agreement. Once confirmed by the landlord, you will be invited to review and execute your digital signature.
                      </p>
                    </div>
                  )}

                  {active.status === 'pending_tenant' && !active.tenantSigned && (
                    <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                            Step 3: Ready for Your Digital Confirmation
                          </div>
                          <p className="mt-1 text-xs text-blue-900/80">
                            The landlord has confirmed and signed this lease. Please review the terms below and click to confirm your signature.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError('')
                            setConsentChecked(false)
                            setShowSignModal(true)
                          }}
                          className="rounded-xl bg-rust px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-rust-dark transition-all"
                        >
                          Review &amp; Sign Agreement
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Full Terms and Conditions */}
                  <div className="mt-6 border-t border-sand pt-5">
                    <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                      Lease Terms &amp; Statutory Conditions
                    </h3>
                    <p className="mt-1 text-xs text-charcoal/60">
                      Standard residential tenancy clauses conforming to the Civil Code of Ethiopia:
                    </p>
                    <ol className="mt-3 space-y-2.5 rounded-xl border border-sand bg-cream/30 p-4 text-xs text-charcoal/80">
                      {(active.terms && active.terms.length > 0
                        ? active.terms
                        : [
                            'Rent is due on the 5th day of every calendar month via verified payment.',
                            'A security deposit equal to the agreed deposit amount shall be held in escrow until lease expiration.',
                            'The tenant agrees to maintain the premises in good condition and report maintenance issues promptly.',
                            'Subletting without written authorization from the landlord is strictly prohibited.',
                            'Either party may terminate or request renewal with 30 days written notice prior to lease expiration.',
                            'Both parties agree to abide by the Civil Code of Ethiopia regarding residential tenancy.'
                          ]
                      ).map((term, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span className="font-mono text-rust font-bold shrink-0">{i + 1}.</span>
                          <span>{term}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Smart Lease Renewal Component */}
                  {active.status === 'active' && (
                    <div className="mt-6">
                      <RenewalPanel agreement={active} myRole="tenant" onChanged={fetchAgreements} />
                    </div>
                  )}

                  <p className="mt-6 text-[11px] text-charcoal/40 text-center">
                    Digital agreement record created on {new Date(active.createdAt).toLocaleDateString()}. Enforced under Ethiopian Electronic Signature standards.
                  </p>
                </div>

                {/* Rent Tracking for Active Agreements */}
                {active.status === 'active' && (
                  <div className="rounded-2xl border border-sand bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4 border-b border-sand pb-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-charcoal">Rent Tracking &amp; Payment Receipts</h3>
                        <p className="mt-0.5 text-xs text-charcoal/60">
                          Scheduled monthly rent payments for this active lease agreement.
                        </p>
                      </div>
                      <Link
                        href="/tenant/payments"
                        className="rounded-lg bg-rust px-4 py-2 text-xs font-semibold text-white hover:bg-rust-dark transition-colors shadow-sm"
                      >
                        Manage &amp; Pay Rent →
                      </Link>
                    </div>

                    {loadingRents ? (
                      <div className="py-8 text-center text-xs text-charcoal/50">Loading rent schedule…</div>
                    ) : activeRentList.length > 0 ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-sand text-xs">
                          <thead className="bg-cream/60">
                            <tr>
                              <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal uppercase">Rent Month</th>
                              <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal uppercase">Due Date</th>
                              <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal uppercase">Amount</th>
                              <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal uppercase">Payment Status</th>
                              <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal uppercase">Payment Date</th>
                              <th className="px-3.5 py-2.5 text-center font-semibold text-charcoal uppercase">Receipt Proof</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sand/50">
                            {activeRentList.map((r) => {
                              const isPaid = r.status === 'paid'
                              const hasReceipt = Boolean(r.receiptUrl || r.receiptKey)
                              const rcpt = r.receiptNumber || (isPaid ? `RCPT-${r._id.slice(-6).toUpperCase()}` : null)

                              return (
                                <tr key={r._id} className="hover:bg-cream/30 transition-colors">
                                  <td className="px-3.5 py-3 font-semibold text-charcoal">
                                    {r.periodMonth || r.month || 'Monthly Rent'}
                                  </td>
                                  <td className="px-3.5 py-3 font-mono text-charcoal/70">
                                    {fmtDate(r.dueDate)}
                                  </td>
                                  <td className="px-3.5 py-3 font-bold text-charcoal">
                                    ETB {(r.amount || r.amountDue || 0).toLocaleString()}
                                  </td>
                                  <td className="px-3.5 py-3">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                        r.status === 'paid'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : r.status === 'overdue'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {r.status}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-3 text-charcoal/70 font-mono">
                                    {isPaid ? fmtDate(r.paidDate || r.dueDate) : '—'}
                                  </td>
                                  <td className="px-3.5 py-3 text-center">
                                    {hasReceipt || isPaid ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReceipt({ ...r, receiptNumber: rcpt || undefined })}
                                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-rust hover:underline"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        <span>{rcpt || 'View Receipt'}</span>
                                      </button>
                                    ) : (
                                      <span className="text-charcoal/30">—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-charcoal/50 text-center py-4">
                        Rent schedule initialized. No individual payments logged yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-sand bg-white p-12 text-sm text-charcoal/40">
                Select an agreement from the list to view its complete record and rent schedule.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Digital Signature & Legal Confirmation Modal */}
      {showSignModal && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-sand max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-sand pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rust">Official Legal Consent</span>
                <h3 className="font-display text-xl font-bold text-charcoal mt-0.5">
                  Confirm &amp; Digitally Sign Rental Lease
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="rounded-lg p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-charcoal/80">
              <div className="rounded-xl bg-cream/50 p-4 border border-sand grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-charcoal/60">Property:</span>
                  <p className="font-bold text-charcoal text-sm mt-0.5">{propTitle(active)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Monthly Rent:</span>
                  <p className="font-bold text-rust text-sm mt-0.5">{formatEtb(active.monthlyRentEtb)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Security Deposit:</span>
                  <p className="font-semibold text-charcoal mt-0.5">{formatEtb(active.depositAmount)}</p>
                </div>
                <div>
                  <span className="font-semibold text-charcoal/60">Lease Term:</span>
                  <p className="font-semibold text-charcoal mt-0.5">{fmtDate(active.startDate)} → {fmtDate(active.endDate)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-sand p-3.5 bg-white space-y-2 text-[11px] leading-relaxed">
                <p className="font-bold text-charcoal">Electronic Agreement Terms:</p>
                <p>1. I agree to pay the monthly rental amount on or before the 5th day of every calendar month.</p>
                <p>2. I agree to pay the refundable security deposit to be held in escrow until lease expiration.</p>
                <p>3. I acknowledge that this electronic signature is legally binding and enforceable pursuant to the Ethiopian Electronic Signature laws.</p>
              </div>

              {actionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                  {actionError}
                </div>
              )}

              <label className="flex items-start gap-3 rounded-xl border border-sand bg-cream/30 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-charcoal/30 text-rust focus:ring-rust"
                />
                <span className="text-xs font-semibold text-charcoal leading-snug">
                  I solemnly declare that I have read and agree to all terms of this lease agreement and commit to my financial and tenancy responsibilities.
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-sand pt-4">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="rounded-xl border border-charcoal/20 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-sand/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmAgreement(active._id)}
                disabled={signing || !consentChecked}
                className="rounded-xl bg-rust px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rust-dark disabled:opacity-50 transition-all"
              >
                {signing ? 'Signing Agreement…' : 'Execute & Activate Lease'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Receipt Proof Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-sand">
            <div className="flex items-center justify-between border-b border-sand pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rust">Receipt Record</span>
                <h4 className="font-display text-base font-bold text-charcoal">
                  {selectedReceipt.receiptNumber || `RCPT-${selectedReceipt._id.slice(-6).toUpperCase()}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="rounded-lg p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex min-h-[240px] max-h-[360px] w-full items-center justify-center overflow-auto rounded-xl border border-sand bg-cream/30 p-2">
              {selectedReceipt.receiptKey || selectedReceipt.receiptUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getReceiptUrl(selectedReceipt.receiptKey || selectedReceipt.receiptUrl)}
                  alt="Receipt voucher"
                  className="max-h-[340px] w-auto max-w-full rounded object-contain shadow-sm"
                />
              ) : (
                <div className="text-center p-6 text-charcoal/40">
                  <p className="text-xs font-semibold">Standard System Digital Receipt</p>
                  <p className="text-[11px] mt-1">Payment verified directly via system payment rail.</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-cream/50 p-3 rounded-xl border border-sand">
              <div>
                <span className="font-semibold text-charcoal/50">Month:</span>
                <p className="font-bold text-charcoal">{selectedReceipt.periodMonth || selectedReceipt.month || 'Rent'}</p>
              </div>
              <div>
                <span className="font-semibold text-charcoal/50">Amount Settled:</span>
                <p className="font-bold text-emerald-700">ETB {(selectedReceipt.amount || selectedReceipt.amountDue || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="font-semibold text-charcoal/50">Payment Date:</span>
                <p className="font-mono text-charcoal">{fmtDate(selectedReceipt.paidDate || selectedReceipt.dueDate)}</p>
              </div>
              <div>
                <span className="font-semibold text-charcoal/50">Status:</span>
                <p className="font-bold uppercase text-emerald-800">{selectedReceipt.status}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {(selectedReceipt.receiptKey || selectedReceipt.receiptUrl) && (
                <a
                  href={getReceiptUrl(selectedReceipt.receiptKey || selectedReceipt.receiptUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-charcoal/20 bg-white px-3.5 py-1.5 text-xs font-semibold text-charcoal hover:bg-cream"
                >
                  Open Full View
                </a>
              )}
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="rounded-xl bg-charcoal px-4 py-1.5 text-xs font-semibold text-white hover:bg-charcoal/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
