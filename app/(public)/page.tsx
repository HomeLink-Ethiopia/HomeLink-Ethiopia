'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion'
import PropertyCard from '@/components/discovery/PropertyCard'
import { PROPERTIES } from '@/lib/properties'
import { stockPhoto, personPhoto } from '@/lib/images'
import { useLanguage } from '@/lib/language-context'

/* ─── HERO SLIDESHOW IMAGES ─────────────────────────────────────────────── */
const HERO_SLIDES = [
  { seed: 'addis-ababa-bole-skyline-modern', caption: 'Modern Living in Bole, Addis Ababa' },
  { seed: 'addis-ababa-kazanchis-cityscape', caption: 'Urban Residences in Kazanchis' },
  { seed: 'addis-ababa-cmc-residential', caption: 'Spacious Family Homes in CMC' },
  { seed: 'ethiopian-modern-apartments', caption: 'Verified Properties Across Ethiopia' },
]

/* ─── STATS ─────────────────────────────────────────────────────────────── */
const STATS: { icon: JSX.Element; value: number; suffix?: string; labelKey: string; displayKey?: string }[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M12 21s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 7.2c0 7.3-8 11.8-8 11.8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    value: 12400,
    suffix: '+',
    labelKey: 'properties',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    value: 6300,
    suffix: '+',
    labelKey: 'landlords',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    value: 98,
    suffix: '%',
    labelKey: 'happyTenants',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    value: 0,
    displayKey: 'secure',
    labelKey: 'dataSafe',
  },
]

/* ─── NEIGHBORHOODS (REAL ADDIS ABABA AREAS WITH REAL IMAGES) ──────────── */
const NEIGHBORHOODS = [
  {
    name: 'Bole',
    sub: 'Modern hub near the airport. Restaurants, embassies, business.',
    homes: 426,
    seed: 'bole-addis-ababa-ethiopia',
  },
  {
    name: 'Kazanchis',
    sub: 'Central business district. Close to everything.',
    homes: 312,
    seed: 'kazanchis-city-ethiopia',
  },
  {
    name: 'CMC',
    sub: 'Residential, spacious. Great for families.',
    homes: 276,
    seed: 'cmc-residential-ethiopia',
  },
  {
    name: 'Piassa',
    sub: 'Historic downtown. Traditional and vibrant.',
    homes: 238,
    seed: 'piassa-downtown-ethiopia',
  },
  {
    name: 'Megenagna',
    sub: 'Transport hub. Lively, well-connected.',
    homes: 196,
    seed: 'megenagna-transport-ethiopia',
  },
  {
    name: 'Sarbet',
    sub: 'Quiet, residential. Traditional and modern mix.',
    homes: 164,
    seed: 'sarbet-neighborhood-ethiopia',
  },
  {
    name: 'Gerji',
    sub: 'Growing area. New developments, good value.',
    homes: 152,
    seed: 'gerji-area-ethiopia',
  },
  {
    name: '22 Mazoria',
    sub: 'Established neighborhood. Schools and markets nearby.',
    homes: 128,
    seed: 'mazoria-district-ethiopia',
  },
]

/* ─── HOW IT WORKS STEPS ────────────────────────────────────────────────── */
const HOW_STEPS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: 'Discover',
    sub: 'Explore verified homes that fit your needs.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    title: 'Verify',
    sub: 'Every property and landlord is verified.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'View',
    sub: 'Schedule viewings and find your favorite.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: 'Apply',
    sub: 'Submit your application with confidence.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: 'Live',
    sub: 'Manage rent, maintenance, and more in one place.',
  },
]

const PROPERTY_TYPES = ['Any', 'Apartment', 'House', 'Villa', 'Studio']
const BUDGETS = ['Any Budget', 'Under ETB 15,000', 'ETB 15,000–25,000', 'Over ETB 25,000']
const BEDROOMS = ['Any', '1+', '2+', '3+', '4+']

/* ─── ANIMATED NUMBER COMPONENT ─────────────────────────────────────────── */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    const start = Date.now()
    const duration = 1500
    function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target])

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

/* ─── 1. HERO COMPONENT ─────────────────────────────────────────────────── */
function HeroSection() {
  const { t } = useLanguage()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [slideIdx, setSlideIdx] = useState(0)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '10%'])
  const dimOpacity = useTransform(scrollYProgress, [0, 1], [0.45, 0.85])

  // 5s automatic crossfade
  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden min-h-[90vh] flex flex-col justify-between">
      {/* VIDEO-LIKE KEN-BURNS BACKGROUND SLIDESHOW */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-12 h-[calc(100%+3rem)]">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={slideIdx}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 animate-kenburns">
              <Image
                src={stockPhoto(HERO_SLIDES[slideIdx].seed, 1920, 1080)}
                alt={HERO_SLIDES[slideIdx].caption}
                fill
                priority
                sizes="100vw"
                className="object-cover brightness-90"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Ambient Dark Gradient */}
        <motion.div
          style={{ opacity: dimOpacity }}
          className="absolute inset-0 bg-gradient-to-b from-charcoal/50 via-charcoal/30 to-charcoal/80"
        />

        {/* Organic curved transition at the bottom */}
        <div className="absolute bottom-0 inset-x-0 overflow-hidden leading-none z-10">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-12 fill-cream">
            <path d="M0,0 C480,60 960,60 1440,0 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </motion.div>

      {/* HERO FOREGROUND CONTENT */}
      <motion.div
        style={{ y: contentY }}
        className="relative mx-auto w-full max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center"
      >
        <div className="max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl font-bold leading-[1.08] text-white drop-shadow-md sm:text-6xl lg:text-7xl"
          >
            {t.hero.title.split('.').map((s, i, a) => i < a.length - 1 ? <span key={i}>{s}.<br /></span> : <span key={i}>{s}</span>)}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mt-4 text-base font-normal text-white/90 drop-shadow sm:text-lg"
          >
            {t.hero.subtitle}
          </motion.p>
        </div>

        {/* SEARCH BAR PANEL */}
        <motion.form
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          onSubmit={(e) => e.preventDefault()}
          className="mt-10 grid gap-0 rounded-2xl bg-white/98 shadow-2xl backdrop-blur-md sm:grid-cols-[2fr_1.2fr_1.4fr_1fr_auto] overflow-hidden"
          style={{ borderRadius: '16px 16px 36px 16px' }}
        >
          <label className="block p-4 border-b sm:border-b-0 sm:border-r border-charcoal/10">
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-charcoal/50">
              {t.hero.whereToLive}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-rust">
                <path fillRule="evenodd" d="M10 18s6-5.7 6-10.5A6 6 0 004 7.5C4 12.3 10 18 10 18zm0-8a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <input
                defaultValue="Addis Ababa"
                placeholder={t.hero.searchPlaceholder}
                className="w-full bg-transparent text-sm font-medium text-charcoal outline-none placeholder:text-charcoal/40"
              />
            </div>
          </label>

          <label className="block p-4 border-b sm:border-b-0 sm:border-r border-charcoal/10">
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-charcoal/50">
              {t.hero.propertyType}
            </span>
            <select className="mt-1 w-full bg-transparent text-sm font-medium text-charcoal outline-none">
              {PROPERTY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="block p-4 border-b sm:border-b-0 sm:border-r border-charcoal/10">
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-charcoal/50">
              {t.hero.budget}
            </span>
            <select className="mt-1 w-full bg-transparent text-sm font-medium text-charcoal outline-none">
              {BUDGETS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>

          <label className="block p-4 border-b sm:border-b-0 sm:border-r border-charcoal/10">
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-charcoal/50">
              {t.hero.bedrooms}
            </span>
            <select className="mt-1 w-full bg-transparent text-sm font-medium text-charcoal outline-none">
              {BEDROOMS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>

          <div className="p-2 flex items-stretch">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full bg-rust px-7 py-3.5 text-sm font-bold text-white shadow-stamp hover:bg-rust-dark transition-colors"
              style={{ borderRadius: '10px 10px 28px 10px' }}
            >
              {t.hero.searchButton}
            </motion.button>
          </div>
        </motion.form>
      </motion.div>
    </section>
  )
}

/* ─── 2. STATS RIBBON ───────────────────────────────────────────────────── */
function StatsRibbon() {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} className="relative z-20 mx-auto max-w-7xl px-4 -mt-4 sm:px-6 lg:px-8">
      <div
        className="grid grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-charcoal/10 rounded-2xl bg-white p-6 shadow-stamp lg:grid-cols-4"
        style={{ borderRadius: '16px 16px 28px 16px' }}
      >
        {STATS.map((s, idx) => (
          <motion.div
            key={s.labelKey}
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: idx * 0.08, duration: 0.5 }}
            className="flex items-center gap-3.5 px-4 py-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rust-tint/50 text-rust">
              {s.icon}
            </div>
            <div>
              <p className="font-display text-xl font-bold text-charcoal">
                {s.displayKey ? t.stats[s.displayKey as keyof typeof t.stats] : <AnimatedNumber target={s.value} suffix={s.suffix} />}
              </p>
              <p className="text-xs text-charcoal/55 font-medium">{t.stats[s.labelKey as keyof typeof t.stats]}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ─── 3. EXPLORE ADDIS ABABA (NEIGHBORHOODS) ────────────────────────────── */
function NeighborhoodSection() {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-charcoal">{t.neighborhoods.title}</h2>
          <p className="mt-1 text-sm text-charcoal/60">{t.neighborhoods.subtitle}</p>
        </div>
        <Link href="/explore" className="text-sm font-semibold text-rust hover:text-rust-dark transition-colors">
          {t.neighborhoods.viewAll} →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {NEIGHBORHOODS.slice(0, 4).map((n, i) => (
          <motion.div
            key={n.name}
            initial={{ opacity: 0, y: 25 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.09, duration: 0.5 }}
          >
            <NeighborhoodCard item={n} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function NeighborhoodCard({ item }: { item: (typeof NEIGHBORHOODS)[number] }) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 25 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 25 })

  return (
    <motion.a
      ref={cardRef}
      href={`/explore?neighborhood=${item.name}`}
      style={{ rotateX, rotateY, transformPerspective: 900, borderRadius: '16px 16px 32px 16px' }}
      onPointerMove={(e) => {
        const rect = cardRef.current?.getBoundingClientRect()
        if (!rect) return
        mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
        mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
      }}
      onPointerLeave={() => {
        mouseX.set(0)
        mouseY.set(0)
      }}
      whileHover={{ y: -6, boxShadow: '0 20px 35px -10px rgba(42,37,33,0.3)' }}
      className="group relative block aspect-[4/5] overflow-hidden bg-charcoal shadow-stamp"
    >
      <Image
        src={stockPhoto(item.seed ?? item.name, 600, 750)}
        alt={item.name}
        fill
        sizes="(min-width: 1024px) 25vw, 50vw"
        className="object-cover transition-transform duration-700 group-hover:scale-108"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/95 via-charcoal/30 to-transparent" />
      <div className="absolute bottom-0 left-0 p-5">
        <h3 className="font-display text-xl font-bold text-white">{item.name}</h3>
        <p className="mt-1 text-xs text-white/70 leading-relaxed">{item.sub}</p>
        <p className="mt-3 font-mono text-xs font-semibold text-rust flex items-center gap-1">
          {item.homes} homes <span className="transition-transform group-hover:translate-x-1">→</span>
        </p>
      </div>
    </motion.a>
  )
}

/* ─── 4. VERIFIED HOMES SECTION ─────────────────────────────────────────── */
function VerifiedHomesSection() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'you' | 'new' | 'popular' | 'top'>('you')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  const displayProperties =
    activeTab === 'popular'
      ? PROPERTIES.filter((p) => p.reviewCount >= 25)
      : activeTab === 'top'
      ? PROPERTIES.filter((p) => p.rating >= 4.7)
      : PROPERTIES.filter((p) => p.verified)

  return (
    <section ref={ref} className="bg-sand/35 py-16 border-y border-charcoal/8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-charcoal">{t.properties.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {([
              ['you', t.properties.forYou],
              ['new', t.properties.new],
              ['popular', t.properties.popular],
              ['top', t.properties.topRated],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveTab(k)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === k
                    ? 'bg-rust text-white shadow-sm'
                    : 'border border-charcoal/15 bg-white text-charcoal/60 hover:text-charcoal'
                }`}
              >
                {label}
              </button>
            ))}

            <Link href="/explore" className="ml-4 text-xs font-semibold text-rust hover:text-rust-dark">
              {t.properties.viewAll} →
            </Link>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {displayProperties.slice(0, 4).map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ─── 5. AI MATCH SECTION ───────────────────────────────────────────────── */
function AiMatchSection() {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const sampleProp = PROPERTIES.find((p) => p.verified) ?? PROPERTIES[0]

  return (
    <section ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="grid grid-cols-1 gap-8 rounded-2xl bg-charcoal p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center shadow-stamp"
        style={{ borderRadius: '20px 20px 40px 20px' }}
      >
        {/* Left Side */}
        <div>
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{t.aiMatch.title}</h2>
          <p className="mt-1 text-sm text-cream/70">{t.aiMatch.subtitle}</p>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Animated Gauge */}
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="38" fill="none" stroke="#ffffff15" strokeWidth="8" />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="38"
                  fill="none"
                  stroke="#B8451F"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={238.76}
                  initial={{ strokeDashoffset: 238.76 }}
                  animate={inView ? { strokeDashoffset: 238.76 * 0.06 } : {}}
                  transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                />
              </svg>
              <div className="z-10 text-center">
                <span className="font-display text-2xl font-bold text-white">94%</span>
                <p className="text-[9px] font-mono uppercase tracking-wider text-cream/50">Match</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cream/60 mb-2">
                {t.aiMatch.whyMatches}
              </p>
              <ul className="space-y-1.5 text-xs text-cream/80">
                {[
                  t.aiMatch.withinBudget,
                  t.aiMatch.preferredLocation + ' (Bole)',
                  '2+ bedrooms',
                  t.aiMatch.parkingAvailable,
                  t.aiMatch.verifiedLandlord,
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-rust">
                      <path
                        fillRule="evenodd"
                        d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Side: Sample Property Card Preview */}
        <div className="flex justify-center lg:justify-end">
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ borderRadius: '16px 16px 32px 16px' }}
          >
            <div className="relative aspect-[4/3]">
              <Image src={sampleProp.image} alt={sampleProp.title} fill sizes="300px" className="object-cover" />
              <span className="absolute left-3 top-3 rounded bg-verified px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Verified
              </span>
            </div>
            <div className="p-4">
              <p className="font-display font-bold text-charcoal">{sampleProp.title}</p>
              <p className="text-xs text-charcoal/55">{sampleProp.neighborhood}, Addis Ababa</p>
              <p className="mt-2 font-display text-lg font-bold text-rust">
                ETB {sampleProp.priceEtb.toLocaleString()}{' '}
                <span className="text-xs font-sans text-charcoal/50">/ month</span>
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs text-charcoal/60">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-rust">
                  <path d="M10 1.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8L10 1.5z" />
                </svg>
                {sampleProp.rating} ({sampleProp.reviewCount})
              </div>

              <Link
                href="/explore"
                className="mt-4 block w-full rounded-xl bg-rust py-2.5 text-center text-xs font-bold text-white shadow hover:bg-rust-dark transition-colors"
                style={{ borderRadius: '8px 8px 20px 8px' }}
              >
                {t.aiMatch.seeMatches} →
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

/* ─── 6. HOW HOMELINK WORKS ─────────────────────────────────────────────── */
function HowItWorksSection() {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center font-display text-3xl font-bold text-charcoal">{t.howItWorks.title}</h2>

      <div className="mt-12 flex flex-wrap items-start justify-between gap-4">
        {HOW_STEPS.map((step, idx) => (
          <div key={step.title} className="flex flex-1 min-w-[140px] flex-col items-center text-center relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 240 }}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rust/30 bg-rust/10 shadow-sm"
            >
              {step.icon}
            </motion.div>

            <h3 className="mt-4 font-display text-base font-bold text-charcoal">{step.title}</h3>
            <p className="mt-1 text-xs text-charcoal/60 leading-relaxed max-w-[160px]">{step.sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── 7. RENT WITH CONFIDENCE (CTA BANNER) ──────────────────────────────── */
function RentWithConfidence() {
  const { t } = useLanguage()
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div
        className="relative overflow-hidden bg-rust text-white shadow-stamp"
        style={{ borderRadius: '20px 20px 40px 20px' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-center">
          <div className="p-8 sm:p-12 lg:p-16">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t.cta.title}</h2>
            <p className="mt-3 text-sm text-white/85 leading-relaxed max-w-md">
              {t.cta.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/get-started"
                className="rounded-xl bg-white px-7 py-3 text-sm font-bold text-rust hover:bg-cream transition-colors shadow-stamp"
                style={{ borderRadius: '8px 8px 22px 8px' }}
              >
                {t.cta.getStarted}
              </Link>

              <div className="flex items-center gap-2 text-xs text-white/90">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v4a1 1 0 11-2 0V9z" clipRule="evenodd" />
                </svg>
                {t.cta.maintenanceSupport}
              </div>

              <div className="flex items-center gap-2 text-xs text-white/90">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v4a1 1 0 11-2 0V9z" clipRule="evenodd" />
                </svg>
                {t.cta.helpSupport}
              </div>
            </div>
          </div>

          <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full min-h-[280px]">
            <Image
              src={stockPhoto('addis-living-room-furnished', 900, 600)}
              alt="Living room"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-rust via-transparent to-transparent hidden lg:block" />

            {/* Floating Landlord Card */}
            <div
              className="absolute bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-charcoal shadow-2xl backdrop-blur-md"
              style={{ borderRadius: '12px 12px 24px 12px' }}
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-sand">
                <Image src={personPhoto('landlord-spotlight')} alt="Landlord" fill sizes="40px" className="object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-xs font-bold text-charcoal">Landlord</p>
                  <span className="rounded bg-verified px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Verified
                  </span>
                </div>
                <p className="text-[11px] text-charcoal/60">Bole, Addis Ababa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── MAIN HOMEPAGE EXPORT ──────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="bg-cream">
      <HeroSection />
      <StatsRibbon />
      <NeighborhoodSection />
      <VerifiedHomesSection />
      <AiMatchSection />
      <HowItWorksSection />
      <RentWithConfidence />
    </div>
  )
}
