'use client'

import { useState } from 'react'
import Image from 'next/image'
import TopBar from '@/components/tenant/TopBar'
import { MOCK_AGREEMENTS, type RentalAgreement } from '@/lib/agreements'
import { personPhoto } from '@/lib/images'

function formatEtb(n: number) {
  return `ETB ${n.toLocaleString()}`
}

function StatusBadge({ status }: { status: RentalAgreement['status'] }) {
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

export default function AgreementsPage() {
  const [selected, setSelected] = useState<string | null>(MOCK_AGREEMENTS[0]?.id ?? null)
  const agreements = MOCK_AGREEMENTS
  const active = agreements.find((a) => a.id === selected)

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-charcoal">Rental Agreements</h1>
          <p className="mt-1 text-sm text-charcoal/60">View and manage your digital rental agreements.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* Agreement list */}
          <div className="divide-y divide-charcoal/10 rounded-xl border border-charcoal/10 bg-white">
            {agreements.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a.id)}
                className={`w-full p-4 text-left transition-colors ${
                  selected === a.id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-charcoal/40">{a.id}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-charcoal">{a.propertyTitle}</p>
                <p className="text-xs text-charcoal/50">{formatEtb(a.monthlyRentEtb)}/mo · {a.leaseStart} → {a.leaseEnd}</p>
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
                    <span className="font-mono text-sm text-charcoal/40">{active.id}</span>
                    <StatusBadge status={active.status} />
                  </div>
                  <h2 className="mt-1 font-display text-xl font-bold text-charcoal">{active.propertyTitle}</h2>
                  <p className="text-sm text-charcoal/60">{active.propertyAddress}</p>
                </div>
                {active.status === 'active' && (
                  <span className="flex items-center gap-1 rounded-full bg-verified/10 px-3 py-1 text-xs font-semibold text-verified">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.4a.75.75 0 00-1-1L7 8.8 5.6 7.4a.75.75 0 10-1 1l2 2c.3.3.8.3 1 0l3.4-3.4z"/></svg>
                    Legally Binding
                  </span>
                )}
              </div>

              {/* Parties */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-cream/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">Tenant</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="relative h-8 w-8 overflow-hidden rounded-full bg-sand">
                      <Image src={personPhoto('tenant-tsedi')} alt={active.tenantName} fill sizes="32px" className="object-cover" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-charcoal">{active.tenantName}</p>
                      <p className="text-[11px] text-charcoal/50">{active.tenantPhone}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {active.signedByTenant ? (
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
                  <div className="mt-2 flex items-center gap-2">
                    <span className="relative h-8 w-8 overflow-hidden rounded-full bg-sand">
                      <Image src={personPhoto('landlord-abebe')} alt={active.landlordName} fill sizes="32px" className="object-cover" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-charcoal">{active.landlordName}</p>
                      <p className="text-[11px] text-charcoal/50">{active.landlordPhone}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {active.signedByLandlord ? (
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
                  <p className="mt-1 font-display text-lg font-bold text-charcoal">{formatEtb(active.depositEtb)}</p>
                </div>
                <div className="rounded-lg bg-cream/60 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Lease Start</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal">{active.leaseStart}</p>
                </div>
                <div className="rounded-lg bg-cream/60 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Lease End</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal">{active.leaseEnd}</p>
                </div>
              </div>

              {/* Terms */}
              <div className="mt-6">
                <h3 className="font-display text-sm font-semibold text-charcoal">Terms & Conditions</h3>
                <ol className="mt-3 space-y-2">
                  {active.terms.map((term, i) => (
                    <li key={i} className="flex gap-2 text-sm text-charcoal/70 leading-relaxed">
                      <span className="shrink-0 font-mono text-xs text-charcoal/30">{i + 1}.</span>
                      {term}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Sign button */}
              {active.status === 'pending_tenant' && (
                <div className="mt-6 flex items-center gap-3 border-t border-charcoal/10 pt-4">
                  <button type="button" className="rounded-lg bg-rust px-6 py-2.5 text-sm font-semibold text-white shadow-stamp hover:bg-rust-dark transition-colors">
                    Sign Agreement
                  </button>
                  <button type="button" className="rounded-lg border border-charcoal/15 px-6 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-sand transition-colors">
                    Request Changes
                  </button>
                </div>
              )}

              <p className="mt-4 text-[11px] text-charcoal/40">
                Agreement created on {active.createdAt}. Digital signatures are legally binding under Ethiopian electronic transaction regulations.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-charcoal/10 bg-white p-12 text-sm text-charcoal/40">
              Select an agreement to view details.
            </div>
          )}
        </div>
      </main>
    </>
  )
}
