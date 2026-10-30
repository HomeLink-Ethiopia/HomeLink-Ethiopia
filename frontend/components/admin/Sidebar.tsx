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
    { label: t.sidebar?.dashboard || 'Dashboard', href: '/admin/dashboard', icon: 'grid' },
    
    // Core Tenancy Operations (Aligned with Landlord & Tenant sides)
    { label: 'Properties', href: '/admin/properties', icon: 'house' },
    { label: 'Rental Agreements', href: '/admin/agreements', icon: 'doc' },
    { label: 'Applications', href: '/admin/applications', icon: 'clipboard' },
    { label: 'Maintenance', href: '/admin/maintenance', icon: 'tools' },

    // Trust & Verification
    { label: t.sidebar?.landlordVerification || 'Landlord Verification', href: '/admin/landlord-verification', icon: 'user' },
    { label: t.sidebar?.propertyVerification || 'Property Verification', href: '/admin/property-verification', icon: 'check' },
    { label: t.sidebar?.fraudReports || 'Fraud Reports', href: '/admin/fraud-reports', icon: 'flag' },
    { label: t.sidebar?.disputes || 'Disputes', href: '/admin/disputes', icon: 'scale' },

    // Financials & Administration
    { label: t.sidebar?.reports || 'Financial Ledgers', href: '/admin/reports', icon: 'creditCard' },
    { label: t.sidebar?.users || 'Users', href: '/admin/users', icon: 'users' },
    { label: t.sidebar?.analytics || 'Analytics', href: '/admin/analytics', icon: 'chart' },
    { label: t.sidebar?.marketInsights || 'Market Insights', href: '/admin/market-insights', icon: 'trend' },
    { label: t.sidebar?.auditLogs || 'Audit Logs', href: '/admin/audit-logs', icon: 'log' },
    { label: t.sidebar?.supportRequests || 'Support Requests', href: '/admin/support-requests', icon: 'mail' },
    { label: 'Messages', href: '/admin/messages', icon: 'chat' },
  ]

  const ICON_PATH: Record<string, string> = {
    home: 'M3 10l7-6 7 6M5 9v7h10V9',
    grid: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
    check: 'M4 4h9l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zM6.5 10l2 2 4-4.5',
    user: 'M10 10a3 3 0 100-6 3 3 0 000 6zM4 17c0-3.3 2.7-6 6-6s6 2.7 6 6',
    users: 'M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 16v-1a4 4 0 00-3-3.87M4 16v-1a4 4 0 013-3.87',
    house: 'M3 9.5L10 4l7 5.5V17a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9.5z',
    doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    tools: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    flag: 'M5 17V3M5 4h9l-2.5 3L14 10H5',
    scale: 'M10 2v16M4 6l-3 6a3 3 0 006 0l-3-6zM16 6l-3 6a3 3 0 006 0l-3-6zM4 6h12',
    chart: 'M4 16V9M10 16V4M16 16v-6',
    trend: 'M3 14l5-5 3 3 6-6M13 6h4v4',
    log: 'M5 2h7l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1zM6 8h8M6 11h8M6 14h5',
    mail: 'M3 5h14v10H3zM3 5l7 6 7-6',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    creditCard: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    settings: 'M10 13a3 3 0 100-6 3 3 0 000 6zM3 10h1M16 10h1M10 3v1M10 16v1M5 5l.7.7M14.3 14.3l.7.7M5 15l.7-.7M14.3 5.7l.7-.7',
    logout: 'M11 16l4-4m0 0l-4-4m4 4H5m0-8v16',
  }

  function NavIcon({ name }: { name: string }) {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-[18px] w-[18px] shrink-0">
        <path d={ICON_PATH[name] || ICON_PATH.grid} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
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
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-rust text-white shadow-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 2l8 6.5V18H2V8.5L10 2z" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold tracking-wide">HomeLink</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-cream/50">Admin Center</p>
            </div>
          </Link>
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

        <nav className="mt-8 flex-1 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? 'bg-rust font-semibold text-white shadow-sm'
                    : 'text-cream/70 hover:bg-white/5 hover:text-cream'
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 pt-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-cream/60 hover:bg-white/5 hover:text-cream"
          >
            <NavIcon name="home" />
            <span>Public Site</span>
          </Link>
          <Link
            href="/logout"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-cream/60 hover:bg-white/5 hover:text-red-400"
          >
            <NavIcon name="logout" />
            <span>Sign Out</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
