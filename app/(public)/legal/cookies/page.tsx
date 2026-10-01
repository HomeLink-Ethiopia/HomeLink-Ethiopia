import Link from 'next/link'

export const metadata = {
  title: 'Cookie Policy — HomeLink Ethiopia',
  description: 'The cookies HomeLink Ethiopia uses and why.',
}

export default function CookiesPage() {
  return (
    <div className="bg-cream py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-rust">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal sm:text-4xl">Cookie Policy</h1>
        <p className="mt-1 text-sm text-charcoal/60">Last updated: September 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-charcoal/75">
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">Essential cookies only</h2>
            <p className="mt-2">
              HomeLink Ethiopia does not use advertising or third-party tracking cookies. We set a minimal set of
              first-party cookies that are required for the site to function.
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-charcoal/10 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-sand/40 uppercase tracking-wider text-charcoal/50">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Cookie</th>
                    <th className="px-4 py-2.5 font-medium">Purpose</th>
                    <th className="px-4 py-2.5 font-medium">Lifetime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/8">
                  <tr>
                    <td className="px-4 py-2.5 font-mono">session_role</td>
                    <td className="px-4 py-2.5">Remembers which dashboard (tenant / landlord / admin) you are using</td>
                    <td className="px-4 py-2.5">Session</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono">homelink-language</td>
                    <td className="px-4 py-2.5">Stores your language preference (English / Amharic)</td>
                    <td className="px-4 py-2.5">1 year</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono">hl_token / hl_user</td>
                    <td className="px-4 py-2.5">Keeps you signed in (stored in localStorage, cleared on sign-out)</td>
                    <td className="px-4 py-2.5">Until sign-out</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">Managing cookies</h2>
            <p className="mt-2">
              You can clear or block these cookies in your browser settings; the site will still load, but you
              will need to sign in again and your language choice may reset. Questions? Message us from the{' '}
              <Link href="/support" className="font-semibold text-rust hover:text-rust-dark">Help &amp; Support</Link> page.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
