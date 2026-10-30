'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Agreement {
  _id: string
  propertyId?: {
    _id?: string
    title?: string
    location?: { city?: string; subCity?: string; neighborhood?: string; address?: string }
    rentAmount?: number
    images?: { url?: string }[]
  } | string
  tenantId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
  landlordId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
  status: 'active' | 'pending_signatures' | 'terminated' | 'expired'
  rentAmount: number
  depositAmount: number
  paymentDueDay?: number
  paymentFrequency?: string
  startDate?: string
  endDate?: string
  terms?: string[]
  specialConditions?: string
  tenantSignedAt?: string | null
  landlordSignedAt?: string | null
  createdAt?: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending_signatures: 'bg-amber-50 text-amber-700 border-amber-200',
  terminated: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-stone-100 text-stone-600 border-stone-200',
}

const FILTERS = ['all', 'active', 'pending_signatures', 'terminated'] as const

function fmtEtb(n?: number) {
  return n !== undefined && !isNaN(n) ? `ETB ${n.toLocaleString('en-US')}` : '0 ETB'
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

export default function AdminAgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [search, setSearch] = useState('')
  const [inspectAgreement, setInspectAgreement] = useState<Agreement | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/admin/agreements`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Could not fetch agreements')
      const json = await res.json()
      setAgreements(json.data || [])
    } catch {
      setError('Could not load rental agreements. Ensure backend is running and you are signed in as administrator.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getPropTitle = (a: Agreement) => {
    if (typeof a.propertyId === 'object' && a.propertyId?.title) return a.propertyId.title
    return 'Residential Rental'
  }

  const getPropLocation = (a: Agreement) => {
    if (typeof a.propertyId === 'object' && a.propertyId?.location) {
      const loc = a.propertyId.location
      return [loc.neighborhood, loc.subCity, loc.city].filter(Boolean).join(', ') || 'Addis Ababa'
    }
    return 'Addis Ababa'
  }

  const getTenantName = (a: Agreement) => {
    if (typeof a.tenantId === 'object' && a.tenantId) {
      return `${a.tenantId.firstName || ''} ${a.tenantId.lastName || ''}`.trim() || a.tenantId.email || 'Tenant'
    }
    return 'Tenant'
  }

  const getLandlordName = (a: Agreement) => {
    if (typeof a.landlordId === 'object' && a.landlordId) {
      return `${a.landlordId.firstName || ''} ${a.landlordId.lastName || ''}`.trim() || a.landlordId.email || 'Landlord'
    }
    return 'Landlord'
  }

  const filtered = agreements
    .filter((a) => filter === 'all' || a.status === filter)
    .filter((a) => {
      if (!search.trim()) return true
      const s = search.toLowerCase()
      const title = getPropTitle(a).toLowerCase()
      const tenant = getTenantName(a).toLowerCase()
      const landlord = getLandlordName(a).toLowerCase()
      const loc = getPropLocation(a).toLowerCase()
      return title.includes(s) || tenant.includes(s) || landlord.includes(s) || loc.includes(s)
    })

  const activeCount = agreements.filter((a) => a.status === 'active').length
  const pendingCount = agreements.filter((a) => a.status === 'pending_signatures').length
  const totalRentVolume = agreements.filter((a) => a.status === 'active').reduce((acc, a) => acc + (a.rentAmount || 0), 0)
  const totalEscrowVolume = agreements.filter((a) => a.status === 'active').reduce((acc, a) => acc + (a.depositAmount || 0), 0)

  return (
    <>
      <TopBar title="Rental Agreements & Leases" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-charcoal">Digital Tenancy Agreements</h1>
          <p className="text-sm text-charcoal/60">
            Oversee, inspect, and verify all legally-binding digital leases between landlords and tenants across Ethiopia.
          </p>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-charcoal/50">Total Agreements</p>
            <p className="mt-1 font-display text-2xl font-bold text-charcoal">{agreements.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-800">Active Leases</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-amber-800">Pending Signatures</p>
            <p className="mt-1 font-display text-2xl font-bold text-amber-700">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-blue-800">Total Escrow (Deposits)</p>
            <p className="mt-1 font-display text-2xl font-bold text-blue-700">{fmtEtb(totalEscrowVolume)}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-rust text-white shadow-sm'
                    : 'border border-charcoal/10 bg-white text-charcoal/70 hover:bg-sand'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property, tenant, or landlord…"
            className="w-full rounded-lg border border-charcoal/10 bg-white py-2 px-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none sm:w-72"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</p>}

        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No agreements found"
            description="No rental agreements match your current filter or search criteria."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <div className="divide-y divide-charcoal/10">
              {filtered.map((a) => {
                const tenantName = getTenantName(a)
                const landlordName = getLandlordName(a)
                const propTitle = getPropTitle(a)
                const loc = getPropLocation(a)
                const tenantSigned = Boolean(a.tenantSignedAt)
                const landlordSigned = Boolean(a.landlordSignedAt)

                return (
                  <div key={a._id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-sand/15">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-charcoal">{propTitle}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[a.status] || STATUS_STYLES.expired}`}>
                          {a.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/60">
                        📍 {loc} · Lease: {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal/70">
                        <span>👤 <strong className="text-charcoal">Tenant:</strong> {tenantName}</span>
                        <span>🔑 <strong className="text-charcoal">Landlord:</strong> {landlordName}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                      <div className="text-right">
                        <p className="font-semibold text-charcoal">{fmtEtb(a.rentAmount)} <span className="text-xs font-normal text-charcoal/50">/month</span></p>
                        <p className="text-[11px] text-charcoal/50">Deposit in Escrow: {fmtEtb(a.depositAmount)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${tenantSigned ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {tenantSigned ? '✓ Tenant Signed' : '⏳ Tenant Pending'}
                        </span>
                        <span className="text-charcoal/30">·</span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${landlordSigned ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {landlordSigned ? '✓ Landlord Signed' : '⏳ Landlord Pending'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setInspectAgreement(a)}
                        className="rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
                      >
                        Inspect Lease
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Lease Inspection Modal */}
        {inspectAgreement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-charcoal">Official Lease Agreement</h2>
                  <p className="text-xs text-charcoal/50">Agreement ID: {inspectAgreement._id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectAgreement(null)}
                  className="rounded-lg p-1.5 text-charcoal/50 hover:bg-sand hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Property & Rent Summary */}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-sand/30 p-4">
                  <div>
                    <p className="text-charcoal/50">Property</p>
                    <p className="font-semibold text-charcoal">{getPropTitle(inspectAgreement)}</p>
                    <p className="text-[11px] text-charcoal/60">{getPropLocation(inspectAgreement)}</p>
                  </div>
                  <div>
                    <p className="text-charcoal/50">Monthly Rent</p>
                    <p className="font-bold text-rust">{fmtEtb(inspectAgreement.rentAmount)} / month</p>
                    <p className="text-[11px] text-charcoal/60">Deposit: {fmtEtb(inspectAgreement.depositAmount)} (in Escrow)</p>
                  </div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-charcoal/10 p-4">
                  <div>
                    <p className="font-semibold text-charcoal">Tenant Party</p>
                    <p className="text-charcoal/80">{getTenantName(inspectAgreement)}</p>
                    {typeof inspectAgreement.tenantId === 'object' && inspectAgreement.tenantId?.email && (
                      <p className="text-[11px] text-charcoal/50">{inspectAgreement.tenantId.email}</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-emerald-700">
                      {inspectAgreement.tenantSignedAt ? `Digitally signed on ${fmtDate(inspectAgreement.tenantSignedAt)}` : 'Signature Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-charcoal">Landlord Party</p>
                    <p className="text-charcoal/80">{getLandlordName(inspectAgreement)}</p>
                    {typeof inspectAgreement.landlordId === 'object' && inspectAgreement.landlordId?.email && (
                      <p className="text-[11px] text-charcoal/50">{inspectAgreement.landlordId.email}</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-emerald-700">
                      {inspectAgreement.landlordSignedAt ? `Digitally signed on ${fmtDate(inspectAgreement.landlordSignedAt)}` : 'Signature Pending'}
                    </p>
                  </div>
                </div>

                {/* Terms and conditions */}
                <div>
                  <p className="font-semibold text-charcoal">Standard Rental Terms (Ethiopian Civil Code):</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-charcoal/70">
                    {(inspectAgreement.terms && inspectAgreement.terms.length > 0 ? inspectAgreement.terms : [
                      "Rent is due on the 5th of each month via certified bank transfer, CBE, or Telebirr.",
                      "A security deposit is held in escrow until lease expiration.",
                      "Tenant agrees to maintain property and report damages promptly.",
                      "Compliant with the Federal Democratic Republic of Ethiopia housing regulations."
                    ]).map((term, i) => (
                      <li key={i}>{term}</li>
                    ))}
                  </ul>
                </div>

                {inspectAgreement.specialConditions && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <p className="font-semibold text-amber-900">Special Conditions:</p>
                    <p className="mt-1 text-amber-800">{inspectAgreement.specialConditions}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-charcoal/10 pt-4">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-charcoal/15 bg-white px-4 py-2 text-xs font-semibold text-charcoal hover:bg-sand"
                >
                  Print Lease Record
                </button>
                <button
                  type="button"
                  onClick={() => setInspectAgreement(null)}
                  className="rounded-lg bg-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal/90"
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

