'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { useLanguage } from '@/lib/language-context'

export default function TopNav() {
  const { locale, setLocale, t } = useLanguage()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  
  const PRIMARY_LINKS = [
    { label: t.common.explore, href: '/explore' },
    { label: t.common.howItWorks, href: '/how-it-works' },
    { label: t.common.listProperty, href: '/list-property' },
    { label: t.common.about, href: '/about' },
    { label: t.common.support, href: '/support' },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchInput.trim())}`)
      setSearchInput('')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-charcoal/10 bg-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Logo href="/" className="shrink-0" />

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md">
          <form onSubmit={handleSearch} className="relative w-full">
            <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.hero.searchPlaceholder || "Addis Ababa..."}
              className="w-full rounded-lg border border-charcoal/15 bg-white pl-10 pr-4 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
            />
          </form>
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-charcoal/70 transition-colors hover:text-rust"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-3 md:flex shrink-0">
          <button
            type="button"
            onClick={() => setLocale(locale === 'EN' ? 'AM' : 'EN')}
            className="rounded border border-charcoal/15 px-3 py-1.5 font-mono text-xs font-medium text-charcoal/70 transition-colors hover:border-rust hover:text-rust"
            aria-label="Switch language"
          >
            {locale}
          </button>
          <span className="text-charcoal/30">|</span>
          <Link
            href="/login"
            className="text-sm font-medium text-charcoal/70 transition-colors hover:text-rust"
          >
            {t.common.login}
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-rust px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rust-dark transition-colors"
          >
            {t.common.signup}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="flex items-center justify-center rounded p-2 text-charcoal md:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          <span className="sr-only">Menu</span>
          <div className="space-y-1.5">
            <span className="block h-0.5 w-6 bg-charcoal" />
            <span className="block h-0.5 w-6 bg-charcoal" />
            <span className="block h-0.5 w-6 bg-charcoal" />
          </div>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <nav className="border-t border-charcoal/10 bg-white px-4 pb-4 md:hidden" aria-label="Primary mobile">
          <div className="flex flex-col gap-1 pt-2">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-2 py-2.5 text-sm font-medium text-charcoal/80 hover:bg-sand hover:text-rust"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-charcoal/10 pt-3">
              <button
                type="button"
                onClick={() => setLocale(locale === 'EN' ? 'AM' : 'EN')}
                className="rounded border border-charcoal/15 px-2.5 py-1 font-mono text-xs font-medium text-charcoal/70"
              >
                {locale}
              </button>
              <Link
                href="/login"
                className="rounded-lg border border-rust px-4 py-2 text-center text-sm font-semibold text-rust hover:bg-rust/5 transition-colors"
              >
                {t.common.login}
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-lg bg-rust px-5 py-2 text-center text-sm font-semibold text-white shadow-sm"
              >
                {t.common.signup}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
