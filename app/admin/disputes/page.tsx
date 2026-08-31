'use client'

import { useState } from 'react'
import Image from 'next/image'
import TopBar from '@/components/admin/TopBar'
import { DISPUTES, DISPUTE_STATUS_BADGE_CLASS, type Dispute } from '@/lib/adminDisputes'

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>(DISPUTES)
  const [activeId, setActiveId] = useState<string>(DISPUTES[0].id)
  const [message, setMessage] = useState('')

  const active = disputes.find((d) => d.id === activeId) ?? disputes[0]

  function sendMessage() {
    if (!message.trim()) return
    setDisputes((prev) =>
      prev.map((d) =>
        d.id === active.id
          ? { ...d, thread: [...d.thread, { from: 'Admin', text: message.trim(), time: 'Just now' }], status: 'In Mediation' }
          : d
      )
    )
    setMessage('')
  }

  function resolve() {
    setDisputes((prev) => prev.map((d) => (d.id === active.id ? { ...d, status: 'Resolved' } : d)))
  }

  return (
    <>
      <TopBar title="Disputes" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <div className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-white">
            {disputes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveId(d.id)}
                className={`w-full p-4 text-left transition-colors ${activeId === d.id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-charcoal/40">{d.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DISPUTE_STATUS_BADGE_CLASS[d.status]}`}>
                    {d.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-charcoal">{d.title}</p>
                <p className="truncate text-xs text-charcoal/50">{d.tenantName} vs {d.landlordName}</p>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-charcoal/40">{active.id}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DISPUTE_STATUS_BADGE_CLASS[active.status]}`}>
                    {active.status}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-lg font-semibold text-charcoal">{active.title}</h2>
                <p className="text-xs text-charcoal/40">Filed {active.filedOn}</p>
              </div>
              {active.status !== 'Resolved' ? (
                <button
                  type="button"
                  onClick={resolve}
                  className="shrink-0 rounded bg-verified px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Mark Resolved
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-6 border-y border-charcoal/10 py-3">
              <div className="flex items-center gap-2">
                <span className="relative h-8 w-8 overflow-hidden rounded-full bg-sand">
                  <Image src={active.tenantAvatar} alt={active.tenantName} fill sizes="32px" className="object-cover" />
                </span>
                <div>
                  <p className="text-xs text-charcoal/40">Tenant</p>
                  <p className="text-sm font-medium text-charcoal">{active.tenantName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative h-8 w-8 overflow-hidden rounded-full bg-sand">
                  <Image src={active.landlordAvatar} alt={active.landlordName} fill sizes="32px" className="object-cover" />
                </span>
                <div>
                  <p className="text-xs text-charcoal/40">Landlord</p>
                  <p className="text-sm font-medium text-charcoal">{active.landlordName}</p>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Evidence</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.evidence.map((e) => (
                  <span key={e} className="rounded border border-charcoal/15 bg-cream px-2.5 py-1 text-xs text-charcoal/70">
                    {e}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Communication</h3>
              <div className="mt-2 space-y-2">
                {active.thread.map((m, i) => (
                  <div key={i} className="rounded bg-cream p-2.5">
                    <p className="text-xs font-medium text-charcoal">{m.from} <span className="font-normal text-charcoal/40">· {m.time}</span></p>
                    <p className="mt-0.5 text-sm text-charcoal/70">{m.text}</p>
                  </div>
                ))}
              </div>

              {active.status !== 'Resolved' ? (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Message both parties…"
                    className="flex-1 rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm text-charcoal focus:border-rust focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    className="rounded bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust-dark"
                  >
                    Send
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
