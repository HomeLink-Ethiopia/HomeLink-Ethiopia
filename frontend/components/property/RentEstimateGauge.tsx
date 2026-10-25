'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import type { RentEstimate } from '@/lib/propertyDetails'
import { formatEtb } from '@/lib/properties'

interface RentEstimateGaugeProps {
  estimate: RentEstimate
}

const WIDTH = 220
const HEIGHT = 130
const CX = WIDTH / 2
const CY = HEIGHT - 6
const R = 90

function pointOnArc(t: number) {
  // t: 0 (left/"Low") .. 1 (right/"High"), swept across a top semicircle.
  const angle = Math.PI - t * Math.PI
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) }
}

function arcPath(t0: number, t1: number) {
  const p0 = pointOnArc(t0)
  const p1 = pointOnArc(t1)
  const largeArc = t1 - t0 > 0.5 ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} 1 ${p1.x} ${p1.y}`
}

/**
 * Fair-rent gauge: a three-zone arc (Low / Fair / High) with a needle
 * that sweeps to the platform's estimate. The needle animates in only
 * once the card scrolls into view, via framer-motion's useInView.
 * Shows the estimated price range prominently at the top.
 */
export default function RentEstimateGauge({ estimate }: RentEstimateGaugeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  const { low, fair, high } = estimate
  // Needle position within a slightly wider band than low..high so it
  // doesn't sit exactly at the arc's ends.
  const bandLow = low - (high - low) * 0.15
  const bandHigh = high + (high - low) * 0.15
  const t = Math.min(1, Math.max(0, (fair - bandLow) / (bandHigh - bandLow)))
  const needleAngle = 180 - t * 180 // degrees, 180 = pointing left, 0 = pointing right

  return (
    <div ref={ref} className="py-2">
      {/* Price range at top */}
      <div className="text-center">
        <p className="font-display text-2xl font-bold text-charcoal">
          {formatEtb(low)} – {formatEtb(high)}
        </p>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-charcoal/50">
          Estimated Fair Rent / Month
        </p>
      </div>

      {/* Semicircle gauge */}
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mx-auto mt-4 overflow-visible">
        <path d={arcPath(0, 0.33)} stroke="#EFD9C9" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arcPath(0.34, 0.66)} stroke="#B8451F" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arcPath(0.67, 1)} stroke="#8F3517" strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.5} />

        <motion.g
          initial={{ rotate: 180 }}
          animate={inView ? { rotate: needleAngle } : { rotate: 180 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
        >
          <line x1={CX} y1={CY} x2={CX - R + 18} y2={CY} stroke="#2A2521" strokeWidth={3} strokeLinecap="round" />
        </motion.g>
        <circle cx={CX} cy={CY} r={5} fill="#2A2521" />
      </svg>

      <div className="mt-1 flex justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-charcoal/50">
        <span>Low</span>
        <span className="text-rust">Your Rental is</span>
        <span>High</span>
      </div>

      <button className="mt-4 w-full text-center text-sm font-medium text-rust hover:text-rust-dark transition-colors">
        View Details
      </button>
    </div>
  )
}
