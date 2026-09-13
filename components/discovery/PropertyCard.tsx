'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import type { Property } from '@/lib/properties'
import { formatEtb } from '@/lib/properties'
import { useFavoritesStore } from '@/lib/store'
import { useLanguage } from '@/lib/language-context'

// motion() wraps Link itself (not a div around it) so the tilt/hover
// transform and focus state live on the same element that navigates —
// whileFocus on a div wrapped by a separate <a> wouldn't fire on tab.
const MotionLink = motion(Link)

interface PropertyCardProps {
  property: Property
  /** Controlled hover state, e.g. driven by a synced map pin. Falls back to the card's own pointer events when omitted. */
  isHighlighted?: boolean
  onHoverChange?: (hovering: boolean) => void
  className?: string
}

/**
 * A real 3D tilt (not just a translateY lift): rotation follows pointer
 * position within the card, clamped to a subtle range so it reads as
 * "premium" rather than gimmicky. Falls back gracefully — with no
 * pointer events (touch, keyboard focus) the card still gets the
 * lift + shadow expansion via whileHover/whileFocus.
 */
export default function PropertyCard({
  property,
  isHighlighted,
  onHoverChange,
  className = '',
}: PropertyCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const saved = useFavoritesStore((s) => s.favorites.has(property.id))
  const { locale } = useLanguage()
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), {
    stiffness: 300,
    damping: 25,
  })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 300,
    damping: 25,
  })

  function handlePointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function resetTilt() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <MotionLink
      href={`/property/${property.id}`}
      ref={cardRef}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        resetTilt()
        onHoverChange?.(false)
      }}
      onPointerEnter={() => onHoverChange?.(true)}
      whileHover={{ y: -8, scale: 1.015 }}
      whileFocus={{ y: -8, scale: 1.015 }}
      animate={
        isHighlighted
          ? { y: -8, scale: 1.015, boxShadow: '0 24px 40px -16px rgba(42,37,33,0.35)' }
          : { y: 0, scale: 1, boxShadow: '0 1px 0 rgba(42,37,33,0.06)' }
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group block overflow-hidden rounded-lg bg-white ${className}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={property.image}
          alt={`${property.title} in ${property.neighborhood}`}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {property.verified && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded bg-verified px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
              <path
                fillRule="evenodd"
                d="M10 1.5l6.5 2.9v5c0 4.6-2.8 8.7-6.5 9.9-3.7-1.2-6.5-5.3-6.5-9.9v-5L10 1.5zm3.4 6.4a.75.75 0 00-1.1-1L9 10.2 7.7 8.9a.75.75 0 10-1 1.1l1.8 1.8c.3.3.8.3 1 0l3.9-3.9z"
                clipRule="evenodd"
              />
            </svg>
            {locale === 'EN' ? 'Verified' : 'የተረጋገጠ'}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleFavorite(property.id)
          }}
          aria-label={saved ? 'Remove from saved homes' : 'Save this home'}
          aria-pressed={saved}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-charcoal transition-colors hover:text-rust"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill={saved ? '#B8451F' : 'none'}
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path d="M10 17.3s-6.5-3.9-8.5-8.1C.4 6.2 2 3.3 5 3c1.8-.2 3.6.7 5 2.4C11.4 3.7 13.2 2.8 15 3c3 .3 4.6 3.2 3.5 6.2-2 4.2-8.5 8.1-8.5 8.1z" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <h3 className="font-display text-lg font-semibold text-charcoal">{property.title}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-charcoal/60">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-rust">
            <path
              fillRule="evenodd"
              d="M10 18s6-5.7 6-10.5A6 6 0 004 7.5C4 12.3 10 18 10 18zm0-8a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          {property.neighborhood}, {locale === 'EN' ? 'Addis Ababa' : 'አዲስ አበባ'}
        </p>

        <p className="mt-3 font-display text-base font-semibold text-charcoal">
          {formatEtb(property.priceEtb)} <span className="font-sans text-sm font-normal text-charcoal/50">{locale === 'EN' ? '/ month' : '/ ወር'}</span>
        </p>

        <div className="mt-3 flex items-center gap-4 text-sm text-charcoal/70">
          <span>{property.beds} {locale === 'EN' ? 'Beds' : 'መኝታ'}</span>
          <span>{property.baths} {locale === 'EN' ? 'Bath' : 'መታጠቢያ'}</span>
          <span>{property.sizeSqm} m²</span>
        </div>

        <div className="mt-3 flex items-center gap-1 text-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-rust">
            <path d="M10 1.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8L10 1.5z" />
          </svg>
          <span className="font-medium text-charcoal">{property.rating}</span>
          <span className="text-charcoal/50">({property.reviewCount})</span>
        </div>
      </div>
    </MotionLink>
  )
}
