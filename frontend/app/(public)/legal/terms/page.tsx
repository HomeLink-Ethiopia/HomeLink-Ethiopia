import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — HomeLink Ethiopia',
  description: 'The terms governing use of the HomeLink Ethiopia platform.',
}

/**
 * Legal pages (sprint-footer-legal): the footer previously linked to
 * /legal/* pages that did not exist (404s). These pages provide the real
 * policies in concise, plain language.
 */
export default function TermsPage() {
  return (
    <div className="bg-cream py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-rust">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal sm:text-4xl">Terms of Service</h1>
        <p className="mt-1 text-sm text-charcoal/60">Last updated: September 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-charcoal/75">
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">1. Using HomeLink Ethiopia</h2>
            <p className="mt-2">
              HomeLink Ethiopia is a digital housing platform that connects verified landlords with tenants. By
              creating an account you agree to provide accurate information, use the platform lawfully, and treat
              other users with respect. You must be at least 18 years old to enter rental agreements through the
              platform.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">2. Accounts &amp; verification</h2>
            <p className="mt-2">
              Landlords must submit government-issued ID and property ownership documents (title deed or lease
              agreement) before listings receive the Verified badge. HomeLink reviews these documents but cannot
              guarantee the underlying legality of every property; final diligence remains with the parties.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">3. Listings, rent &amp; payments</h2>
            <p className="mt-2">
              Rent amounts shown are in Ethiopian Birr (ETB). The AI fair-rent estimate is a decision-support
              heuristic, not an official appraisal. Rent recorded through the platform is a ledger of obligations
              and receipts; payments made through external channels (e.g. Telebirr, CBE Birr) remain between the
              payer and their bank.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">4. Prohibited conduct</h2>
            <p className="mt-2">
              Fraudulent listings, impersonation, duplicate postings, harassment, and attempts to move users off
              the platform to evade safety controls are prohibited and may result in suspension and reporting to
              Ethiopian authorities.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">5. Disputes &amp; liability</h2>
            <p className="mt-2">
              Disputes raised in the platform are mediated through our structured resolution flow. HomeLink
              Ethiopia&apos;s liability is limited to the fees you paid to us in the 12 months before the claim.
              These terms are governed by the laws of the Federal Democratic Republic of Ethiopia.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-charcoal">6. Contact</h2>
            <p className="mt-2">
              Questions about these terms? Visit our{' '}
              <Link href="/support" className="font-semibold text-rust hover:text-rust-dark">Help &amp; Support</Link>{' '}
              page — messages go directly to our team.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
