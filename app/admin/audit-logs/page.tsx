'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface AuditChange {
  field: string
  from: string
  to: string
}

interface AuditLog {
  _id: string
  actorName: string
  actorRole: string
  action: string
  targetType: string
  targetLabel: string
  changes: AuditChange[]
  decision: string
  reason: string
  ip: string
  createdAt: string
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'landlord', label: 'Verification' },
  { key: 'property', label: 'Properties' },
  { key: 'dispute', label: 'Disputes' },
  { key: 'fraud_report', label: 'Fraud' },
  { key: 'user', label: 'Users' },
] as const

const TARGET_BADGES: Record<string, string> = {
  landlord: 'bg-blue-100 text-blue-700',
  property: 'bg-emerald-100 text-emerald-700',
  dispute: 'bg-amber-100 text-amber-700',
  fraud_report: 'bg-red-100 text-red-700',
  user: 'bg-violet-100 text-violet-700',
  system: 'bg-stone-200 text-stone-600',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const getToken = () => localStorage.getItem('hl_token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`${API_URL}/api/v1/audit-logs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setLogs(json.data || [])
    } catch {
      setError('Could not load audit logs. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = logs
    .filter((l) => filter === 'all' || l.targetType === filter)
    .filter(
      (l) =>
        !search ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.targetLabel.toLowerCase().includes(search.toLowerCase()) ||
        l.actorName.toLowerCase().includes(search.toLowerCase()) ||
        l.reason.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <TopBar title="Audit Logs" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-rust text-white'
                    : 'border border-charcoal/10 bg-white text-charcoal/60 hover:bg-sand'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, target, admin, reason…"
            className="w-full rounded-lg border border-charcoal/10 bg-white py-2 px-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none sm:w-72"
          />
        </div>

        {error && <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <div className="divide-y divide-charcoal/10">
              {filtered.map((log) => (
                <div key={log._id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-sand/20">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-xs font-bold text-charcoal/60">
                    {log.actorName
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium capitalize text-charcoal">
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TARGET_BADGES[log.targetType] || TARGET_BADGES.system}`}>
                        {log.targetType.replace(/_/g, ' ')}
                      </span>
                      {log.decision && (
                        <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] font-medium capitalize text-charcoal/60">
                          {log.decision}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-charcoal/60">
                      Target: <span className="font-medium text-charcoal">{log.targetLabel || '—'}</span>
                    </p>
                    {log.reason && <p className="mt-1 text-xs text-charcoal/60">Reason: {log.reason}</p>}
                    {log.changes.length > 0 && (
                      <p className="mt-1 font-mono text-[11px] text-charcoal/50">
                        {log.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join(' · ')}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-charcoal/40">
                      by {log.actorName} · {new Date(log.createdAt).toLocaleString()}
                      {log.ip ? ` · ${log.ip}` : ''}
                    </p>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-charcoal/40">
                  {logs.length === 0
                    ? 'No admin actions recorded yet. Actions appear here as admins review verifications, disputes, and fraud reports.'
                    : 'No audit logs match your filters.'}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-charcoal/40">
          Showing {filtered.length} of {logs.length} audit entries. Every admin action is recorded: who
          reviewed, what changed, when, the decision, and the reason.
        </p>
      </main>
    </>
  )
}
