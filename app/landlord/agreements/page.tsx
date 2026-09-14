'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { notify } from '@/lib/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Agreement {
  _id: string
  propertyId?: { title?: string; rentAmount?: number } | string
  tenantId?: { firstName?: string; lastName?: string; email?: string } | string
  monthlyRentEtb?: number
  depositAmount?: number
  startDate?: string
  endDate?: string
  terms?: string[]
  status: 'draft' | 'pending_landlord' | 'pending_tenant' | 'active' | 'expired' | 'terminated'
  tenantSigned?: boolean
  landlordSigned?: boolean
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
        setAgreements(data.data || data.agreements || [])
        // Load rent schedules for active agreements
        const list: Agreement[] = data.data || data.agreements || []
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
        setRents((prev) => ({ ...prev, [agreementId]: data.data || data.payments || [] }))
      }
    } catch { /* leave empty */ }
  }, [])

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
                        <p><span className="font-medium text-charcoal">Rent:</span> {fmtEtb(a.monthlyRentEtb)}/mo</p>
                        <p><span className="font-medium text-charcoal">Deposit:</span> {fmtEtb(a.depositAmount)}</p>
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

                    {a.status === 'pending_landlord' && !a.landlordSigned && (
                      <button
                        type="button"
                        onClick={() => confirmAgreement(a._id)}
                        disabled={isBusy}
                        className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50"
                      >
                        {isBusy ? 'Confirming…' : 'Confirm Agreement'}
                      </button>
                    )}
                  </div>

                  {/* Rent tracking for active agreements */}
                  {a.status === 'active' && (
                    <div className="mt-4 border-t border-charcoal/10 pt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-charcoal">Rent Schedule</h4>
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
                                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-charcoal/50">
                                    {r.status === 'paid'
                                      ? (r.receiptNumber || `RCPT-${r._id.slice(-6).toUpperCase()}`) + (r.paidDate ? ` · ${fmtDate(r.paidDate)}` : '')
                                      : '—'}
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
    </>
  )
}
