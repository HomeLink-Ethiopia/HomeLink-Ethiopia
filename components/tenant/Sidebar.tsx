'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/lib/store'

const MAIN_NAV = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Search', href: '/explore', icon: 'search' },
  { label: 'My Dashboard', href: '/tenant/dashboard', icon: 'house' },
  { label: 'Applications', href: '/tenant/applications', icon: 'file' },
  { label: 'Payments', href: '/tenant/payments', icon: 'card' },
  { label: 'Agreements', href: '/tenant/agreements', icon: 'book' },
  { label: 'Messages', href: '/tenant/messages', icon: 'mail' },
  { label: 'Maintenance', href: '/tenant/maintenance', icon: 'wrench' },
] as const

const SECONDARY_NAV = [
  { label: 'Favorites', href: '/tenant/favorites', icon: 'heart' },
  { label: 'Saved Searches', href: '#', icon: 'bookmark' },
] as const

const FOOTER_NAV = [
  { label: 'Profile', href: '#', icon: 'user' },
  { label: 'Settings', href: '#', icon: 'settings' },
  { label: 'Logout', href: '/logout', icon: 'logout' },
] as const

const ICON_PATH: Record<string, string> = {
  home: 'M3 10l7-6 7 6M5 9v7h10V9',
  search: 'M9 3a6 6 0 100 12 6 6 0 000-12zM17 17l-3.5-3.5',
  file: 'M6 2h6l3 3v11a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1zM12 2v3h3',
  house: 'M3 9.5L10 4l7 5.5V17a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9.5z',
  card: 'M3 5h14v10H3zM3 8h14M6 12h3',
  mail: 'M3 5h14v10H3zM3 5l7 6 7-6',
  wrench: 'M12 4a4 4 0 00-5 5l-6 6 3 3 6-6a4 4 0 005-5l-3 3-2-2 3-3z',
  heart: 'M10 17.3s-6.5-3.9-8.5-8.1C.4 6.2 2 3.3 5 3c1.8-.2 3.6.7 5 2.4C11.4 3.7 13.2 2.8 15 3c3 .3 4.6 3.2 3.5 6.2-2 4.2-8.5 8.1-8.5 8.1z',
  bookmark: 'M5 3h10v14l-5-3-5 3z',
  user: 'M10 10a3 3 0 100-6 3 3 0 000 6zM4 17c0-3.3 2.7-6 6-6s6 2.7 6 6',
  settings: 'M10 13a3 3 0 100-6 3 3 0 000 6zM3 10h1M16 10h1M10 3v1M10 16v1M5 5l.7.7M14.3 14.3l.7.7M5 15l.7-.7M14.3 5.7l.7-.7',
  help: 'M10 18a8 8 0 100-16 8 8 0 000 16zM7.8 7.5a2.2 2.2 0 014.2.9c0 1.5-2 1.6-2 3.1M10 14.2v.1',
  book: 'M4 3h9a2 2 0 012 2v11a1.5 1.5 0 00-1.5-1.5H4V3zM4 14.5V3',
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
 * The tenant dashboard's persistent left rail. Only "Home", "Search",
 * and "My Home" point at routes that exist today — everything else in
 * FR-05/06/08/09's dashboard tree is a later phase, so those items are
 * rendered inert (href="#") rather than 404ing.
 *
 * Mobile behavior: below `lg`, this renders as an off-canvas drawer
 * (translate-x-full when closed) driven by `useUIStore().sidebarOpen`,
 * with a tap-to-dismiss backdrop. `TopBar` owns the hamburger button
 * that toggles it. Above `lg`, it's always visible and the drawer
 * state is ignored (see the `lg:` overrides below).
 */
export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  function itemClass(href: string) {
    const active = href !== '#' && pathname === href
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

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Tenant dashboard" onClick={() => setSidebarOpen(false)}>
          {MAIN_NAV.map((item) => (
            <Link key={item.label} href={item.href} className={itemClass(item.href)}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}

          <div className="my-3 border-t border-white/10" />

          {SECONDARY_NAV.map((item) => (
            <Link key={item.label} href={item.href} className={itemClass(item.href)}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}

          <div className="my-3 border-t border-white/10" />

          {FOOTER_NAV.map((item) => (
            <Link key={item.label} href={item.href} className={itemClass(item.href)}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 pt-3">
          <Link href="/support" className={itemClass('#')}>
            <NavIcon name="help" />
            Need help?
          </Link>
          <Link href="/support" className={itemClass('#')}>
            <NavIcon name="book" />
            Help Center
          </Link>
        </div>
      </aside>
    </>
  )
}
