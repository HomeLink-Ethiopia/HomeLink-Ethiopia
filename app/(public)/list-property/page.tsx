import Link from 'next/link'
import PropertyWizard from '@/components/landlord/PropertyWizard'

export const metadata = {
  title: 'List Your Property — HomeLink Ethiopia',
  description: 'List your residential property on HomeLink Ethiopia and connect with verified tenants.',
}

export default function ListPropertyPage() {
  return (
    <div className="bg-cream py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-rust font-semibold">Landlord Portal</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal sm:text-4xl">
            List a New Property
          </h1>
          <p className="mt-2 text-sm text-charcoal/70">
            Submit your property details and ownership documents for our rapid verification workflow.
          </p>
        </div>

        <div className="rounded-2xl border border-charcoal/10 bg-white p-6 sm:p-10 shadow-stamp">
          <PropertyWizard />
        </div>

        <div className="mt-8 text-center text-xs text-charcoal/50">
          Already have properties?{' '}
          <Link href="/landlord/dashboard" className="font-semibold text-rust hover:text-rust-dark">
            Go to Landlord Dashboard →
          </Link>
        </div>
      </div>
    </div>
  )
}
