import type { Variants } from 'framer-motion'

/** Whole-page enter/exit, used by PageTransition. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
}

/** Fade-up for content blocks entering on scroll (hero copy, section headers). */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

/** Subtle lift for cards (listings, feature tiles) on hover. */
export const cardHover = {
  rest: { y: 0, boxShadow: '0 1px 0 rgba(42,37,33,0.06)' },
  hover: {
    y: -4,
    boxShadow: '0 12px 24px -12px rgba(42,37,33,0.25)',
    transition: { duration: 0.2, ease: 'easeOut' },
  },
}
