import Link from 'next/link'

const FOOTER_SECTIONS = [
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/about#blog' },
      { label: 'Press', href: '/about#press' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/support' },
      { label: 'Safety Tips', href: '/support#safety' },
      { label: 'Guides', href: '/how-it-works' },
      { label: 'Contact Us', href: '/support#contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
    ],
  },
]

export default function Footer() {
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
              A trusted digital housing platform connecting tenants, landlords, and communities across Ethiopia.
            </p>
          </div>

          {/* Links columns */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-cream/45">
                {section.title}
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
          <p>© {new Date().getFullYear()} HomeLink Ethiopia. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-white transition-colors">Sitemap</Link>
            <span>·</span>
            <Link href="/support" className="hover:text-white transition-colors">Accessibility</Link>
            <span>·</span>
            <span className="font-mono text-white/80">EN / አማ</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
