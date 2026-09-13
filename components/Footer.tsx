'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'



export default function Footer() {
  const { locale, setLocale, t } = useLanguage()

  const FOOTER_SECTIONS = [
    {
      title: t.footer.company,
      links: [
        { label: t.footer.aboutUs, href: '/about' },
        { label: t.footer.careers, href: '/careers' },
        { label: t.footer.blog, href: '/about#blog' },
        { label: t.footer.press, href: '/about#press' },
      ],
    },
    {
      title: t.footer.resources,
      links: [
        { label: t.footer.helpCenter, href: '/support' },
        { label: t.footer.safetyTips, href: '/support#safety' },
        { label: t.footer.guides, href: '/how-it-works' },
        { label: t.footer.contactUs, href: '/support#contact' },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: t.footer.termsOfService, href: '/legal/terms' },
        { label: t.footer.privacyPolicy, href: '/legal/privacy' },
        { label: t.footer.cookiePolicy, href: '/legal/cookies' },
      ],
    },
  ]

  return (
    <footer className="border-t border-white/10 bg-charcoal text-cream">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
          {/* Logo and mission */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rust text-white text-base">
                🏠
              </span>
              HomeLink <span className="text-rust">Ethiopia</span>
            </Link>
            <p className="text-xs text-cream/65 leading-relaxed max-w-sm">
              {t.footer.description}
            </p>
          </div>

          {/* Links columns */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-cream/45">
                {section.title.toUpperCase()}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-cream/75 transition-colors hover:text-rust"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row text-xs text-cream/50">
          <p>© {new Date().getFullYear()} HomeLink Ethiopia. {locale === 'EN' ? 'All rights reserved.' : 'ሁሉም መብቶች የተጠበቁ ናቸው።'}</p>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-white transition-colors">{locale === 'EN' ? 'Sitemap' : 'የድር ገጽ'}</Link>
            <span>·</span>
            <Link href="/support" className="hover:text-white transition-colors">{locale === 'EN' ? 'Accessibility' : 'ተደራሽነት'}</Link>
            <span>·</span>
            <button
              onClick={() => setLocale(locale === 'EN' ? 'AM' : 'EN')}
              className="font-mono text-white/80 hover:text-white transition-colors cursor-pointer border border-white/20 rounded px-2 py-1"
            >
              {locale === 'EN' ? 'EN / አማ' : 'አማ / EN'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
