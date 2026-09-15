import Link from 'next/link'

export const metadata = {
  title: 'About Us — HomeLink Ethiopia',
  description: 'HomeLink Ethiopia is a trusted national digital housing and tenancy ecosystem.',
}

export default function AboutPage() {
  return (
    <div className="bg-cream py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-rust">Our Mission</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal sm:text-5xl">
            A Trusted Digital Housing Ecosystem for Ethiopia
          </h1>
          <p className="mt-4 text-base text-charcoal/70 leading-relaxed">
            HomeLink Ethiopia closes the critical digital coordination and trust gap within the national rental process.
          </p>
        </div>

        <div className="mt-16 space-y-12">
          {/* Context section */}
          <div id="context" className="rounded-2xl border border-charcoal/10 bg-white p-8 sm:p-10 shadow-stamp">
            <h2 className="font-display text-2xl font-bold text-charcoal">National Problem & Context</h2>
            <p className="mt-4 text-sm text-charcoal/75 leading-relaxed">
              Ethiopia is undergoing rapid urbanization, increasing pressure on urban housing. UN-Habitat and the World Bank have documented significant urban housing deficits. The existing rental market remains fragmented—relying on disconnected listings, informal brokers, and paper records.
            </p>
            <p className="mt-3 text-sm text-charcoal/75 leading-relaxed">
              HomeLink Ethiopia provides digital trust infrastructure: verified landlord and property evidence, responsible AI fair-rent estimation, automated digital tenancy agreements, and structured dispute & maintenance resolution.
            </p>
          </div>

          {/* Core Pillars */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-stamp">
              <span className="font-mono text-xs font-semibold uppercase text-rust">01. Transparency</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-charcoal">Verified Listings</h3>
              <p className="mt-2 text-xs text-charcoal/70 leading-relaxed">
                Every property and landlord passes verification checkpoints to prevent duplicate listings and scams.
              </p>
            </div>
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-stamp">
              <span className="font-mono text-xs font-semibold uppercase text-rust">02. Responsible AI</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-charcoal">Fair-Rent & Safety</h3>
              <p className="mt-2 text-xs text-charcoal/70 leading-relaxed">
                Objective AI rent estimates and fraud-risk detection empower human decision-makers.
              </p>
            </div>
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-stamp">
              <span className="font-mono text-xs font-semibold uppercase text-rust">03. Full Lifecycle</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-charcoal">Digital Tenancy</h3>
              <p className="mt-2 text-xs text-charcoal/70 leading-relaxed">
                From discovery and viewing to agreements, rent records, and maintenance follow-up.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/explore"
            className="notch inline-block bg-rust px-8 py-3 text-sm font-semibold text-white shadow-stamp hover:bg-rust-dark transition-colors"
          >
            Explore Available Homes
          </Link>
        </div>
      </div>
    </div>
  )
}
