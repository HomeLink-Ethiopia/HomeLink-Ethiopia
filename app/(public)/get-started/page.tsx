'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const ROLES = [
  {
    role: 'tenant',
    title: 'I am a Tenant',
    desc: 'Find your perfect verified home and manage your tenancy.',
    details: [
      'Browse & filter verified listings',
      'AI-powered home matching',
      'Digital rental applications',
      'Rent payment tracking',
      'Maintenance ticket submission',
    ],
    buttonText: 'Get Started as Tenant',
    accent: '#B8451F',
  },
  {
    role: 'landlord',
    title: 'I am a Landlord',
    desc: 'List, verify, and manage your properties in one place.',
    details: [
      'List & verify properties',
      'Review applicant pipelines',
      'Track rent collection',
      'Manage maintenance tickets',
      'Digital lease agreements',
    ],
    buttonText: 'Get Started as Landlord',
    accent: '#2E7D32',
  },
]

export default function GetStartedPage() {
  const router = useRouter()

  const handleRoleSelect = (role: string) => {
    // Redirect to signup with role pre-selected
    router.push(`/signup?role=${role}`)
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-xs uppercase tracking-widest text-rust font-semibold">Welcome to HomeLink Ethiopia</p>
            <h1 className="mt-3 font-display text-4xl font-bold text-charcoal sm:text-5xl">
              Choose Your Role
            </h1>
            <p className="mt-3 text-base text-charcoal/60">
              Select how you&apos;ll be using HomeLink to access your personalized workspace.
            </p>
          </motion.div>
        </div>

        {/* Role Cards */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.role}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(42,37,33,0.2)' }}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm transition-all"
              style={{ borderRadius: '16px 16px 32px 16px' }}
            >
              {/* Top accent bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: r.accent }} />

              <div className="flex flex-col flex-1 p-8">
                <div>
                  <h2 className="font-display text-2xl font-bold text-charcoal">{r.title}</h2>
                  <p className="mt-2 text-sm text-charcoal/60">{r.desc}</p>
                </div>

                <ul className="mt-6 space-y-2.5">
                  {r.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-2.5 text-sm text-charcoal/80">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0" style={{ color: r.accent }}>
                        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd" />
                      </svg>
                      {detail}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleRoleSelect(r.role)}
                  className="mt-8 w-full py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: r.accent, borderRadius: '8px 8px 20px 8px' }}
                >
                  {r.buttonText} →
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-sm text-charcoal/50"
        >
          Already have an account?{' '}
          <a href="/login" className="font-semibold text-rust hover:text-rust-dark transition-colors">
            Sign in →
          </a>
          {' or '}
          <a href="/explore" className="font-semibold text-rust hover:text-rust-dark transition-colors">
            browse properties
          </a>
        </motion.div>

        {/* Preview of the platform */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-20 overflow-hidden rounded-2xl bg-charcoal px-8 py-12 text-center shadow-stamp"
          style={{ borderRadius: '20px 20px 40px 20px' }}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-rust font-semibold">Trusted by thousands</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
            Ethiopia's Most Trusted Rental Platform
          </h2>
          <p className="mt-2 text-sm text-cream/65 max-w-xl mx-auto">
            12,400+ verified listings. 6,300+ verified landlords. 98% tenant satisfaction. Built on transparency.
          </p>
          <div className="mt-8 flex justify-center gap-6">
            {['ETB transparent pricing', 'Zero fake listings', 'Secure digital agreements'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-cream/80">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-rust">
                  <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
