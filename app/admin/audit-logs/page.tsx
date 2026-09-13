'use client'

import { useState } from 'react'
import Image from 'next/image'
import TopBar from '@/components/admin/TopBar'
import { AUDIT_LOGS, getTargetTypeBadge, type AuditLog } from '@/lib/adminAudit'

const ACTION_FILTERS = ['All', 'Verification', 'Fraud', 'Disputes', 'System'] as const

function filterLogs(logs: AuditLog[], filter: string): AuditLog[] {
  if (filter === 'All') return logs
  if (filter === 'Verification') return logs.filter((l) => l.targetType === 'landlord' || l.targetType === 'property')
  if (filter === 'Fraud') return logs.filter((l) => l.targetType === 'fraud_report')
  if (filter === 'Disputes') return logs.filter((l) => l.targetType === 'dispute')
  if (filter === 'System') return logs.filter((l) => l.targetType === 'system')
  return logs
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

export default function AuditLogsPage() {
  const [filter, setFilter] = useState<typeof ACTION_FILTERS[number]>('All')
  const [search, setSearch] = useState('')
  const logs = AUDIT_LOGS

  const filtered = filterLogs(logs, filter).filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase()) ||
      l.adminName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <TopBar title="Audit Logs" />

      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f ? 'bg-rust text-white' : 'bg-white text-charcoal/60 border border-charcoal/10 hover:bg-sand'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40">
              <path d="M9 3a6 6 0 100 12 6 6 0 000-12zM17 17l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs…"
              className="w-full rounded-lg border border-charcoal/10 bg-white py-2 pl-9 pr-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none sm:w-64"
            />
          </div>
        </div>

        {/* Log entries */}
        <div className="rounded-xl border border-charcoal/10 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-charcoal/8">
            {filtered.map((log) => {
              const { date, time } = formatTimestamp(log.timestamp)
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-sand/20">
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-sand">
                    <Image src={log.adminAvatar} alt={log.adminName} fill sizes="36px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-charcoal">{log.action}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getTargetTypeBadge(log.targetType)}`}>
                        {log.targetType.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-charcoal/60">
                      Target: <span className="font-medium text-charcoal">{log.target}</span>
                    </p>
                    <p className="mt-1 text-xs text-charcoal/50 leading-relaxed">{log.details}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-charcoal/40">
                      <span>by {log.adminName}</span>
                      <span>·</span>
                      <span>{date} at {time}</span>
                      <span>·</span>
                      <span className="font-mono">{log.ip}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-charcoal/40">
                No audit logs match your filters.
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-charcoal/40">
          Showing {filtered.length} of {logs.length} audit entries. All admin actions are recorded for compliance and security review.
        </p>
      </main>
    </>
  )
}
