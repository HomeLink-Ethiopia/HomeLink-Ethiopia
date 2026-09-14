'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Agreement {
  _id: string
  propertyId?: { title?: string; location?: { address?: string; subCity?: string } } | string
  monthlyRentEtb?: number
  depositAmount?: number
  startDate?: string
  endDate?: string
  status: 'draft' | 'pending_landlord' | 'pending_tenant' | 'active' | 'expired' | 'terminated'
  tenantSigned?: boolean
  landlordSigned?: boolean
  terms?: string[]
  createdAt: string
}

function formatEtb(n?: number) {
  return n !== undefined ? `ETB ${n.toLocaleString()}` : '—'
}

function StatusBadge({ status }: { status: Agreement['status'] }) {
  const cls: Record<string, string> = {
    active: 'bg-verified/10 text-verified',
    draft: 'bg-charcoal/5 text-charcoal/60',
    pending_landlord: 'bg-amber-100 text-amber-700',
    pending_tenant: 'bg-blue-50 text-blue-700',
    expired: 'bg-charcoal/5 text-charcoal/50',
    terminated: 'bg-red-50 text-red-600',
  }
  const label: Record<string, string> = {
    active: 'Active',
    draft: 'Draft',
    pending_landlord: 'Awaiting Landlord',
    pending_tenant: 'Awaiting Your Signature',
    expired: 'Expired',
    terminated: 'Terminated',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls[status] || cls.draft}`}>
      {label[status] || status}
    </span>
  )
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—'
}

export default function AgreementsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [selected, setSelected] = useState<string | null>(null)
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
        const list: Agreement[] = data.data || data.agreements || []
        setAgreements(list)
        setSelected(list[0]?._id ?? null)
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

  const propTitle = (a: Agreement) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Rental Agreement'

  const propAddress = (a: Agreement) => {
    if (typeof a.propertyId !== 'object' || !a.propertyId?.location) return ''
    const loc = a.propertyId.location
    return [loc.address, loc.subCity].filter(Boolean).join(', ')
  }

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-charcoal">Rental Agreements</h1>
          <p className="mt-1 text-sm text-charcoal/60">View and manage your digital rental agreements.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : agreements.length === 0 ? (
          <EmptyState
            icon="document"
            title="No agreements yet"
            description="Once you apply for a property and the landlord accepts, your rental agreement will appear here."
            actionLabel="Browse Properties"
            actionHref="/explore"
          />
        ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* Agreement list */}
          <div className="divide-y divide-charcoal/10 rounded-xl border border-charcoal/10 bg-white">
            {agreements.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => setSelected(a._id)}
                className={`w-full p-4 text-left transition-colors ${
                  selected === a._id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-charcoal/40">{a._id.slice(-8)}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-charcoal">{propTitle(a)}</p>
                <p className="text-xs text-charcoal/50">{formatEtb(a.monthlyRentEtb)}/mo · {fmtDate(a.startDate)} → {fmtDate(a.endDate)}</p>
              </button>
            ))}
          </div>

          {/* Agreement detail */}
          {active ? (
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-stamp">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-charcoal/40">{active._id.slice(-8)}</span>
                    <StatusBadge status={active.status} />
                  </div>
                  <h2 className="mt-1 font-display text-xl font-bold text-charcoal">{propTitle(active)}</h2>
                  {propAddress(active) && <p className="text-sm text-charcoal/60">{propAddress(active)}</p>}
                </div>
                {active.status === 'active' && (
                  <span className="flex items-center gap-1 rounded-full bg-verified/10 px-3 py-1 text-xs font-semibold text-verified">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z"/></svg>
                    Legally Binding
                  </span>
                )}
              </div>

              {/* Parties signature status */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-cream/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">Tenant</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {active.tenantSigned ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-verified">
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z"/></svg>
                        Signed
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600">Awaiting signature</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-cream/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">Landlord</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {active.landlordSigned ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-verified">
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z"/></svg>
                        Signed
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600">Awaiting signature</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Terms */}
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-cream/60 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Monthly Rent</p>
                  <p className="mt-1 font-display text-lg font-bold text-rust">{formatEtb(active.monthlyRentEtb)}</p>
                </div>
                <div className="rounded-lg bg-cream/60 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Security Deposit</p>
                  <p className="mt-1 font-display text-lg font-bold text-charcoal">{formatEtb(active.depositAmount)}</p>
                </div>
                <div className="rounded-lg bg-cream/60 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Lease Start</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal">{fmtDate(active.startDate)}</p>
                </div>
                <div className="rounded-lg bg-cream/60 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Lease End</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal">{fmtDate(active.endDate)}</p>
                </div>
              </div>

              {/* Terms */}
              {active.terms && active.terms.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-display text-sm font-semibold text-charcoal">Terms &amp; Conditions</h3>
                  <ol className="mt-3 space-y-2">
                    {active.terms.map((term, i) => (
                      <li key={i} className="flex gap-2 text-sm text-charcoal/70 leading-relaxed">
                        <span className="shrink-0 font-mono text-xs text-charcoal/30">{i + 1}.</span>
                        {term}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="mt-4 text-[11px] text-charcoal/40">
                Agreement created on {new Date(active.createdAt).toLocaleDateString()}. Digital signatures are legally binding under Ethiopian electronic transaction regulations.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-charcoal/10 bg-white p-12 text-sm text-charcoal/40">
              Select an agreement to view details.
            </div>
          )}
        </div>
        )}
      </main>
    </>
  )
}
