'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { NEIGHBORHOOD_COLOR, PROPERTIES, formatEtb, type Property } from '@/lib/properties'
import { fetchProperties } from '@/services/api'
import { SearchFilters, filterProperties } from '@/lib/search'
import { useLanguage } from '@/lib/language-context'

const PropertyMap = dynamic(() => import('./PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-sand text-sm text-charcoal/50">
      Loading map…
    </div>
  ),
})

interface DiscoverySplitProps {
  filters?: SearchFilters
}

/* ─── FILTER DROPDOWN ─────────────────────────────────────────────────── */

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  active,
}: {
  label: string
  value: string
  options: { label: string; value: T | '' }[]
  onChange: (v: T | '') => void
  active?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
          active
            ? 'border-rust bg-rust/5 text-rust'
            : 'border-charcoal/20 bg-white text-charcoal hover:border-rust'
        }`}
      >
        <span>{selected?.label || label}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''} ${active ? 'text-rust' : 'text-charcoal/50'}`}>
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-charcoal/10 bg-white py-1.5 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value || '__all__'}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                value === opt.value ? 'bg-rust/5 font-semibold text-rust' : 'text-charcoal hover:bg-sand/50'
              }`}
            >
              {value === opt.value && (
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3 shrink-0 text-rust">
                  <path d="M10 3L4.5 8.5 2 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className={value !== opt.value ? 'ml-5' : ''}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── RANGE FILTER (Price / Bedrooms) ──────────────────────────────────── */

function RangeFilter({
  label,
  value,
  ranges,
  onChange,
  active,
}: {
  label: string
  value: string
  ranges: { label: string; value: string }[]
  onChange: (v: string) => void
  active?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = ranges.find((r) => r.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
          active
            ? 'border-rust bg-rust/5 text-rust'
            : 'border-charcoal/20 bg-white text-charcoal hover:border-rust'
        }`}
      >
        <span>{selected?.label || label}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''} ${active ? 'text-rust' : 'text-charcoal/50'}`}>
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-charcoal/10 bg-white py-1.5 shadow-lg">
          {ranges.map((r) => (
            <button
              key={r.value || '__all__'}
              type="button"
              onClick={() => { onChange(r.value); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                value === r.value ? 'bg-rust/5 font-semibold text-rust' : 'text-charcoal hover:bg-sand/50'
              }`}
            >
              {value === r.value && (
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3 shrink-0 text-rust">
                  <path d="M10 3L4.5 8.5 2 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className={value !== r.value ? 'ml-5' : ''}>{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── MORE FILTERS PANEL ──────────────────────────────────────────────── */

function MoreFiltersPanel({
  open,
  onClose,
  furnished,
  setFurnished,
  verifiedOnly,
  setVerifiedOnly,
}: {
  open: boolean
  onClose: () => void
  furnished: boolean
  setFurnished: (v: boolean) => void
  verifiedOnly: boolean
  setVerifiedOnly: (v: boolean) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={panelRef} className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-charcoal/10 bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-charcoal">More Filters</h3>
        <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Furnished toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-charcoal/70">Furnished</span>
          <button
            type="button"
            onClick={() => setFurnished(!furnished)}
            className={`relative h-6 w-11 rounded-full transition-colors ${furnished ? 'bg-rust' : 'bg-charcoal/20'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${furnished ? 'translate-x-5' : ''}`} />
          </button>
        </label>

        {/* Verified only toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-charcoal/70">Verified only</span>
          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`relative h-6 w-11 rounded-full transition-colors ${verifiedOnly ? 'bg-rust' : 'bg-charcoal/20'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${verifiedOnly ? 'translate-x-5' : ''}`} />
          </button>
        </label>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-lg bg-rust py-2 text-sm font-semibold text-white hover:bg-rust-dark transition-colors"
      >
        Apply Filters
      </button>
    </div>
  )
}

/* ─── AI MATCH CARD ─────────────────────────────────────────────────── */

function AiMatchCard({ property, score, reasons }: { property: Property; score: number; reasons: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const circumference = 2 * Math.PI * 18
  const offset = circumference * (1 - score / 100)
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#dc2626'

  return (
    <div className="rounded-xl border border-charcoal/8 bg-cream/30 p-3 transition-colors hover:border-rust/20">
      <div className="flex items-start gap-3">
        <Link href={`/property/${property.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
          <Image src={property.image} alt={property.title} fill sizes="64px" className="object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/property/${property.id}`} className="truncate text-sm font-medium text-charcoal hover:text-rust transition-colors">
                {property.title}
              </Link>
              <p className="text-[11px] text-charcoal/50">{property.neighborhood} · {property.beds} bed · {property.baths} bath</p>
            </div>
            {/* Score ring */}
            <div className="relative h-12 w-12 shrink-0">
              <svg className="-rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="none" stroke="#F5F1EC" strokeWidth="3" />
                <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-charcoal">
                {score}%
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold text-rust">{formatEtb(property.priceEtb)}<span className="text-xs font-normal text-charcoal/50">/mo</span></span>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-charcoal/50 hover:text-rust transition-colors"
            >
              Why this match?
              <svg viewBox="0 0 12 12" fill="currentColor" className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                <path d="M3 4.5l3 3 3-3" />
              </svg>
            </button>
          </div>

          {expanded && (
            <div className="mt-2 space-y-1 border-t border-charcoal/5 pt-2">
              {reasons.map((reason, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-charcoal/60">
                  <svg viewBox="0 0 12 12" fill="#16a34a" className="h-2.5 w-2.5 shrink-0">
                    <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm2.5 4l-3 3a.5.5 0 01-.7 0l-1.5-1.5a.5.5 0 11.7-.7L5.1 7.2l2.7-2.7a.5.5 0 01.7.7z" />
                  </svg>
                  {reason}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── AI MATCHING ALGORITHM ─────────────────────────────────────────── */

function matchProperty(p: Property, prefs: { budget: number; beds: number; neighborhoods: string[] }) {
  let score = 0
  const reasons: string[] = []

  if (p.priceEtb <= prefs.budget) { score += 30; reasons.push('Within your budget') }
  else if (p.priceEtb <= prefs.budget * 1.15) { score += 20; reasons.push('Slightly above budget') }
  else { score += 8 }

  if (p.beds === prefs.beds) { score += 20; reasons.push(`${p.beds} bedrooms — perfect match`) }
  else if (Math.abs(p.beds - prefs.beds) === 1) { score += 12; reasons.push(`${p.beds} bedrooms — close`) }
  else { score += 4 }

  if (prefs.neighborhoods.includes(p.neighborhood)) { score += 25; reasons.push(`In ${p.neighborhood}`) }
  else { score += 8 }

  if (p.verified) { score += 15; reasons.push('Verified listing') } else { score += 5 }

  if (p.rating >= 4.5) { score += 10; reasons.push(`Highly rated (${p.rating}★)`) }
  else if (p.rating >= 4.0) { score += 7 } else { score += 3 }

  return { property: p, score: Math.min(score, 99), reasons: reasons.slice(0, 3) }
}

/* ─── MAIN COMPONENT ────────────────────────────────────────────────── */

export default function DiscoverySplit({ filters = {} }: DiscoverySplitProps) {
  const { t } = useLanguage()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'split' | 'map'>('split')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const itemsPerPage = 5

  // Real API properties
  const [apiProperties, setApiProperties] = useState<Property[]>([])
  useEffect(() => {
    let cancelled = false
    fetchProperties({}).then((props) => {
      if (!cancelled && props.length > 0) setApiProperties(props)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const PROPERTIES_DATA = apiProperties.length > 0 ? apiProperties : PROPERTIES

  // Filter state
  const [neighborhood, setNeighborhood] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [bedsRange, setBedsRange] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [furnished, setFurnished] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sortBy, setSortBy] = useState('best')

  const activeFilterCount = [neighborhood, propertyType, priceRange, bedsRange, furnished, verifiedOnly].filter(Boolean).length

  // Build filters object
  const dynamicFilters: SearchFilters = useMemo(() => {
    const f: SearchFilters = { ...filters }
    if (neighborhood) f.neighborhood = neighborhood as any
    if (propertyType) f.propertyType = propertyType as any
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number)
      if (min) f.minPrice = min
      if (max) f.maxPrice = max
    }
    if (bedsRange) {
      f.beds = parseInt(bedsRange, 10)
    }
    return f
  }, [filters, neighborhood, propertyType, priceRange, bedsRange])

  // Apply filters
  const allFiltered = useMemo(() => {
    let result = filterProperties(PROPERTIES_DATA, dynamicFilters)
    if (verifiedOnly) result = result.filter((p) => p.verified)

    // Sort
    if (sortBy === 'price-asc') {
      result = [...result].sort((a, b) => a.priceEtb - b.priceEtb)
    } else if (sortBy === 'price-desc') {
      result = [...result].sort((a, b) => b.priceEtb - a.priceEtb)
    } else if (sortBy === 'newest') {
      result = [...result].sort((a, b) => {
        const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0
        const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0
        return dateB - dateA
      })
    }

    return result
  }, [dynamicFilters, verifiedOnly, sortBy])

  // AI matches for the top 3
  const aiMatches = useMemo(() => {
    const prefs = { budget: 20000, beds: 2, neighborhoods: ['Bole', 'Kazanchis'] }
    return PROPERTIES_DATA
      .map((p) => matchProperty(p, prefs))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [])

  // Pagination
  const totalPages = Math.ceil(allFiltered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProperties = allFiltered.slice(startIndex, endIndex)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    const listContainer = document.querySelector('[data-property-list]')
    if (listContainer) listContainer.scrollTop = 0
  }

  const clearAllFilters = useCallback(() => {
    setNeighborhood('')
    setPropertyType('')
    setPriceRange('')
    setBedsRange('')
    setFurnished(false)
    setVerifiedOnly(false)
    setCurrentPage(1)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Filter Bar */}
      <div className="border-b border-charcoal/10 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Location Filter */}
              <FilterDropdown
                label="All Cities"
                value={neighborhood}
                active={!!neighborhood}
                onChange={(v) => { setNeighborhood(v); setCurrentPage(1) }}
                options={[
                  { label: 'All Cities', value: '' },
                  // Addis Ababa
                  { label: '─── Addis Ababa ───', value: '__header_aa' },
                  { label: 'Bole', value: 'Bole' },
                  { label: 'Kazanchis', value: 'Kazanchis' },
                  { label: 'CMC', value: 'CMC' },
                  { label: 'Saris', value: 'Saris' },
                  { label: 'Yeka', value: 'Yeka' },
                  { label: 'Piassa', value: 'Piassa' },
                  { label: 'Merkato', value: 'Merkato' },
                  { label: 'Arat Kilo', value: 'Arat Kilo' },
                  // Other Cities
                  { label: '─── Other Cities ───', value: '__header_other' },
                  { label: 'Hawassa', value: 'Hawassa' },
                  { label: 'Bahir Dar', value: 'Bahir Dar' },
                  { label: 'Dire Dawa', value: 'Dire Dawa' },
                  { label: 'Mekelle', value: 'Mekelle' },
                  { label: 'Adama', value: 'Adama' },
                  { label: 'Jimma', value: 'Jimma' },
                  { label: 'Gondar', value: 'Gondar' },
                  { label: 'Dessie', value: 'Dessie' },
                  { label: 'Harar', value: 'Harar' },
                  { label: 'Axum', value: 'Axum' },
                ]}
              />

              {/* Property Type Filter */}
              <FilterDropdown
                label="Property Type"
                value={propertyType}
                active={!!propertyType}
                onChange={(v) => { setPropertyType(v); setCurrentPage(1) }}
                options={[
                  { label: 'Any Type', value: '' },
                  { label: 'Apartment', value: 'apartment' },
                  { label: 'House', value: 'house' },
                  { label: 'Villa', value: 'villa' },
                  { label: 'Studio', value: 'studio' },
                ]}
              />

              {/* Price Filter */}
              <RangeFilter
                label="Price"
                value={priceRange}
                active={!!priceRange}
                onChange={(v) => { setPriceRange(v); setCurrentPage(1) }}
                ranges={[
                  { label: 'Any Price', value: '' },
                  { label: 'Under ETB 10,000', value: '0-10000' },
                  { label: 'ETB 10,000 – 15,000', value: '10000-15000' },
                  { label: 'ETB 15,000 – 20,000', value: '15000-20000' },
                  { label: 'ETB 20,000 – 25,000', value: '20000-25000' },
                  { label: 'Over ETB 25,000', value: '25000-999999' },
                ]}
              />

              {/* Bedrooms Filter */}
              <RangeFilter
                label="Bedrooms"
                value={bedsRange}
                active={!!bedsRange}
                onChange={(v) => { setBedsRange(v); setCurrentPage(1) }}
                ranges={[
                  { label: 'Any', value: '' },
                  { label: '1 Bedroom', value: '1' },
                  { label: '2 Bedrooms', value: '2' },
                  { label: '3 Bedrooms', value: '3' },
                  { label: '4+ Bedrooms', value: '4' },
                ]}
              />

              {/* More Filters */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreFilters(!showMoreFilters)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    (furnished || verifiedOnly)
                      ? 'border-rust bg-rust/5 text-rust'
                      : 'border-charcoal/15 bg-white text-charcoal/60 hover:border-rust'
                  }`}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path d="M3 4h14M6 8h8M9 12h2" strokeLinecap="round" />
                  </svg>
                  <span>More Filters</span>
                  {(furnished || verifiedOnly) && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rust text-[10px] font-bold text-white">
                      {(furnished ? 1 : 0) + (verifiedOnly ? 1 : 0)}
                    </span>
                  )}
                </button>
                <MoreFiltersPanel
                  open={showMoreFilters}
                  onClose={() => setShowMoreFilters(false)}
                  furnished={furnished}
                  setFurnished={setFurnished}
                  verifiedOnly={verifiedOnly}
                  setVerifiedOnly={setVerifiedOnly}
                />
              </div>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-rust hover:bg-rust/5 transition-colors"
                >
                  Clear all ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {/* AI Match Toggle */}
              <button
                type="button"
                onClick={() => setShowAiPanel(!showAiPanel)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showAiPanel ? 'bg-rust text-white' : 'border border-charcoal/15 text-charcoal/60 hover:border-rust hover:text-rust'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                  <path d="M10 2l2 4.5 5 .7-3.6 3.5.9 5-4.3-2.3-4.3 2.3.9-5L3 7.2l5-.7L10 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                AI Match
              </button>

              {/* Save Search */}
              <button className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-rust transition-colors">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M5 4.5a2.5 2.5 0 015 0c0 .87-.45 1.63-1.13 2.07a2.5 2.5 0 003.63 2.43M5 4.5V17l5-3 5 3V4.5" />
                </svg>
                <span>Save Search</span>
              </button>

              {/* Alerts */}
              <button className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-rust transition-colors">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M10 6v4l2 2M15 10a5 5 0 11-10 0 5 5 0 0110 0z" />
                </svg>
                <span>Alerts</span>
              </button>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 pr-8 text-xs font-semibold text-charcoal/60 hover:border-rust focus:border-rust focus:outline-none cursor-pointer"
                >
                  <option value="best">Best Match</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
                <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal/40">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-0.5 rounded-lg border border-charcoal/15 bg-white p-1">
                {(['list', 'split', 'map'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors capitalize ${
                      view === v ? 'bg-rust text-white' : 'text-charcoal/50 hover:text-charcoal'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="border-b border-charcoal/10 bg-cream/50 px-4 py-2 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-charcoal/70">
            <span className="font-semibold text-charcoal">{allFiltered.length} verified homes</span> found · Showing {allFiltered.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, allFiltered.length)}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-7xl px-4 sm:px-6">
          <div className="grid h-full grid-cols-1 gap-0 lg:grid-cols-2">
            {/* Property List */}
            <div className="flex flex-col gap-3 overflow-y-auto py-4 pr-3" data-property-list>

              {/* AI Match Panel (collapsible) */}
              {showAiPanel && (
                <div className="rounded-xl border border-rust/20 bg-rust-tint/20 p-4 mb-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rust/10">
                        <svg viewBox="0 0 20 20" fill="none" stroke="#B8451F" strokeWidth={1.5} className="h-3.5 w-3.5">
                          <path d="M10 2l2 4.5 5 .7-3.6 3.5.9 5-4.3-2.3-4.3 2.3.9-5L3 7.2l5-.7L10 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-semibold text-charcoal">AI-Matched Homes</h3>
                        <p className="text-[10px] text-charcoal/50">Based on budget, location, and bedroom preferences</p>
                      </div>
                    </div>
                    <button onClick={() => setShowAiPanel(false)} className="text-charcoal/30 hover:text-charcoal">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {aiMatches.map((m) => (
                      <AiMatchCard key={m.property.id} property={m.property} score={m.score} reasons={m.reasons} />
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {currentProperties.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-sand flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-charcoal/30">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="font-display text-base font-semibold text-charcoal">No homes match your filters</p>
                  <p className="mt-1 text-sm text-charcoal/50">Try adjusting your filters or <button onClick={clearAllFilters} className="text-rust hover:underline">clear all filters</button></p>
                </div>
              )}

              {/* Property cards */}
              {currentProperties.map((property) => (
                <Link
                  key={property.id}
                  href={`/property/${property.id}`}
                  onMouseEnter={() => setHoveredId(property.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(property.id)}
                  onBlur={() => setHoveredId(null)}
                  className={`group flex gap-4 rounded-xl border bg-white p-3 transition-all ${
                    hoveredId === property.id
                      ? 'border-rust shadow-lg'
                      : 'border-charcoal/10 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Property Image */}
                  <div className="relative h-32 w-40 shrink-0 overflow-hidden rounded-lg">
                    <Image src={property.image} alt={property.title} fill sizes="160px" className="object-cover" />
                    {property.verified && (
                      <span className="absolute left-2 top-2 rounded bg-verified px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Verified
                      </span>
                    )}
                  </div>

                  {/* Property Details */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="font-display text-base font-bold text-charcoal group-hover:text-rust transition-colors">
                        {property.title}
                      </p>
                      <p className="mt-0.5 text-sm text-charcoal/60">
                        {property.neighborhood}
                      </p>
                    </div>

                    <div>
                      <p className="mt-2 text-lg font-bold text-charcoal">
                        ETB {property.priceEtb.toLocaleString()}
                        <span className="text-sm font-normal text-charcoal/50"> / month</span>
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-charcoal/60">
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                          </svg>
                          {property.beds} Beds
                        </span>
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          {property.baths} Bath
                        </span>
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                          </svg>
                          {property.sizeSqm} m²
                        </span>
                      </div>

                      {/* Rating */}
                      <div className="mt-2 flex items-center gap-1">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-rust">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs font-semibold text-charcoal">{property.rating}</span>
                        <span className="text-xs text-charcoal/50">({property.reviewCount})</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <button
                    onClick={() => currentPage > 1 && goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border border-charcoal/15 transition-colors ${
                      currentPage === 1 ? 'text-charcoal/20 cursor-not-allowed' : 'text-charcoal hover:border-rust hover:text-rust'
                    }`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-charcoal/40">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page as number)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                          currentPage === page ? 'bg-rust text-white shadow-sm' : 'border border-charcoal/15 text-charcoal hover:border-rust hover:text-rust'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}

                  <button
                    onClick={() => currentPage < totalPages && goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border border-charcoal/15 transition-colors ${
                      currentPage === totalPages ? 'text-charcoal/20 cursor-not-allowed' : 'text-charcoal hover:border-rust hover:text-rust'
                    }`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Map */}
            <div className="relative h-full overflow-hidden border-l border-charcoal/10">
              <PropertyMap properties={currentProperties} hoveredId={hoveredId} onHoverChange={setHoveredId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
