'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/lib/store'
import { useLanguage } from '@/lib/language-context'

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const { t } = useLanguage()

  const NAV = [
    { label: t.sidebar.home, href: '/', icon: 'home' },
    { label: t.sidebar.dashboard, href: '/admin/dashboard', icon: 'grid' },
    { label: t.sidebar.verificationQueue, href: '/admin/verification-queue', icon: 'check' },
    { label: t.sidebar.landlordVerification, href: '/admin/verification-queue', icon: 'user' },
    { label: t.sidebar.propertyVerification, href: '/admin/verification-queue', icon: 'house' },
    { label: t.sidebar.fraudReports, href: '/admin/fraud-reports', icon: 'flag' },
    { label: t.sidebar.disputes, href: '/admin/disputes', icon: 'scale' },
    { label: t.sidebar.riskMonitoring, href: '/admin/risk-monitoring', icon: 'chart' },
    { label: t.sidebar.marketInsights, href: '/admin/market-insights', icon: 'trend' },
    { label: t.sidebar.auditLogs, href: '/admin/audit-logs', icon: 'log' },
  ]

const ICON_PATH: Record<string, string> = {
  home: 'M3 10l7-6 7 6M5 9v7h10V9',
  grid: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  check: 'M4 4h9l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zM6.5 10l2 2 4-4.5',
  user: 'M10 10a3 3 0 100-6 3 3 0 000 6zM4 17c0-3.3 2.7-6 6-6s6 2.7 6 6',
  house: 'M3 9.5L10 4l7 5.5V17a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9.5z',
  flag: 'M5 17V3M5 4h9l-2.5 3L14 10H5',
  scale: 'M10 2v16M4 6l-3 6a3 3 0 006 0l-3-6zM16 6l-3 6a3 3 0 006 0l-3-6zM4 6h12',
  chart: 'M4 16V9M10 16V4M16 16v-6',
  trend: 'M3 14l5-5 3 3 6-6M13 6h4v4',
  log: 'M5 2h7l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1zM6 8h8M6 11h8M6 14h5',
  settings: 'M10 13a3 3 0 100-6 3 3 0 000 6zM3 10h1M16 10h1M10 3v1M10 16v1M5 5l.7.7M14.3 14.3l.7.7M5 15l.7-.7M14.3 5.7l.7-.7',
  logout: 'M11 16l4-4m0 0l-4-4m4 4H5m0-8v16',
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-[18px] w-[18px] shrink-0">
      <path d={ICON_PATH[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The admin dashboard's persistent left rail. "Dashboard" / "Verification
 * Queue" both point at the built Trust & Verification Center; "Market
 * Insights" points at the built analytics page. The rest of FR-10's
 * admin tooling (per-item verification detail, disputes, audit logs) is
 * a later phase, rendered inert (href="#") rather than 404ing.
 *
 * Mobile behavior: same off-canvas drawer pattern as the tenant
 * sidebar — see the comment there for details.
 */
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 -translate-x-full flex-col overflow-y-auto bg-[#1A1614] px-4 py-6 text-cream transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : ''
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-rust text-white">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 2l8 6.5V18H2V8.5L10 2z" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">HomeLink</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-cream/50">Ethiopia</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 text-cream/60 hover:bg-white/5 hover:text-cream lg:hidden"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Admin dashboard" onClick={() => setSidebarOpen(false)}>
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors ${
                  active ? 'bg-rust text-white' : 'text-cream/70 hover:bg-white/5 hover:text-cream'
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 pt-3">
          <Link href="#" className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-cream/70 transition-colors hover:bg-white/5 hover:text-cream">
            <NavIcon name="settings" />
            {t.sidebar.settings}
          </Link>
          <Link href="/logout" className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-cream/70 transition-colors hover:bg-white/5 hover:text-cream">
            <NavIcon name="logout" />
            {t.sidebar.logout}
          </Link>
        </div>
      </aside>
    </>
  )
}
