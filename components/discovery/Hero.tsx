'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { HERO_IMAGES } from '@/lib/images'


const PROPERTY_TYPES = ['Any Type', 'Apartment', 'House', 'Villa', 'Studio']
const BUDGETS = ['Any Budget', 'Under ETB 15,000', 'ETB 15,000–25,000', 'Over ETB 25,000']
const BEDROOMS = ['Any Beds', '1+', '2+', '3+', '4+']

export default function Hero() {
  const router = useRouter()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [currentBgIndex, setCurrentBgIndex] = useState(0)
  const [neighborhood, setNeighborhood] = useState('Addis Ababa')
  const [propertyType, setPropertyType] = useState('Any Type')

  // Smooth background slideshow every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % HERO_IMAGES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Parallax scroll: background drifts slower than page
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '15%'])
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.5, 0.85])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const query = new URLSearchParams()
    if (neighborhood && neighborhood !== 'Addis Ababa') query.set('neighborhood', neighborhood)
    if (propertyType && propertyType !== 'Any Type') query.set('type', propertyType)
    router.push(`/explore?${query.toString()}`)
  }

  return (
    <div
      ref={sectionRef}
      className="relative isolate overflow-hidden"
      style={{ minHeight: '95vh' }}
    >
      {/* BACKGROUND SLIDESHOW — full-bleed with parallax */}
      <motion.div style={{ y: imageY }} className="absolute inset-0 -top-16 h-[calc(100%+5rem)]">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentBgIndex}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <Image
              src={HERO_IMAGES[currentBgIndex].url}
              alt={HERO_IMAGES[currentBgIndex].caption}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlay — darkens at bottom for text legibility */}
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-gradient-to-b from-charcoal/50 via-charcoal/40 to-charcoal/85"
        />
        {/* Extra bottom fade for search panel */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-charcoal/80 to-transparent" />
      </motion.div>

      {/* HERO CONTENT */}
      <motion.div
        style={{ y: contentY }}
        className="relative flex flex-col items-start justify-center min-h-[95vh] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20"
      >
        {/* Trust pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-rust" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/90">
            HomeLink Ethiopia &nbsp;·&nbsp; Trusted Housing Ecosystem
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.04] text-white sm:text-6xl lg:text-7xl"
        >
          A home should<br />feel like yours.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="mt-5 max-w-lg text-base text-white/80 sm:text-lg leading-relaxed"
        >
          Find verified homes in Addis Ababa and across Ethiopia.
          Trusted. Transparent. Digitally Managed. Truly HomeLink.
        </motion.p>

        {/* SEARCH PANEL — floating card with noticeable bottom-right border radius */}
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
          onSubmit={handleSearch}
          className="mt-10 w-full max-w-4xl overflow-hidden bg-white/97 shadow-2xl backdrop-blur-md"
          style={{
            borderRadius: '16px 16px 48px 16px',  // noticeable bottom-right corner
          }}
        >
          <div className="grid gap-0 sm:grid-cols-[2fr_1.2fr_1.4fr_1fr_auto]">
            {/* Location */}
            <div className="border-b border-charcoal/10 p-4 sm:border-b-0 sm:border-r">
              <p className="font-mono text-[10px] uppercase tracking-widest text-charcoal/50 font-semibold">
                Where do you want to live?
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-rust">
                  <path fillRule="evenodd" d="M10 18s6-5.7 6-10.5A6 6 0 004 7.5C4 12.3 10 18 10 18zm0-8a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Bole, Kazanchis, CMC..."
                  className="w-full bg-transparent text-sm font-medium text-charcoal outline-none placeholder:text-charcoal/40"
                />
              </div>
            </div>

            {/* Property Type */}
            <div className="border-b border-charcoal/10 p-4 sm:border-b-0 sm:border-r">
              <p className="font-mono text-[10px] uppercase tracking-widest text-charcoal/50 font-semibold">
                Property Type
              </p>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="mt-1.5 w-full bg-transparent text-sm font-medium text-charcoal outline-none"
              >
                {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Budget */}
            <div className="border-b border-charcoal/10 p-4 sm:border-b-0 sm:border-r">
              <p className="font-mono text-[10px] uppercase tracking-widest text-charcoal/50 font-semibold">
                Budget (ETB)
              </p>
              <select className="mt-1.5 w-full bg-transparent text-sm font-medium text-charcoal outline-none">
                {BUDGETS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>

            {/* Bedrooms */}
            <div className="border-b border-charcoal/10 p-4 sm:border-b-0 sm:border-r">
              <p className="font-mono text-[10px] uppercase tracking-widest text-charcoal/50 font-semibold">
                Bedrooms
              </p>
              <select className="mt-1.5 w-full bg-transparent text-sm font-medium text-charcoal outline-none">
                {BEDROOMS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>

            {/* Search CTA — inherits large bottom-right radius from parent */}
            <div className="p-2 flex items-stretch">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-rust px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rust-dark"
                style={{ borderRadius: '8px 8px 40px 8px' }}
              >
                Search<br className="hidden sm:block" /> Homes
              </motion.button>
            </div>
          </div>
        </motion.form>

        {/* Slideshow indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex w-full max-w-4xl items-center justify-between"
        >
          <p className="font-mono text-xs text-white/60 italic">{HERO_IMAGES[currentBgIndex].caption}</p>
          <div className="flex items-center gap-2">
            {HERO_IMAGES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentBgIndex(idx)}
                className={`rounded-full transition-all duration-300 ${
                  idx === currentBgIndex ? 'w-7 h-2 bg-rust' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
