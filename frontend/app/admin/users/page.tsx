'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ManagedUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  verificationStatus: string
  identityStatus: string
  isActive: boolean
  emailVerified: boolean
  reportsAgainst?: number
  disputesAgainst?: number
  createdAt: string
}

const ROLE_FILTERS = ['all', 'tenant', 'landlord', 'admin'] as const

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [suspendTarget, setSuspendTarget] = useState<ManagedUser | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`${API_URL}/api/v1/admin/suspicious/accounts`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setUsers(json.data || [])
    } catch {
      setError('Could not load users. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function setSuspension(user: ManagedUser, suspend: boolean) {
    if (suspend && !reason.trim()) return
    setBusyId(user._id)
    try {
      await fetch(`${API_URL}/api/v1/admin/users/${user._id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ suspend, reason: reason.trim() || 'No reason given' }),
      })
      setSuspendTarget(null)
      setReason('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users
    .filter((u) => roleFilter === 'all' || u.role === roleFilter)
    .filter(
      (u) =>
        !search ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <TopBar title="Manage Users" />
      <main className="flex-1 space-y-5 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  roleFilter === r
                    ? 'bg-rust text-white'
                    : 'border border-charcoal/10 bg-white text-charcoal/60 hover:bg-sand'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-charcoal/10 bg-white py-2 px-3 text-sm focus:border-rust focus:outline-none sm:w-64"
          />
        </div>

        {error && <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <div className="divide-y divide-charcoal/10">
              {filtered.map((u) => (
                <div key={u._id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-charcoal">
                        {u.firstName} {u.lastName}
                      </p>
                      <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] font-medium capitalize text-charcoal/60">
                        {u.role}
                      </span>
                      {!u.isActive && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          Suspended
                        </span>
                      )}
                      {!u.emailVerified && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Email unverified
                        </span>
                      )}
                      {u.reportsAgainst && u.reportsAgainst > 0 && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                          {u.reportsAgainst} fraud report{u.reportsAgainst > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-charcoal/50">
                      {u.email} · {u.phone} · verification: {u.verificationStatus}/{u.identityStatus}
                    </p>
                  </div>
                  {u.role !== 'admin' &&
                    (u.isActive ? (
                      <button
                        type="button"
                        onClick={() => setSuspendTarget(u)}
                        className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === u._id}
                        onClick={() => setSuspension(u, false)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Reinstate
                      </button>
                    ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-charcoal/40">No users match.</div>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-charcoal/40">
          Suspended accounts cannot log in. Every suspension is recorded in the audit trail with the reason.
        </p>

        {/* suspend reason modal */}
        {suspendTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
              <h3 className="font-display text-lg font-semibold text-charcoal">
                Suspend {suspendTarget.firstName} {suspendTarget.lastName}?
              </h3>
              <p className="mt-1 text-sm text-charcoal/60">
                They will be logged out and unable to sign in until reinstated.
              </p>
              <label className="mt-4 block text-sm">
                <span className="text-charcoal/70">Reason (recorded in audit trail) *</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Multiple confirmed fraud reports — fake listings"
                  className="mt-1 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm focus:border-rust focus:outline-none"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuspendTarget(null)
                    setReason('')
                  }}
                  className="rounded border border-charcoal/20 px-4 py-2 text-sm text-charcoal/70 hover:bg-sand"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!reason.trim() || busyId === suspendTarget._id}
                  onClick={() => setSuspension(suspendTarget, true)}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Suspend account
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
