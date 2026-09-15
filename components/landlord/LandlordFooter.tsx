import Link from 'next/link'

const FOOTER_SECTIONS = [
  {
    title: 'My Account',
    links: [
      { label: 'Dashboard', href: '/landlord/dashboard' },
      { label: 'Properties', href: '/landlord/properties' },
      { label: 'Applications', href: '/landlord/applications' },
      { label: 'Rent Payments', href: '/landlord/rent-payments' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/support' },
      { label: 'Landlord Guide', href: '/how-it-works' },
      { label: 'List Property', href: '/landlord/properties/new' },
      { label: 'Contact Support', href: '/support#contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Landlord Rights', href: '/legal/landlord-rights' },
    ],
  },
]

export default function LandlordFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#1A1614]">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Logo and mission */}
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2 font-display text-base font-bold text-cream">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rust text-white text-sm">
                🏠
              </span>
              <span>HomeLink <span className="text-rust">Ethiopia</span></span>
            </Link>
            <p className="text-xs text-cream/60 leading-relaxed">
              Your trusted housing partner in Ethiopia.
            </p>
          </div>

          {/* Links columns */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cream/45">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
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
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row text-xs text-cream/50">
          <p>© {new Date().getFullYear()} HomeLink Ethiopia. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <Link href="/support" className="hover:text-white transition-colors">Help</Link>
            <span>·</span>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/legal/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
