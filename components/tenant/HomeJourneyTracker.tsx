'use client'

import { motion } from 'framer-motion'

const STEPS = ['Discovered', 'Viewing', 'Application', 'Approved', 'Living Here'] as const

const STEP_ICON: Record<(typeof STEPS)[number], string> = {
  Discovered: 'M9 2a7 7 0 015.7 11l3.7 3.7-1.4 1.4L13.3 14.4A7 7 0 119 2z',
  Viewing: 'M2 9s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM9 11a2 2 0 100-4 2 2 0 000 4z',
  Application: 'M4 2h8l3 3v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zM6 8h6M6 11h6M6 14h4',
  Approved: 'M3 10l4 4 8-9',
  'Living Here': 'M3 9l7-6 7 6M5 8v8h10V8',
}

/** Index of the tenant's current stage — "Living Here" (last step) here since this is a mock active tenancy. */
interface HomeJourneyTrackerProps {
  currentStepIndex: number
}

export default function HomeJourneyTracker({ currentStepIndex }: HomeJourneyTrackerProps) {
  const progressPercent = (currentStepIndex / (STEPS.length - 1)) * 100

  return (
    <div>
      <div className="relative flex items-start justify-between">
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-charcoal/10" aria-hidden />
        <motion.div
          className="absolute left-0 top-5 h-0.5 origin-left bg-rust"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progressPercent / 100 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{ width: '100%' }}
          aria-hidden
        />

        {STEPS.map((step, i) => {
          const isDone = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          return (
            <div key={step} className="relative z-10 flex flex-1 flex-col items-center gap-2 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.12 }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  isDone
                    ? 'border-rust bg-rust text-white'
                    : isCurrent
                    ? 'border-rust bg-rust text-white'
                    : 'border-charcoal/15 bg-cream text-charcoal/30'
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M3 10l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
                    <path d={STEP_ICON[step]} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </motion.span>
              <span className={`text-xs font-medium ${isDone || isCurrent ? 'text-charcoal' : 'text-charcoal/40'}`}>{step}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
