'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { notify } from '@/lib/notifications'
import RenewalPanel from '@/components/agreements/RenewalPanel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const getReceiptUrl = (url?: string) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`
  return url
}

interface Agreement {
  _id: string
  propertyId?: { _id?: string; title?: string; rentAmount?: number; location?: { address?: string; subCity?: string; city?: string } } | string
  tenantId?: { _id?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | string
  landlordId?: { _id?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | string
  monthlyRentEtb?: number
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
}

const DEFAULT_TERMS = [
  'Rent is due on the 5th day of every calendar month via verified payment.',
  'A security deposit equal to the agreed deposit amount shall be held in escrow until lease expiration.',
  'The tenant agrees to maintain the premises in good condition and report maintenance issues promptly.',
  'Subletting without prior written authorization from the landlord is strictly prohibited.',
  'Either party may terminate or request renewal with 30 days written notice prior to lease expiration.',
  'Both parties agree to abide by the Civil Code of Ethiopia regarding residential tenancy.'
]

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  draft: 'bg-charcoal/10 text-charcoal/60 border border-charcoal/15',
  pending_landlord: 'bg-amber-100 text-amber-800 border border-amber-200',
  pending_tenant: 'bg-blue-100 text-blue-800 border border-blue-200',
  expired: 'bg-charcoal/10 text-charcoal/50 border border-charcoal/15',
  terminated: 'bg-rose-100 text-rose-800 border border-rose-200',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active Lease',
  draft: 'Draft',
  pending_landlord: 'Awaiting Your Confirmation',
  pending_tenant: 'Awaiting Tenant Signature',
  expired: 'Expired',
  terminated: 'Terminated',
}

function fmtEtb(n?: number) {
  return n !== undefined ? `ETB ${n.toLocaleString()}` : '—'
}
function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

export default function LandlordAgreementsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [rents, setRents] = useState<Record<string, RentRecord[]>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedTermsId, setExpandedTermsId] = useState<string | null>(null)
  const [confirmingAgreement, setConfirmingAgreement] = useState<Agreement | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<RentRecord | null>(null)

  // Create Agreement Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [properties, setProperties] = useState<{ _id: string; title: string; rentAmount?: number }[]>([])
  const [formPropId, setFormPropId] = useState('')
  const [formTenantName, setFormTenantName] = useState('')
  const [formTenantEmail, setFormTenantEmail] = useState('')
  const [formRent, setFormRent] = useState(15000)
  const [formDeposit, setFormDeposit] = useState(15000)
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [formEndDate, setFormEndDate] = useState(new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10))
  const [creatingAgreement, setCreatingAgreement] = useState(false)

  const loadRents = useCallback(async (agreementId: string, token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/agreement/${agreementId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setRents((prev) => ({ ...prev, [agreementId]: data.data || data.payments || (Array.isArray(data) ? data : []) }))
      }
    } catch { /* leave empty */ }
  }, [])

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
        const list: Agreement[] = data.data || data.agreements || []
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
  }, [loadRents])

  useEffect(() => {
    fetchAgreements()
    // Load properties for agreement creator
    const token = localStorage.getItem('hl_token')
    if (token) {
      fetch(`${API_URL}/api/v1/properties/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const list = Array.isArray(d) ? d : d?.data || []
          setProperties(list)
          if (list[0]) {
            setFormPropId(list[0]._id)
            if (list[0].rentAmount) {
              setFormRent(list[0].rentAmount)
              setFormDeposit(list[0].rentAmount)
            }
          }
        })
        .catch(() => {})
    }
  }, [fetchAgreements])

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
        setConfirmingAgreement(null)
        setAgreements((prev) =>
          prev.map((a) =>
            a._id === id
              ? {
                  ...a,
                  landlordSigned: true,
                  landlordSignedAt: new Date().toISOString(),
                  status: a.tenantSigned ? 'active' : 'pending_tenant',
                }
              : a
          )
        )
        const ag = agreements.find((a) => a._id === id)
        const propTitle = (typeof ag?.propertyId === 'object' ? ag?.propertyId?.title : null) || 'the property'
        notify('application_accepted', 'Agreement Confirmed', `You confirmed the agreement for ${propTitle}. Tenant was notified to review & sign.`, '/landlord/agreements')
        loadRents(id, token || '')
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

  // Create or refresh rent schedule
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
        notify('application_accepted', 'Rent Schedule Generated', 'Monthly rent schedule and receipts initialized.', '/landlord/agreements')
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

  // Manual agreement creation
  async function handleCreateAgreement(e: React.FormEvent) {
    e.preventDefault()
    setCreatingAgreement(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const chosenProp = properties.find((p) => p._id === formPropId)
      const res = await fetch(`${API_URL}/api/v1/agreements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          propertyId: formPropId || (chosenProp?._id ?? 'mock-prop-1'),
          tenantId: { firstName: formTenantName || 'Tenant', email: formTenantEmail || 'tenant@homelink.et' },
          rentAmount: Number(formRent),
          depositAmount: Number(formDeposit),
          startDate: formStartDate,
          endDate: formEndDate,
          paymentDueDay: 5,
          paymentFrequency: 'monthly',
          terms: DEFAULT_TERMS,
          specialConditions: DEFAULT_TERMS.join('\n'),
        }),
      })

      if (res.ok) {
        setShowCreateModal(false)
        fetchAgreements()
        notify('application_accepted', 'Agreement Created', 'Rental agreement draft created. Confirm it below to send to tenant.', '/landlord/agreements')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not create agreement (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setCreatingAgreement(false)
    }
  }

  const propTitle = (a: Agreement) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Property'

  const tenantName = (a: Agreement) =>
    typeof a.tenantId === 'object' ? `${a.tenantId?.firstName || ''} ${a.tenantId?.lastName || ''}`.trim() : 'Tenant'

  const landlordName = (a: Agreement) =>
    typeof a.landlordId === 'object' ? `${a.landlordId?.firstName || ''} ${a.landlordId?.lastName || ''}`.trim() : 'You (Landlord)'

  return (
    <>
      <TopBar title="Rental Agreements & Rent" subtitle="Confirm agreements, then track monthly rent and receipts." />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-charcoal">Digital Rental Agreements</h1>
            <p className="mt-1 text-sm text-charcoal/60">
              Manage legally binding digital agreements, confirm terms, and track rent payments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rust-dark shadow-sm"
          >
            + Create Agreement
          </button>
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
            description="When you approve a tenant's application or create an agreement manually, it appears here for confirmation."
            actionLabel="Create Agreement"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="space-y-6">
            {agreements.map((a) => {
              const isBusy = busyId === a._id
              const rentList = rents[a._id] || []
              const showTerms = expandedTermsId === a._id
              const termsList = a.terms && a.terms.length > 0 ? a.terms : DEFAULT_TERMS

              return (
                <div key={a._id} className="rounded-2xl border border-sand bg-white p-6 sm:p-7 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs font-bold text-rust bg-rust/10 px-2 py-0.5 rounded">
                          AGR-{a._id.slice(-6).toUpperCase()}
                        </span>
                        <h3 className="text-lg font-bold text-charcoal">{propTitle(a)}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[a.status] || STATUS_STYLE.draft}`}>
                          {STATUS_LABEL[a.status] || a.status}
                        </span>
                      </div>

                      {/* Parties Info */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-charcoal/70">
                        <p>
                          <span className="text-charcoal/50 font-semibold">Tenant:</span>{' '}
                          <span className="font-bold text-charcoal">{tenantName(a)}</span>
                          {typeof a.tenantId === 'object' && a.tenantId?.email && (
                            <span className="text-charcoal/50 ml-1">({a.tenantId.email})</span>
                          )}
                        </p>
                        <p>
                          <span className="text-charcoal/50 font-semibold">Landlord:</span>{' '}
                          <span className="font-bold text-charcoal">{landlordName(a)}</span>
                        </p>
                      </div>

                      {/* Financial Key Terms */}
                      <div className="mt-4 grid gap-3 text-xs text-charcoal/70 sm:grid-cols-4 bg-cream/50 p-3.5 rounded-xl border border-sand">
                        <div>
                          <p className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider">Monthly Rent</p>
                          <p className="font-bold text-rust text-base mt-0.5">{fmtEtb(a.monthlyRentEtb)}/mo</p>
                          <p className="text-[10px] text-charcoal/40">Due 5th monthly</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider">Security Deposit</p>
                          <p className="font-bold text-charcoal text-base mt-0.5">{fmtEtb(a.depositAmount)}</p>
                          <p className="text-[10px] text-charcoal/40">In escrow</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider">Start Date</p>
                          <p className="text-charcoal font-semibold mt-0.5">{fmtDate(a.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider">End Date</p>
                          <p className="text-charcoal font-semibold mt-0.5">{fmtDate(a.endDate)}</p>
                        </div>
                      </div>

                      {/* Signature Statuses & Terms Toggle */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
                        <span className={`inline-flex items-center gap-1 font-semibold ${a.landlordSigned ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200' : 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200'}`}>
                          {a.landlordSigned ? '✓ You Confirmed & Signed' : '◦ Your Confirmation Pending'}
                        </span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${a.tenantSigned ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200' : 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200'}`}>
                          {a.tenantSigned ? '✓ Tenant Signed' : '◦ Awaiting Tenant Signature'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedTermsId(showTerms ? null : a._id)}
                          className="text-rust hover:underline font-bold ml-auto"
                        >
                          {showTerms ? 'Hide lease terms' : 'View full lease terms'}
                        </button>
                      </div>
                    </div>

                    {/* Landlord Confirm Button */}
                    {a.status === 'pending_landlord' && !a.landlordSigned && (
                      <button
                        type="button"
                        onClick={() => setConfirmingAgreement(a)}
                        disabled={isBusy}
                        className="rounded-xl bg-rust px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-rust-dark disabled:opacity-50 shadow-md"
                      >
                        {isBusy ? 'Confirming…' : 'Review & Confirm Agreement'}
                      </button>
                    )}
                  </div>

                  {/* Expanded Terms display */}
                  {showTerms && (
                    <div className="mt-4 border-t border-sand pt-4 bg-cream/30 p-4 rounded-xl border border-sand">
                      <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2">
                        Lease Terms &amp; Conditions (Ethiopian Residential Tenancy)
                      </h4>
                      <ol className="space-y-2 text-xs text-charcoal/80 list-decimal list-inside">
                        {termsList.map((t, i) => (
                          <li key={i} className="leading-relaxed">{t}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Smart Lease Renewal Component */}
                  {a.status === 'active' && (
                    <div className="mt-4">
                      <RenewalPanel agreement={a} myRole="landlord" onChanged={fetchAgreements} />
                    </div>
                  )}

                  {/* Rent tracking for active agreements */}
                  {a.status === 'active' && (
                    <div className="mt-4 border-t border-sand pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-charcoal">Rent Schedule &amp; Verified Receipts</h4>
                          <p className="text-[11px] text-charcoal/50">Tracking monthly rent payments and receipt documents.</p>
                        </div>
                        {rentList.length === 0 && (
                          <button
                            type="button"
                            onClick={() => generateRentSchedule(a._id)}
                            disabled={isBusy}
                            className="rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal/70 hover:border-rust hover:text-rust disabled:opacity-50 shadow-sm"
                          >
                            {isBusy ? 'Generating…' : 'Generate Rent Schedule'}
                          </button>
                        )}
                      </div>

                      {rentList.length > 0 ? (
                        <div className="mt-3 overflow-hidden rounded-xl border border-sand">
                          <table className="min-w-full divide-y divide-sand text-xs">
                            <thead className="bg-cream/60">
                              <tr>
                                <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal/70 uppercase">Month</th>
                                <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal/70 uppercase">Due Date</th>
                                <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal/70 uppercase">Amount</th>
                                <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal/70 uppercase">Status</th>
                                <th className="px-3.5 py-2.5 text-left font-semibold text-charcoal/70 uppercase">Receipt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sand/50 bg-white">
                              {rentList.map((r) => {
                                const isPaid = r.status === 'paid'
                                const rcpt = r.receiptNumber || (isPaid ? `RCPT-${r._id.slice(-6).toUpperCase()}` : null)

                                return (
                                  <tr key={r._id} className="hover:bg-cream/30 transition-colors">
                                    <td className="px-3.5 py-2.5 font-semibold text-charcoal">
                                      {r.periodMonth || r.month || (r.dueDate ? new Date(r.dueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Monthly Rent')}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-charcoal/70 font-mono">{fmtDate(r.dueDate)}</td>
                                    <td className="px-3.5 py-2.5 font-bold text-charcoal">{fmtEtb(r.amount || r.amountDue)}</td>
                                    <td className="px-3.5 py-2.5">
                                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                        r.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                                        r.status === 'overdue' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {r.status || 'pending'}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-2.5">
                                      {isPaid || r.receiptUrl || r.receiptKey ? (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedReceipt({ ...r, receiptNumber: rcpt || undefined })}
                                          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-rust hover:underline"
                                        >
                                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          <span>{rcpt || 'View Proof'}</span>
                                        </button>
                                      ) : (
                                        <span className="text-charcoal/30 font-mono">—</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-charcoal/40">
                          No rent records yet. Click &quot;Generate Rent Schedule&quot; to initialize monthly tracking.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Landlord Confirmation Modal */}
        {confirmingAgreement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-sand">
              <div className="flex items-start justify-between border-b border-sand pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rust">Workflow Step 2</span>
                  <h3 className="font-display text-lg font-bold text-charcoal">Confirm Digital Agreement</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingAgreement(null)}
                  className="rounded-lg p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-charcoal/80">
                <div className="rounded-xl bg-cream/50 p-4 border border-sand space-y-2">
                  <p><span className="font-bold text-charcoal/60">Property:</span> {propTitle(confirmingAgreement)}</p>
                  <p><span className="font-bold text-charcoal/60">Tenant:</span> {tenantName(confirmingAgreement)}</p>
                  <p><span className="font-bold text-charcoal/60">Monthly Rent:</span> {fmtEtb(confirmingAgreement.monthlyRentEtb)}/month</p>
                  <p><span className="font-bold text-charcoal/60">Security Deposit:</span> {fmtEtb(confirmingAgreement.depositAmount)}</p>
                  <p><span className="font-bold text-charcoal/60">Duration:</span> {fmtDate(confirmingAgreement.startDate)} → {fmtDate(confirmingAgreement.endDate)}</p>
                </div>

                <p className="text-[11px] leading-relaxed text-charcoal/70">
                  By confirming, you certify the lease terms and authorize this agreement to be transmitted to the tenant for electronic signature. Once the tenant signs, the agreement immediately becomes ACTIVE and the rent tracking schedule is generated.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-sand pt-4">
                <button
                  type="button"
                  onClick={() => setConfirmingAgreement(null)}
                  className="rounded-xl border border-charcoal/20 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-sand/30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmAgreement(confirmingAgreement._id)}
                  disabled={busyId === confirmingAgreement._id}
                  className="rounded-xl bg-rust px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rust-dark disabled:opacity-50 transition-all"
                >
                  {busyId === confirmingAgreement._id ? 'Confirming…' : 'Confirm & Send to Tenant'}
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

        {/* Create Agreement Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-sand">
              <div className="flex items-center justify-between border-b border-sand pb-3">
                <h3 className="font-display text-lg font-bold text-charcoal">Create Rental Agreement</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAgreement} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Select Property</label>
                  <select
                    value={formPropId}
                    onChange={(e) => {
                      setFormPropId(e.target.value)
                      const found = properties.find((p) => p._id === e.target.value)
                      if (found?.rentAmount) {
                        setFormRent(found.rentAmount)
                        setFormDeposit(found.rentAmount)
                      }
                    }}
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                    required
                  >
                    {properties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.title} {p.rentAmount ? `(ETB ${p.rentAmount.toLocaleString()}/mo)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1">Tenant Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Hanna Tesfaye"
                      value={formTenantName}
                      onChange={(e) => setFormTenantName(e.target.value)}
                      className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1">Tenant Email</label>
                    <input
                      type="email"
                      placeholder="tenant@example.com"
                      value={formTenantEmail}
                      onChange={(e) => setFormTenantEmail(e.target.value)}
                      className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1">Monthly Rent (ETB)</label>
                    <input
                      type="number"
                      value={formRent}
                      onChange={(e) => setFormRent(Number(e.target.value))}
                      className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1">Security Deposit (ETB)</label>
                    <input
                      type="number"
                      value={formDeposit}
                      onChange={(e) => setFormDeposit(Number(e.target.value))}
                      className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1">End Date</label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-xl border border-charcoal/20 py-2.5 text-xs font-semibold text-charcoal hover:bg-sand/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAgreement}
                    className="flex-1 rounded-xl bg-rust py-2.5 text-xs font-bold text-white hover:bg-rust-dark disabled:opacity-50 shadow-sm"
                  >
                    {creatingAgreement ? 'Creating…' : 'Create Draft'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
