'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { notify } from '@/lib/notifications'
import RenewalPanel from '@/components/agreements/RenewalPanel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Agreement {
  _id: string
  propertyId?: { title?: string; rentAmount?: number; location?: { address?: string; subCity?: string; city?: string } } | string
  tenantId?: { firstName?: string; lastName?: string; email?: string; phone?: string } | string
  landlordId?: { firstName?: string; lastName?: string; email?: string; phone?: string } | string
  monthlyRentEtb?: number
  rentAmount?: number
  depositAmount?: number
  startDate?: string
  endDate?: string
  terms?: string[]
  specialConditions?: string
  status: 'draft' | 'pending_landlord' | 'pending_tenant' | 'active' | 'expired' | 'terminated'
  tenantSigned?: boolean
  landlordSigned?: boolean
  tenantSignedAt?: string
  landlordSignedAt?: string
  paymentDueDay?: number
  paymentFrequency?: string
  createdAt: string
}

interface RentRecord {
  _id: string
  agreementId?: string
  amount?: number
  dueDate?: string
  paidDate?: string
  status: 'pending' | 'paid' | 'overdue'
  receiptNumber?: string
  month?: string
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-verified text-white',
  draft: 'bg-charcoal/10 text-charcoal/60',
  pending_landlord: 'bg-amber-100 text-amber-700',
  pending_tenant: 'bg-blue-50 text-blue-700',
  expired: 'bg-charcoal/10 text-charcoal/50',
  terminated: 'bg-red-50 text-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  draft: 'Draft',
  pending_landlord: 'Awaiting Your Confirmation',
  pending_tenant: 'Awaiting Tenant',
  expired: 'Expired',
  terminated: 'Terminated',
}

function fmtEtb(n?: number) {
  return n !== undefined ? `ETB ${n.toLocaleString()}` : '—'
}
function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—'
}

export default function LandlordAgreementsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [rents, setRents] = useState<Record<string, RentRecord[]>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedRent, setExpandedRent] = useState<string | null>(null)
  const [expandedContract, setExpandedContract] = useState<string | null>(null)

  // Rate Tenant modal state
  const [ratingAgreement, setRatingAgreement] = useState<Agreement | null>(null)
  const [ratingOverall, setRatingOverall] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  async function submitAgreementReview() {
    if (!ratingAgreement) return
    setRatingSubmitting(true)
    try {
      const token = localStorage.getItem('hl_token')
      const tenantId = typeof ratingAgreement.tenantId === 'object' ? (ratingAgreement.tenantId as any)?._id : ratingAgreement.tenantId
      const propId = typeof ratingAgreement.propertyId === 'object' ? (ratingAgreement.propertyId as any)?._id : ratingAgreement.propertyId
      const res = await fetch(`${API_URL}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agreementId: ratingAgreement._id,
          revieweeId: tenantId,
          propertyId: propId,
          reviewType: 'landlord_to_tenant',
          ratings: { overall: ratingOverall },
          comment: ratingComment,
        }),
      })
      if (res.ok) {
        notify('review_submitted', 'Tenant rating recorded', 'Your rating for this tenant has been submitted.')
        setRatingAgreement(null)
        setRatingComment('')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.message || 'Could not record rating.')
      }
    } catch {
      setError('Cannot connect to review service.')
    } finally {
      setRatingSubmitting(false)
    }
  }

  const fetchAgreements = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const list: Agreement[] = Array.isArray(data) ? data : (data.data || data.agreements || [])
        setAgreements(list)
        // Load rent schedules for active agreements
        list.filter((a) => a.status === 'active').forEach((a) => loadRents(a._id, token || ''))
      } else if (res.status === 401) {
        setError('Please log in as a landlord to manage agreements.')
      } else {
        setError(`Could not load agreements (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRents = useCallback(async (agreementId: string, token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/agreement/${agreementId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const list: RentRecord[] = Array.isArray(data) ? data : (data.data || data.payments || [])
        setRents((prev) => ({ ...prev, [agreementId]: list }))
      }
    } catch { /* leave empty */ }
  }, [])

  async function handleQuickVerify(agreementId: string, paymentId: string) {
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
      if (res.ok) {
        loadRents(agreementId, token || '')
        notify('application_accepted', 'Payment verified', 'Rent payment verified and confirmed.', '/landlord/agreements')
      }
    } catch { /* ignore */ }
  }

  async function handleQuickRemind(paymentId: string) {
    try {
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/payments/${paymentId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      notify('application_accepted', 'Reminder sent', 'Payment reminder sent to tenant.', '/landlord/agreements')
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchAgreements() }, [fetchAgreements])

  // Sprint 8 workflow: landlord confirms the agreement first
  async function confirmAgreement(id: string) {
    setBusyId(id)
    setError('')
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
        setAgreements((prev) =>
          prev.map((a) =>
            a._id === id
              ? { ...a, landlordSigned: true, status: a.tenantSigned ? 'active' : 'pending_tenant' }
              : a
          )
        )
        const ag = agreements.find((a) => a._id === id)
        const propTitle = (typeof ag?.propertyId === 'object' ? ag?.propertyId?.title : null) || 'the property'
        notify('application_accepted', 'Agreement confirmed', `You confirmed the agreement for ${propTitle}. The tenant has been asked to sign.`, '/landlord/agreements')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not confirm the agreement (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  // Create the first month's rent record from the agreement terms
  async function generateRentSchedule(id: string) {
    setBusyId(id)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/payments/generate/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
      })
      if (res.ok) {
        loadRents(id, token || '')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not generate the rent schedule (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const propTitle = (a: Agreement) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Property'
  const tenantName = (a: Agreement) =>
    typeof a.tenantId === 'object' ? `${a.tenantId?.firstName || ''} ${a.tenantId?.lastName || ''}`.trim() : 'Tenant'

  return (
    <>
      <TopBar title="Rental Agreements & Rent" subtitle="Confirm agreements, then track monthly rent and receipts." />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : agreements.length === 0 ? (
          <EmptyState
            icon="document"
            title="No agreements yet"
            description="When you approve a tenant's application, a rental agreement is created here for you to confirm."
          />
        ) : (
          <div className="space-y-5">
            {agreements.map((a) => {
              const isBusy = busyId === a._id
              const rentList = rents[a._id] || []
              return (
                <div key={a._id} className="rounded-lg border border-sand bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-charcoal">{propTitle(a)}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[a.status] || STATUS_STYLE.draft}`}>
                          {STATUS_LABEL[a.status] || a.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-charcoal/60">Tenant: {tenantName(a)}</p>
                      <div className="mt-3 grid gap-2 text-sm text-charcoal/70 sm:grid-cols-4">
                        <p><span className="font-medium text-charcoal">Rent:</span> <span className="font-bold text-charcoal">{fmtEtb(a.rentAmount || a.monthlyRentEtb)}</span>/mo</p>
                        <p><span className="font-medium text-charcoal">Security Deposit:</span> <span className="font-semibold text-emerald-700">{fmtEtb(a.depositAmount)}</span></p>
                        <p><span className="font-medium text-charcoal">Start:</span> {fmtDate(a.startDate)}</p>
                        <p><span className="font-medium text-charcoal">End:</span> {fmtDate(a.endDate)}</p>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs">
                        <span className={a.landlordSigned ? 'font-semibold text-verified' : 'text-amber-600'}>
                          {a.landlordSigned ? '✓ You signed' : '◦ Your signature pending'}
                        </span>
                        <span className={a.tenantSigned ? 'font-semibold text-verified' : 'text-amber-600'}>
                          {a.tenantSigned ? '✓ Tenant signed' : '◦ Tenant signature pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedContract(expandedContract === a._id ? null : a._id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                          expandedContract === a._id
                            ? 'border-rust bg-rust/10 text-rust'
                            : 'border-charcoal/20 bg-sand/30 text-charcoal hover:bg-sand/60'
                        }`}
                      >
                        <span>📜</span>
                        <span>{expandedContract === a._id ? 'Hide Written Agreement' : 'Read Full Written Agreement'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRatingAgreement(a)
                          setRatingOverall(5)
                          setRatingComment('')
                        }}
                        className="rounded-lg border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-gold/30 transition-colors flex items-center gap-1"
                      >
                        <span className="text-amber-600 font-bold">★</span>
                        <span>Rate Tenant</span>
                      </button>

                      {a.status === 'pending_landlord' && !a.landlordSigned && (
                        <button
                          type="button"
                          onClick={() => confirmAgreement(a._id)}
                          disabled={isBusy}
                          className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50"
                        >
                          {isBusy ? 'Confirming…' : 'Confirm & Sign Agreement'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ─── FULL WRITTEN DIGITAL LEASE AGREEMENT & SIGNATURES ─── */}
                  {expandedContract === a._id && (
                    <div className="mt-5 rounded-xl border border-charcoal/15 bg-cream/30 p-6 space-y-6">
                      <div className="border-b border-charcoal/10 pb-4 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-charcoal/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-charcoal">
                              CONTRACT #{a._id}
                            </span>
                            <span className="text-xs text-charcoal/50">
                              Executed under Ethiopian Civil Code
                            </span>
                          </div>
                          <h4 className="mt-1 font-display text-lg font-bold text-charcoal">
                            Residential Tenancy &amp; Lease Agreement
                          </h4>
                          <p className="text-xs text-charcoal/60">
                            Property: <span className="font-semibold text-charcoal">{propTitle(a)}</span> · {fmtDate(a.startDate)} to {fmtDate(a.endDate)}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-semibold text-charcoal">{fmtEtb(a.rentAmount || a.monthlyRentEtb)} / month</p>
                          <p className="text-emerald-700 font-medium">Refundable Deposit in Escrow: {fmtEtb(a.depositAmount)}</p>
                        </div>
                      </div>

                      {/* Contract Parties */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-charcoal/10 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Landlord (Lessor)</p>
                          <p className="mt-1 font-semibold text-charcoal">
                            {typeof a.landlordId === 'object' && a.landlordId?.firstName
                              ? `${a.landlordId.firstName} ${a.landlordId.lastName || ''}`.trim()
                              : 'Tsedenia Worku (You)'}
                          </p>
                          <p className="text-xs text-charcoal/60">Verified Landlord · HomeLink Verified</p>
                        </div>

                        <div className="rounded-lg border border-charcoal/10 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Tenant (Lessee)</p>
                          <p className="mt-1 font-semibold text-charcoal">{tenantName(a)}</p>
                          <p className="text-xs text-charcoal/60">Registered Tenant · ID &amp; Income Verified</p>
                        </div>
                      </div>

                      {/* Official Terms & Conditions */}
                      <div>
                        <h5 className="font-display text-sm font-bold text-charcoal mb-3 flex items-center gap-2">
                          <span>⚖️</span>
                          <span>Legally Binding Tenancy Clauses &amp; Terms</span>
                        </h5>
                        <div className="rounded-lg border border-charcoal/10 bg-white p-4">
                          <ol className="space-y-2.5 text-xs text-charcoal/80 leading-relaxed list-decimal pl-4">
                            {(a.terms && a.terms.length > 0 ? a.terms : [
                              "Monthly rent is payable in advance by the 5th of each calendar month via HomeLink verified channels (Telebirr, CBE, or Chapa).",
                              "Security deposit equal to agreed deposit amount shall be held in escrow until lease expiration, refundable upon satisfactory move-out inspection.",
                              "The tenant agrees to maintain the residential premises in good order and report maintenance defects promptly.",
                              "Subletting, assignment, or unauthorized commercial use of the property is strictly prohibited without prior written consent.",
                              "Utilities (water, electricity, waste collection, and building sanitation) shall be settled in accordance with property provisions.",
                              "Either party may terminate or propose renewal with a minimum of 30 days written notice prior to lease expiration.",
                              "Both landlord and tenant agree to strictly adhere to the Civil Code of Ethiopia regarding residential tenancies."
                            ]).map((t, idx) => (
                              <li key={idx} className="pl-1">
                                <span>{t}</span>
                              </li>
                            ))}
                          </ol>

                          {a.specialConditions && (
                            <div className="mt-4 border-t border-charcoal/10 pt-3">
                              <p className="text-[11px] font-semibold text-charcoal">Special Conditions / Addendum:</p>
                              <p className="mt-0.5 text-xs italic text-charcoal/70">{a.specialConditions}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Signatures & Execution Block */}
                      <div>
                        <h5 className="font-display text-sm font-bold text-charcoal mb-3 flex items-center gap-2">
                          <span>✍️</span>
                          <span>Digital Signatures &amp; Execution Record</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Landlord signature box */}
                          <div className={`rounded-xl border p-4 ${
                            a.landlordSigned
                              ? 'border-verified/30 bg-verified/5'
                              : 'border-amber-300 bg-amber-50/50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Landlord Signature</p>
                              {a.landlordSigned ? (
                                <span className="rounded-full bg-verified/15 px-2 py-0.5 text-[10px] font-bold text-verified">
                                  ✓ Signed
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Pending Your Signature
                                </span>
                              )}
                            </div>
                            <div className="mt-3">
                              <p className="font-display text-sm font-bold text-charcoal">
                                {typeof a.landlordId === 'object' && a.landlordId?.firstName
                                  ? `${a.landlordId.firstName} ${a.landlordId.lastName || ''}`.trim()
                                  : 'Tsedenia Worku'}
                              </p>
                              <p className="text-[11px] text-charcoal/60 mt-0.5">
                                {a.landlordSigned
                                  ? `Digitally confirmed on ${fmtDate(a.landlordSignedAt || a.createdAt)}`
                                  : 'Click "Confirm & Sign Agreement" above to execute this lease.'}
                              </p>
                            </div>
                          </div>

                          {/* Tenant signature box */}
                          <div className={`rounded-xl border p-4 ${
                            a.tenantSigned
                              ? 'border-verified/30 bg-verified/5'
                              : 'border-amber-300 bg-amber-50/50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Tenant Signature</p>
                              {a.tenantSigned ? (
                                <span className="rounded-full bg-verified/15 px-2 py-0.5 text-[10px] font-bold text-verified">
                                  ✓ Signed
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Awaiting Tenant
                                </span>
                              )}
                            </div>
                            <div className="mt-3">
                              <p className="font-display text-sm font-bold text-charcoal">{tenantName(a)}</p>
                              <p className="text-[11px] text-charcoal/60 mt-0.5">
                                {a.tenantSigned
                                  ? `Digitally signed on ${fmtDate(a.tenantSignedAt || a.createdAt)}`
                                  : 'Tenant will digitally sign from their Tenant Portal (/tenant/agreements).'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-[11px] text-charcoal/50 text-center">
                          🔒 Cryptographically signed and timestamped digital agreement. Valid under the Electronic Transactions Proclamation of Ethiopia.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Smart Lease Renewal — expiry banner, AI price, one-click signing */}
                  {a.status === 'active' && (
                    <div className="mt-4">
                      <RenewalPanel agreement={a} myRole="landlord" onChanged={fetchAgreements} />
                    </div>
                  )}

                  {/* Rent tracking for active agreements */}
                  {a.status === 'active' && (
                    <div className="mt-4 border-t border-charcoal/10 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm font-semibold text-charcoal">Rent Schedule</h4>
                          <Link
                            href="/landlord/rent-payments"
                            className="text-xs font-semibold text-rust hover:text-rust-dark transition-colors"
                          >
                            All Rent Payments →
                          </Link>
                        </div>
                        {rentList.length === 0 && (
                          <button
                            type="button"
                            onClick={() => generateRentSchedule(a._id)}
                            disabled={isBusy}
                            className="rounded-lg border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/60 hover:border-rust hover:text-rust disabled:opacity-50"
                          >
                            {isBusy ? '…' : 'Generate rent schedule'}
                          </button>
                        )}
                      </div>

                      {rentList.length > 0 ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-charcoal/10">
                          <table className="min-w-full divide-y divide-charcoal/10 text-sm">
                            <thead className="bg-cream/60">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-charcoal/60">Month</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-charcoal/60">Due Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-charcoal/60">Amount</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-charcoal/60">Status</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-charcoal/60">Receipt</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-charcoal/60">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-charcoal/5">
                              {rentList.map((r) => (
                                <tr key={r._id}>
                                  <td className="px-3 py-2 text-charcoal">
                                    {r.month || (r.dueDate ? new Date(r.dueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—')}
                                  </td>
                                  <td className="px-3 py-2 text-charcoal/70">{fmtDate(r.dueDate)}</td>
                                  <td className="px-3 py-2 font-semibold text-charcoal">{fmtEtb(r.amount)}</td>
                                  <td className="px-3 py-2">
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                      r.status === 'paid' ? 'bg-verified text-white' :
                                      r.status === 'overdue' ? 'bg-rust text-white' : 'bg-gold text-charcoal'
                                    }`}>
                                      {(r.status || 'pending').charAt(0).toUpperCase() + (r.status || 'pending').slice(1)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-charcoal/50">
                                    {r.status === 'paid'
                                      ? (r.receiptNumber || `RCPT-${r._id.slice(-6).toUpperCase()}`) + (r.paidDate ? ` · ${fmtDate(r.paidDate)}` : '')
                                      : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {r.status !== 'paid' ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleQuickVerify(a._id, r._id)}
                                          className="rounded bg-verified px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-verified-dark"
                                        >
                                          Confirm Paid
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleQuickRemind(r._id)}
                                          className="rounded border border-charcoal/15 bg-white px-2 py-0.5 text-[10px] font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust"
                                        >
                                          Remind
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-verified font-medium">✓ Settled</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-charcoal/40">
                          No rent records yet. Generate a schedule to track monthly payments.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
      {/* ─── RATE TENANT MODAL ─── */}
      {ratingAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-charcoal/10">
            <div className="border-b border-charcoal/10 bg-sand/20 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-charcoal">Rate Tenant</h3>
                <p className="text-xs text-charcoal/50">For {tenantName(ratingAgreement)}</p>
              </div>
              <button
                type="button"
                onClick={() => setRatingAgreement(null)}
                className="text-charcoal/40 hover:text-charcoal font-bold text-base"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Tenancy Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingOverall(star)}
                      className={`text-2xl transition-transform hover:scale-110 ${
                        star <= ratingOverall ? 'text-amber-500' : 'text-charcoal/20'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 self-center font-mono font-bold text-charcoal">{ratingOverall} / 5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Feedback / Reference Note</label>
                <textarea
                  rows={3}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share details on rent punctuality, property condition upon handover, or general reference..."
                  className="w-full rounded-xl border border-charcoal/15 p-2.5 text-xs text-charcoal focus:border-rust outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRatingAgreement(null)}
                  className="rounded-lg border border-charcoal/15 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitAgreementReview}
                  disabled={ratingSubmitting}
                  className="rounded-lg bg-rust px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rust-dark disabled:opacity-50"
                >
                  {ratingSubmitting ? 'Submitting…' : 'Publish Rating'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
