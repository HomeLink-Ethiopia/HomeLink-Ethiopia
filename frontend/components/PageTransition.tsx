'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { pageVariants } from '@/lib/motion'

/**
 * Wraps route content so navigating between pages fades/slides instead
 * of hard-cutting — the "immersive" feel the brief asked for. Keyed on
 * pathname so AnimatePresence treats each route as a distinct child
 * and actually runs the exit transition.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="w-full flex-1"
    >
      {children}
    </motion.div>
  )
}
