'use client'

import { useState } from 'react'
import Image from 'next/image'
import TopBar from '@/components/admin/TopBar'
import { FRAUD_REPORTS, FRAUD_STATUS_BADGE_CLASS, type FraudReport } from '@/lib/adminFraudReports'

export default function FraudReportsPage() {
  const [reports, setReports] = useState<FraudReport[]>(FRAUD_REPORTS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const active = reports.find((r) => r.id === activeId) ?? null

  function addNote() {
    if (!active || !noteDraft.trim()) return
    setReports((prev) =>
      prev.map((r) => (r.id === active.id ? { ...r, notes: [...r.notes, noteDraft.trim()], status: 'Investigating' } : r))
    )
    setNoteDraft('')
  }

  function close() {
    if (!active) return
    setReports((prev) => prev.map((r) => (r.id === active.id ? { ...r, status: 'Closed' } : r)))
    setActiveId(null)
  }

  return (
    <>
      <TopBar title="Fraud Reports" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
          <div className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-white">
            {reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveId(r.id)}
                className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${
                  activeId === r.id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'
                }`}
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-sand">
                  <Image src={r.subjectAvatar} alt={r.subjectTitle} fill sizes="44px" className="object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-charcoal/40">{r.id}</span>
                    <span className="truncate text-sm font-medium text-charcoal">{r.subjectTitle}</span>
                  </div>
                  <p className="truncate text-xs text-charcoal/50">{r.type} · Reported by {r.reportedBy}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${FRAUD_STATUS_BADGE_CLASS[r.status]}`}>
                  {r.status}
                </span>
              </button>
            ))}
          </div>

          <div className="h-fit rounded-lg border border-charcoal/10 bg-white p-5">
            {!active ? (
              <p className="text-sm text-charcoal/40">Select a report to view details.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-charcoal/40">{active.id}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FRAUD_STATUS_BADGE_CLASS[active.status]}`}>
                    {active.status}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-charcoal">{active.subjectTitle}</h2>
                <p className="text-xs text-charcoal/40">{active.type} · Filed {active.filedOn}</p>
                <p className="mt-3 text-sm text-charcoal/70">{active.details}</p>

                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Investigation Notes</h3>
                  <div className="mt-2 space-y-2">
                    {active.notes.length === 0 ? (
                      <p className="text-xs text-charcoal/40">No notes yet.</p>
                    ) : (
                      active.notes.map((n, i) => (
                        <p key={i} className="rounded bg-cream p-2 text-sm text-charcoal/70">{n}</p>
                      ))
                    )}
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={2}
                    placeholder="Add an investigation note…"
                    className="mt-2 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm text-charcoal focus:border-rust focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={addNote}
                      className="flex-1 rounded bg-rust px-3 py-2 text-xs font-medium text-white hover:bg-rust-dark"
                    >
                      Add Note
                    </button>
                    {active.status !== 'Closed' ? (
                      <button
                        type="button"
                        onClick={close}
                        className="flex-1 rounded border border-charcoal/15 px-3 py-2 text-xs font-medium text-charcoal/60 hover:bg-sand"
                      >
                        Close Report
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
