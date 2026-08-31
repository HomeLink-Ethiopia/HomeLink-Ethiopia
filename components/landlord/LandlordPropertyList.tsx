'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LANDLORD_PROPERTIES,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  statusCounts,
  type PropertyStatus,
} from '@/lib/landlord'

type Tab = 'all' | PropertyStatus

const TABS: { key: Tab; label: (counts: ReturnType<typeof statusCounts>) => string }[] = [
  { key: 'all', label: (c) => `All (${c.all})` },
  { key: 'occupied', label: (c) => `Occupied (${c.occupied})` },
  { key: 'vacant', label: (c) => `Vacant (${c.vacant})` },
  { key: 'maintenance', label: (c) => `Under Maintenance (${c.maintenance})` },
]

function formatEtb(n: number) {
  return `ETB ${n.toLocaleString('en-US')}`
}

export default function LandlordPropertyList() {
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const counts = statusCounts()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LANDLORD_PROPERTIES.filter((p) => {
      const matchesTab = tab === 'all' || p.status === tab
      const matchesQuery =
        q.length === 0 ||
        p.title.toLowerCase().includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        (p.tenantName ?? '').toLowerCase().includes(q)
      return matchesTab && matchesQuery
    })
  }, [tab, query])

  return (
    <div>
      {/* Search + primary CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40"
          >
            <path d="M9 3a6 6 0 100 12 6 6 0 000-12zM17 17l-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties..."
            className="w-full rounded border border-charcoal/10 bg-sand/60 py-2.5 pl-9 pr-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
          />
        </div>

        <Link
          href="/landlord/properties/new"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-rust px-5 py-2.5 text-sm font-medium text-white shadow-stamp transition-colors hover:bg-rust-dark"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
          Add New Property
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mt-6 flex gap-6 overflow-x-auto border-b border-charcoal/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative whitespace-nowrap pb-3 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-rust' : 'text-charcoal/50 hover:text-charcoal'
            }`}
          >
            {t.label(counts)}
            {tab === t.key && (
              <motion.span layoutId="landlord-tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-rust" />
            )}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="mt-2 divide-y divide-charcoal/10">
        <AnimatePresence mode="popLayout">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.03 } }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center"
            >
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-sand">
                <Image src={p.image} alt={p.title} fill sizes="112px" className="object-cover" />
              </div>

              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-charcoal">{p.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-charcoal/60">
                  {p.neighborhood}, Addis Ababa · {formatEtb(p.rentEtb)} / month
                </p>
                <p className="mt-0.5 font-mono text-xs text-charcoal/40">
                  {p.status === 'occupied' && `Rented since ${p.rentedSince}`}
                  {p.status === 'vacant' && `Listed on ${p.listedOn}`}
                  {p.status === 'maintenance' && `Since ${p.maintenanceSince}`}
                </p>
              </div>

              {p.status === 'occupied' && (
                <div className="flex gap-8 sm:justify-end">
                  <div>
                    <p className="text-xs text-charcoal/50">Tenant</p>
                    <p className="text-sm font-medium text-charcoal">{p.tenantName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-charcoal/50">Collection Rate</p>
                    <p className={`text-sm font-medium ${p.collectionRate === 100 ? 'text-verified' : 'text-charcoal'}`}>
                      {p.collectionRate}%
                    </p>
                  </div>
                </div>
              )}

              {p.status === 'vacant' && (
                <div className="flex gap-8 sm:justify-end">
                  <div>
                    <p className="text-xs text-charcoal/50">Views</p>
                    <p className="text-sm font-medium text-charcoal">{p.views}</p>
                  </div>
                  <div>
                    <p className="text-xs text-charcoal/50">Applications</p>
                    <p className="text-sm font-medium text-charcoal">{p.applications}</p>
                  </div>
                </div>
              )}

              {p.status === 'maintenance' && (
                <div className="sm:max-w-[220px] sm:text-right">
                  <p className="text-xs text-charcoal/50">Open issue</p>
                  <p className="text-sm text-charcoal">{p.maintenanceNote}</p>
                </div>
              )}

              <Link
                href={`/property/${p.id}`}
                className="shrink-0 rounded border border-charcoal/15 px-4 py-2 text-center text-sm font-medium text-charcoal transition-colors hover:border-rust hover:text-rust sm:ml-4"
              >
                View Details
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-charcoal/50">No properties match your search.</p>
        )}
      </div>
    </div>
  )
}
