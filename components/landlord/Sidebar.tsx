'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/lib/store'
import { useLanguage } from '@/lib/language-context'

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const { t } = useLanguage()

  const MAIN_NAV = [
    { label: t.sidebar.home, href: '/', icon: 'home' },
    { label: t.sidebar.overview, href: '/landlord/dashboard', icon: 'grid' },
    { label: t.sidebar.properties, href: '/landlord/properties', icon: 'house', match: '/landlord/properties' },
    { label: t.sidebar.verification, href: '/landlord/verification', icon: 'check' },
    { label: t.sidebar.applications, href: '/landlord/applications', icon: 'file', badge: 5 },
    { label: t.sidebar.tenants, href: '/landlord/tenants', icon: 'users' },
    { label: t.sidebar.rentPayments, href: '/landlord/rent-payments', icon: 'card' },
    { label: t.sidebar.maintenance, href: '/landlord/maintenance', icon: 'wrench' },
    { label: t.sidebar.reports, href: '#', icon: 'chart' },
    { label: t.sidebar.messages, href: '#', icon: 'mail', badge: 2 },
  ]

  const FOOTER_NAV = [
    { label: t.sidebar.settings, href: '#', icon: 'settings' },
    { label: t.sidebar.logout, href: '/logout', icon: 'logout' },
  ]

const ICON_PATH: Record<string, string> = {
  home: 'M3 10l7-6 7 6M5 9v7h10V9',
  grid: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  house: 'M3 9.5L10 4l7 5.5V17a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9.5z',
  file: 'M6 2h6l3 3v11a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1zM12 2v3h3',
  users: 'M7 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM13 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 17c0-2.8 2.2-5 5-5s5 2.2 5 5M10.5 12.1c2.5.3 4.5 2.3 4.5 4.9',
  card: 'M3 5h14v10H3zM3 8h14M6 12h3',
  wrench: 'M12 4a4 4 0 00-5 5l-6 6 3 3 6-6a4 4 0 005-5l-3 3-2-2 3-3z',
  chart: 'M4 16V9M10 16V4M16 16v-6',
  mail: 'M3 5h14v10H3zM3 5l7 6 7-6',
  settings: 'M10 13a3 3 0 100-6 3 3 0 000 6zM3 10h1M16 10h1M10 3v1M10 16v1M5 5l.7.7M14.3 14.3l.7.7M5 15l.7-.7M14.3 5.7l.7-.7',
  help: 'M10 18a8 8 0 100-16 8 8 0 000 16zM7.8 7.5a2.2 2.2 0 014.2.9c0 1.5-2 1.6-2 3.1M10 14.2v.1',
  support: 'M10 2a8 8 0 018 8M2 10a8 8 0 018-8M4.5 4.5l2.8 2.8M15.5 4.5l-2.8 2.8M4.5 15.5l2.8-2.8M15.5 15.5l-2.8-2.8M6.5 10a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z',
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
 * The landlord dashboard's persistent left rail. Only "Overview" /
 * "Properties" (both point at the one built route) are live — the
 * rest of FR-07's landlord tooling is a later phase, rendered inert
 * (href="#") rather than 404ing, matching the tenant sidebar's
 * convention.
 *
 * Mobile behavior: same off-canvas drawer pattern as the tenant
 * sidebar — see the comment there for details.
 */
  function itemClass(item: (typeof MAIN_NAV)[number] | (typeof FOOTER_NAV)[number]) {
    const target = 'match' in item && item.match ? item.match : item.href
    const active = target !== '#' && pathname === target
    return `flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors ${
      active ? 'bg-rust text-white' : 'text-cream/70 hover:bg-white/5 hover:text-cream'
    }`
  }

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

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Landlord dashboard" onClick={() => setSidebarOpen(false)}>
          {MAIN_NAV.map((item) => (
            <Link key={item.label} href={item.href} className={itemClass(item)}>
              <NavIcon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {'badge' in item && item.badge ? (
                <span className="rounded-full bg-rust px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}

          <div className="my-3 border-t border-white/10" />

          {FOOTER_NAV.map((item) => (
            <Link key={item.label} href={item.href} className={itemClass(item)}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 pt-3">
          <Link href="/support" className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-cream/70 transition-colors hover:bg-white/5 hover:text-cream">
            <NavIcon name="help" />
            {t.sidebar.needHelp}
          </Link>
          <Link href="/support" className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-cream/70 transition-colors hover:bg-white/5 hover:text-cream">
            <NavIcon name="support" />
            {t.sidebar.contactSupport}
          </Link>
        </div>
      </aside>
    </>
  )
}
