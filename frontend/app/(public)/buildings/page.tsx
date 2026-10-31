'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PROPERTIES, formatEtb, type Property } from '@/lib/properties'
import { useLanguage } from '@/lib/language-context'

export default function BuildingsDirectoryPage() {
  const { locale } = useLanguage()

  // Filter states
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All')
  const [minFloors, setMinFloors] = useState<number | ''>('')
  const [facilityFilter, setFacilityFilter] = useState<string[]>([])

  // All commercial building properties
  const allBuildings = useMemo(() => {
    return PROPERTIES.filter(
      (p) => p.propertyType === 'building' || p.propertyType === 'commercial' || Boolean(p.buildingDetails)
    )
  }, [])

  // Filtered buildings
  const filteredBuildings = useMemo(() => {
    return allBuildings.filter((b) => {
      if (selectedNeighborhood !== 'All' && b.neighborhood !== selectedNeighborhood) {
        return false
      }
      if (minFloors && (b.buildingDetails?.totalFloors || 1) < minFloors) {
        return false
      }
      if (facilityFilter.length > 0) {
        const amenities = (b.amenities || []).map((a) => a.toLowerCase())
        const matchAll = facilityFilter.every((f) => amenities.some((a) => a.includes(f)))
        if (!matchAll) return false
      }
      return true
    })
  }, [allBuildings, selectedNeighborhood, minFloors, facilityFilter])

  const toggleFacility = (facility: string) => {
    setFacilityFilter((prev) =>
      prev.includes(facility) ? prev.filter((f) => f !== facility) : [...prev, facility]
    )
  }

  return (
    <div className="min-h-screen bg-sand/25 pb-16">
      {/* ─── Page Header with Category Tabs ─── */}
      <div className="border-b border-charcoal/10 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Category Switcher Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal/15 bg-sand/30 px-4 py-2 text-xs font-bold text-charcoal/70 hover:bg-sand hover:text-charcoal transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-charcoal/60">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>{locale === 'AM' ? 'መኖሪያ ቤቶች (Homes & Apartments)' : 'Residential Homes & Apartments'}</span>
            </Link>
            <div className="inline-flex items-center gap-2 rounded-xl bg-rust px-4 py-2 text-xs font-bold text-white shadow-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
              <span>{locale === 'AM' ? 'የንግድ ህንፃዎች (Commercial Buildings)' : 'Commercial Buildings & Offices'}</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-charcoal">
                {locale === 'AM'
                  ? 'የንግድ ህንፃዎችና ቢሮዎች በኢትዮጵያ'
                  : 'Commercial Buildings & Office Towers'}
              </h1>
              <p className="mt-2 text-sm text-charcoal/60 max-w-2xl leading-relaxed">
                {locale === 'AM'
                  ? 'ባለብዙ ፎቅ የንግድ ህንፃዎችን ይመልከቱ፣ የሚፈልጉትን ፎቅ ይምረጡ፣ በውስጡ ያሉ የግል ቢሮዎችንና ሱቆችን በቀላሉ ይከራዩ።'
                  : 'Browse multi-storey commercial towers in Addis Ababa. Select a building, explore each floor, and rent individual private office rooms, retail shops, or entire corporate headquarters.'}
              </p>
            </div>

            <Link
              href="/landlord/properties/new"
              className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-xs font-bold text-white hover:bg-rust transition-colors shadow-sm shrink-0"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>{locale === 'AM' ? 'ህንፃዎን ያስመዝግቡ' : 'List a Commercial Building'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Commercial Filter Bar ─── */}
      <div className="sticky top-16 z-30 border-b border-charcoal/10 bg-white/95 backdrop-blur-md py-3 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Neighborhood Filter */}
            <div>
              <select
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                className="rounded-lg border border-charcoal/20 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal focus:border-rust focus:outline-none"
              >
                <option value="All">All Neighborhoods</option>
                <option value="Bole">Bole</option>
                <option value="Kazanchis">Kazanchis</option>
                <option value="CMC">CMC</option>
                <option value="Piassa">Piassa</option>
                <option value="Saris">Saris</option>
              </select>
            </div>

            {/* Floor Count Filter */}
            <div>
              <select
                value={minFloors}
                onChange={(e) => setMinFloors(e.target.value ? Number(e.target.value) : '')}
                className="rounded-lg border border-charcoal/20 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal focus:border-rust focus:outline-none"
              >
                <option value="">Any Number of Floors</option>
                <option value="3">3+ Storey Buildings</option>
                <option value="5">5+ Storey Towers</option>
                <option value="7">7+ Storey High-Rises</option>
              </select>
            </div>

            {/* Facility Quick Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'generator', label: 'Dual Generator' },
                { key: 'elevator', label: 'Elevator' },
                { key: 'parking', label: 'Parking' },
                { key: 'wifi', label: 'Fiber Internet' },
              ].map(({ key, label }) => {
                const active = facilityFilter.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFacility(key)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-rust bg-rust/10 text-rust font-bold'
                        : 'border-charcoal/15 bg-white text-charcoal/60 hover:border-charcoal/30'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="text-xs text-charcoal/60">
            Showing <strong className="font-bold text-charcoal">{filteredBuildings.length}</strong> commercial {filteredBuildings.length === 1 ? 'building' : 'buildings'}
          </div>
        </div>
      </div>

      {/* ─── Buildings Grid ─── */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {filteredBuildings.length === 0 ? (
          <div className="rounded-2xl border border-charcoal/15 bg-white p-12 text-center max-w-md mx-auto">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sand text-charcoal/40">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-charcoal">No Buildings Found</h3>
            <p className="text-xs text-charcoal/60 mt-1">
              Try adjusting your filter criteria to see available buildings.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedNeighborhood('All')
                setMinFloors('')
                setFacilityFilter([])
              }}
              className="mt-4 rounded-lg bg-rust px-4 py-2 text-xs font-bold text-white shadow cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBuildings.map((building) => {
              const details = building.buildingDetails
              const totalFloors = details?.totalFloors || 5
              const totalUnits = details?.units?.length || 12
              const availableUnits = details?.units?.filter((u) => u.status === 'available').length || totalUnits
              const minRent = details?.units && details.units.length > 0
                ? Math.min(...details.units.map((u) => u.monthlyRent || (u as any).rentAmount || 999999).filter(Boolean))
                : building.priceEtb

              return (
                <div
                  key={building.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-charcoal/15 bg-white shadow-sm hover:shadow-md hover:border-rust/40 transition-all"
                >
                  {/* Building Photo */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-charcoal/10">
                    <Image
                      src={building.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'}
                      alt={building.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />

                    {/* Verified & Floor Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="rounded bg-verified px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Verified Building
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                      <div>
                        <span className="inline-block rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-bold text-white">
                          {totalFloors} Floors
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-bold text-white">
                          {availableUnits} Rooms Available
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Building Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="font-display text-lg font-bold text-charcoal group-hover:text-rust transition-colors">
                        {building.title}
                      </h2>
                      <p className="mt-1 flex items-center gap-1 text-xs text-charcoal/60">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-rust shrink-0">
                          <path
                            fillRule="evenodd"
                            d="M10 18s6-5.7 6-10.5A6 6 0 004 7.5C4 12.3 10 18 10 18zm0-8a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{building.neighborhood}, Addis Ababa</span>
                      </p>

                      <p className="mt-2.5 text-xs text-charcoal/70 line-clamp-2 leading-relaxed">
                        {building.description || 'Premier commercial building featuring private office suites, whole corporate floors, and backup power.'}
                      </p>

                      {/* Floor & Space Highlights */}
                      <div className="mt-4 rounded-xl bg-sand/30 p-3 border border-charcoal/10">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 mb-1.5">
                          Floor Breakdown
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-charcoal font-medium">
                          <span className="rounded bg-white px-2 py-0.5 border border-charcoal/10">
                            Ground: Retail Space
                          </span>
                          <span className="rounded bg-white px-2 py-0.5 border border-charcoal/10">
                            Floors 1–{Math.max(2, totalFloors - 1)}: Office Suites
                          </span>
                          <span className="rounded bg-white px-2 py-0.5 border border-charcoal/10">
                            Top Level: Corporate Floor
                          </span>
                        </div>
                      </div>

                      {/* Building Facilities */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-charcoal/60">
                        <span>Generator</span>
                        <span>•</span>
                        <span>Elevator</span>
                        <span>•</span>
                        <span>Parking</span>
                        <span>•</span>
                        <span>Fiber</span>
                      </div>
                    </div>

                    {/* Price and Action Button */}
                    <div className="mt-5 pt-4 border-t border-charcoal/10 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] text-charcoal/50 uppercase font-semibold">Rooms Start From</p>
                        <p className="font-display text-base font-bold text-charcoal">
                          {formatEtb(minRent)} <span className="font-sans text-xs font-normal text-charcoal/50">/ mo</span>
                        </p>
                      </div>

                      <Link
                        href={`/property/${building.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rust px-4 py-2 text-xs font-bold text-white shadow hover:bg-rust-dark transition-colors"
                      >
                        <span>Browse Floors & Rooms</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
