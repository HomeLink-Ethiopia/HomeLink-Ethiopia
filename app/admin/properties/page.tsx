'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ManagedProperty {
  _id: string
  title: string
  rentAmount?: number
  city?: string
  landlordName?: string
  verificationStatus?: string
  listingStatus?: string
  riskLevel?: string
  fraudRiskScore?: number
}

const RISK_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-green-50 text-green-700 border-green-200',
}

const VERIF_STYLE: Record<string, string> = {
  verified: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  unverified: 'bg-gray-50 text-gray-600 border-gray-200',
}

export default function AdminPropertiesPage() {
  const [props, setProps] = useState<ManagedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const getToken = () => localStorage.getItem('hl_token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`${API_URL}/api/v1/admin/properties`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setProps(json.data || [])
    } catch {
      setError('Could not load properties. Are you logged in as admin?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Sprint 12 — moderate listings: suspend (delist) / reinstate.
  async function setListing(id: string, suspend: boolean) {
    setBusyId(id)
    try {
      await fetch(`${API_URL}/api/v1/admin/properties/${id}/moderate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ listingStatus: suspend ? 'suspended' : 'active', reason: suspend ? 'Suspended by admin' : 'Reinstated by admin' }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const filtered = props.filter(
    (p) => !search || p.title?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      <TopBar title="Manage Properties" />
      <main className="flex-1 space-y-5 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-charcoal/60">
            Review listings, check their AI risk level, and suspend anything suspicious.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full rounded-lg border border-charcoal/10 bg-white py-2 px-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none sm:w-64"
          />
        </div>

        {error && <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No properties" description="No listings match this search." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <div className="divide-y divide-charcoal/10">
              {filtered.map((p) => {
                const suspended = p.listingStatus === 'suspended'
                return (
                  <div key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-sand/20">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-charcoal">{p.title || 'Untitled'}</p>
                      <p className="mt-0.5 text-xs text-charcoal/50">
                        {p.city || '—'} · {p.landlordName || 'Unknown landlord'} · ETB {(p.rentAmount || 0).toLocaleString()}/mo
                      </p>
                    </div>
                    {p.riskLevel && (p.fraudRiskScore || 0) > 0 && (
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${RISK_STYLE[p.riskLevel] || RISK_STYLE.low}`}>
                        Risk: {p.riskLevel}
                      </span>
                    )}
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${VERIF_STYLE[p.verificationStatus || 'unverified']}`}>
                      {p.verificationStatus || 'unverified'}
                    </span>
                    {suspended && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                        Suspended
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setListing(p._id, !suspended)}
                      disabled={busyId === p._id}
                      className={`shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        suspended
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {busyId === p._id ? '…' : suspended ? 'Reinstate' : 'Suspend listing'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
