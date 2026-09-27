'use client'

import Link from 'next/link'

/**
 * Sprint 13 — Responsible AI documentation page.
 *
 * The proposal requires the system to document: what data the AI uses,
 * what it decides, what it does NOT decide, the human review process,
 * and how confidence/uncertainty is communicated. This page is that
 * documentation, shown to real users.
 */

const SECTIONS = [
  {
    title: 'What data the AI uses',
    items: [
      'For matching: only the preferences you enter — budget, preferred city/sub-city, property type, bedrooms, amenities. We do not use your race, religion, gender, or any other protected characteristic, and we do not profile you from other behavior.',
      'For rent estimates: real comparable listings on HomeLink — same city and property type, with adjustments for bedrooms, size and amenities. No external or invented data.',
      'For fraud risk: report counts, duplicate images across listings, how a price compares to the area average, verification status and listing age.',
    ],
  },
  {
    title: 'What the AI decides',
    items: [
      'The order of property suggestions in your match list.',
      'The estimated rent range shown on the Add Property form.',
      'The order of the admin review queue for suspicious listings.',
    ],
  },
  {
    title: 'What the AI does NOT decide',
    items: [
      'It never bans, suspends or restricts any account.',
      'It never approves or rejects a landlord or property verification.',
      'It never hides or removes a listing on its own.',
      'It never sets your rent — the estimate is guidance, the final price is agreed between landlord and tenant.',
    ],
  },
  {
    title: 'Human review process',
    items: [
      'Every high-risk listing flagged by the fraud model goes to a human admin, who investigates, records a decision and a written reason.',
      'Dispute resolutions and account suspensions are always decided by admins and recorded in the audit trail (who, what changed, when, decision, reason).',
      'If you disagree with a decision, you can file a dispute and a human mediator reviews it.',
    ],
  },
  {
    title: 'Confidence and uncertainty',
    items: [
      'Match results show every factor score (budget, location, type, bedrooms, amenities, availability) and plain-language reasons — including the negatives — so you can judge for yourself.',
      'Rent estimates state how many comparable listings they are based on and a confidence level (high ≥ 15 comparables, medium ≥ 7, low otherwise). Small samples mean wide ranges.',
      'If there is not enough real data, the AI says so instead of inventing a number.',
    ],
  },
]

export default function AiTransparencyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-rust">Responsible AI</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal">
        How HomeLink uses AI — and where it stops
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal/60">
        HomeLink uses simple, explainable calculations — not black-box models. Every score can be
        traced to real inputs, and important decisions are always made by people. Here is exactly
        what that means.
      </p>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="font-display text-lg font-semibold text-charcoal">{s.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {s.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-charcoal/70">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.title.includes('NOT') ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-charcoal/10 bg-cream p-5">
        <p className="text-sm text-charcoal/70">
          Questions about how a score was calculated for you?{' '}
          <Link href="/tenant/disputes" className="font-medium text-rust hover:text-rust-dark">
            File a dispute
          </Link>{' '}
          and a human on our team will walk you through it.
        </p>
      </div>
    </main>
  )
}
