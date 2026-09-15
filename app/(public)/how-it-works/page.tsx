import Link from 'next/link'

export const metadata = {
  title: 'How It Works — HomeLink Ethiopia',
  description: 'Understand how HomeLink Ethiopia makes renting, listing, and verifying homes simple and transparent.',
}

const STEPS = [
  {
    role: 'For Tenants',
    steps: [
      {
        num: '01',
        title: 'Discover & Compare',
        desc: 'Search verified apartments and houses with genuine pricing in ETB, clear photo galleries, and real neighborhood coordinates.',
      },
      {
        num: '02',
        title: 'AI Fair-Rent Estimate',
        desc: 'Review our responsible AI rent estimates to understand market norms before committing or submitting an application.',
      },
      {
        num: '03',
        title: 'Schedule Viewings & Apply',
        desc: 'Book viewing appointments directly and submit your digital rental application with verified proof of identity.',
      },
      {
        num: '04',
        title: 'Digital Tenancy & Payments',
        desc: 'Sign your digital rental agreement, record monthly rent payments, and submit maintenance tickets with real-time status tracking.',
      },
    ],
  },
  {
    role: 'For Landlords',
    steps: [
      {
        num: '01',
        title: 'List & Submit Verification',
        desc: 'List properties with room layouts, amenities, and rent details. Submit ownership verification documents for trust badge approval.',
      },
      {
        num: '02',
        title: 'Review Applications',
        desc: 'Inspect applicant profiles on an interactive Kanban board, request background info, and approve qualified tenants.',
      },
      {
        num: '03',
        title: 'Track Payments & Rent',
        desc: 'Monitor rent collections, automated receipt logs, overdue reminders, and collection rate metrics in your dashboard.',
      },
      {
        num: '04',
        title: 'Manage Maintenance',
        desc: 'Receive tenant maintenance requests, assign registered local service providers, and mark issues resolved.',
      },
    ],
  },
]

export default function HowItWorksPage() {
  return (
    <div className="bg-cream py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-rust">Transparent & Trusted</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal sm:text-4xl">
            How HomeLink Ethiopia Works
          </h1>
          <p className="mt-4 text-base text-charcoal/70">
            A digital housing ecosystem built to close the coordination and trust gap across Ethiopia’s residential rental market.
          </p>
        </div>

        <div className="mt-16 space-y-16">
          {STEPS.map((section) => (
            <div key={section.role} className="rounded-2xl border border-charcoal/10 bg-white p-8 sm:p-12 shadow-stamp">
              <h2 className="font-display text-2xl font-bold text-charcoal">{section.role}</h2>
              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                {section.steps.map((s) => (
                  <div key={s.num} className="relative flex flex-col justify-between rounded-xl bg-sand/30 p-6">
                    <div>
                      <span className="font-mono text-3xl font-bold text-rust">{s.num}</span>
                      <h3 className="mt-4 font-display text-lg font-semibold text-charcoal">{s.title}</h3>
                      <p className="mt-2 text-sm text-charcoal/70 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/explore"
            className="notch inline-block bg-rust px-8 py-3 text-sm font-semibold text-white shadow-stamp hover:bg-rust-dark transition-colors"
          >
            Explore Verified Homes
          </Link>
        </div>
      </div>
    </div>
  )
}
