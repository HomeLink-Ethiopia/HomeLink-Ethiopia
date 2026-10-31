'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/tenant/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Neighborhood {
  _id: string
  name: string
  city: string
  overall: number
  scores: {
    safety: number
    noise: number
    floodRisk: number
    waterReliability: number
    electricityReliability: number
    internet: number
    transport: number
  }
  summary?: string
  highlights?: string[]
  avgRentEstimate?: number
  listingsCount?: number
}

const DEFAULT_NEIGHBORHOODS: Neighborhood[] = [
  // Addis Ababa
  {
    _id: 'neigh-bole',
    name: 'Bole',
    city: 'Addis Ababa',
    overall: 89,
    scores: { safety: 88, noise: 62, floodRisk: 85, waterReliability: 82, electricityReliability: 86, internet: 92, transport: 94 },
    summary: 'Addis Ababa’s premier commercial and residential hub. Bustling nightlife, top international restaurants, embassies, and excellent airport proximity with reliable 4G/5G coverage.',
    highlights: ['Edna Mall & Medhanialem area', 'Direct airport highway access', 'High concentration of backup water tanks & generators', 'Safe well-lit pedestrian corridors'],
    avgRentEstimate: 42000,
    listingsCount: 24,
  },
  {
    _id: 'neigh-kazanchis',
    name: 'Kazanchis',
    city: 'Addis Ababa',
    overall: 84,
    scores: { safety: 83, noise: 58, floodRisk: 88, waterReliability: 79, electricityReliability: 84, internet: 90, transport: 96 },
    summary: 'The diplomatic and financial nerve center hosting UNECA, major international hotels, and government agencies. Unbeatable central location with walking access to business offices.',
    highlights: ['UNECA & ECA compound', 'Walking distance to Meskel Square', 'Abundant public transport and taxis', 'High security zone'],
    avgRentEstimate: 36000,
    listingsCount: 18,
  },
  {
    _id: 'neigh-cmc',
    name: 'CMC',
    city: 'Addis Ababa',
    overall: 86,
    scores: { safety: 89, noise: 82, floodRisk: 80, waterReliability: 76, electricityReliability: 80, internet: 84, transport: 81 },
    summary: 'A peaceful, tree-lined residential district in eastern Addis Ababa popular with families and returning diaspora. Characterized by gated compounds, clean streets, and light-rail transit access.',
    highlights: ['Quiet gated compounds & villas', 'Addis Light Rail transit stops', 'Good private schools & clinics', 'Low evening noise levels'],
    avgRentEstimate: 32000,
    listingsCount: 20,
  },
  {
    _id: 'neigh-old-airport',
    name: 'Old Airport',
    city: 'Addis Ababa',
    overall: 91,
    scores: { safety: 93, noise: 86, floodRisk: 88, waterReliability: 85, electricityReliability: 88, internet: 89, transport: 82 },
    summary: 'Prestigious expat and diplomatic residential neighborhood adjacent to the International Community School (ICS), the Golf Club, and European embassies. Very safe and quiet.',
    highlights: ['Beside ICS & Bisrate Gabriel', 'High 24/7 private security presence', 'Spacious compound homes with gardens', 'Minimal through-traffic noise'],
    avgRentEstimate: 55000,
    listingsCount: 12,
  },
  {
    _id: 'neigh-sarbet',
    name: 'Sarbet',
    city: 'Addis Ababa',
    overall: 85,
    scores: { safety: 86, noise: 71, floodRisk: 84, waterReliability: 80, electricityReliability: 83, internet: 88, transport: 90 },
    summary: 'A vibrant midtown district bridging Kirkos and Nifas Silk. Close to the African Union headquarters, Karl Square, and leading private healthcare institutions.',
    highlights: ['Proximity to African Union HQ', 'Bustling café culture & bakeries', 'Fast access to Ring Road', 'Reliable telecommunications'],
    avgRentEstimate: 35000,
    listingsCount: 15,
  },
  {
    _id: 'neigh-gerji',
    name: 'Gerji',
    city: 'Addis Ababa',
    overall: 80,
    scores: { safety: 79, noise: 68, floodRisk: 78, waterReliability: 74, electricityReliability: 78, internet: 82, transport: 86 },
    summary: 'An accessible, diverse eastern sub-city neighborhood featuring modern condominium complexes (Mebrat Hail, Sunshine) and direct links to Bole Medhanialem and Gurd Shola.',
    highlights: ['Affordable quality condominiums', 'Near Unity University & commercial strips', 'Frequent minibus and taxi connections', 'Family-friendly parks'],
    avgRentEstimate: 24000,
    listingsCount: 22,
  },
  {
    _id: 'neigh-summit',
    name: 'Summit',
    city: 'Addis Ababa',
    overall: 82,
    scores: { safety: 84, noise: 85, floodRisk: 77, waterReliability: 72, electricityReliability: 76, internet: 80, transport: 76 },
    summary: 'Modern planned residential area beyond CMC known for spacious real estate developments (Ayat, Safari) with scenic surrounding mountain views and serene surroundings.',
    highlights: ['Serene low-noise environment', 'Newly built apartments with parking', 'Lower rent per square meter', 'Growing shopping & grocery plazas'],
    avgRentEstimate: 22000,
    listingsCount: 16,
  },
  {
    _id: 'neigh-piassa',
    name: 'Piassa',
    city: 'Addis Ababa',
    overall: 78,
    scores: { safety: 76, noise: 52, floodRisk: 90, waterReliability: 78, electricityReliability: 82, internet: 86, transport: 95 },
    summary: 'The historic heart of modern Ethiopia, recently revitalized with expansive pedestrian boulevards, cultural heritage centers, and central government district access.',
    highlights: ['Newly renovated pedestrian corridors', 'Direct access to Arat Kilo & Churchill Ave', 'Historic cafés and jewelry quarters', 'Abundant public transport'],
    avgRentEstimate: 28000,
    listingsCount: 10,
  },

  // Hawassa
  {
    _id: 'neigh-hawassa-haik-dar',
    name: 'Piazza & Haik Dar',
    city: 'Hawassa',
    overall: 88,
    scores: { safety: 90, noise: 86, floodRisk: 82, waterReliability: 86, electricityReliability: 84, internet: 85, transport: 88 },
    summary: 'Hawassa’s prime lakeside district with lush palm avenues, world-class resort hotels, peaceful evening walking tracks, and fresh Lake Hawassa breezes.',
    highlights: ['Direct Lake Hawassa shoreline access', 'Walking distance to Amora Gedel Park', 'Extremely low crime rate & family safe', 'Abundant fresh local fish markets'],
    avgRentEstimate: 19000,
    listingsCount: 14,
  },
  {
    _id: 'neigh-hawassa-millennium',
    name: 'Millennium District',
    city: 'Hawassa',
    overall: 85,
    scores: { safety: 87, noise: 84, floodRisk: 86, waterReliability: 82, electricityReliability: 81, internet: 83, transport: 80 },
    summary: 'A fast-growing, well-planned residential suburb in Hawassa featuring new villa homes, wide asphalt roadways, and good access to Hawassa Industrial Park.',
    highlights: ['Wide paved avenues & parking', 'Peaceful residential living', 'Near Hawassa University referral center', 'Consistent municipal services'],
    avgRentEstimate: 16500,
    listingsCount: 11,
  },

  // Bahir Dar
  {
    _id: 'neigh-bahirdar-tana',
    name: 'Lake Tana Waterfront',
    city: 'Bahir Dar',
    overall: 89,
    scores: { safety: 91, noise: 88, floodRisk: 83, waterReliability: 85, electricityReliability: 82, internet: 84, transport: 86 },
    summary: 'Bahir Dar’s renowned palm-lined avenue overlooking Lake Tana and the source of the Blue Nile. Clean, peaceful, and celebrated for scenic natural beauty.',
    highlights: ['Spectacular Lake Tana views & boat jetties', 'Wide palm-tree pedestrian promenade', 'Top resorts, cafés, and cultural centers', 'Quiet evening atmosphere'],
    avgRentEstimate: 18000,
    listingsCount: 12,
  },
  {
    _id: 'neigh-bahirdar-felege-hiwot',
    name: 'Felege Hiwot / Kebele 3',
    city: 'Bahir Dar',
    overall: 83,
    scores: { safety: 85, noise: 76, floodRisk: 85, waterReliability: 81, electricityReliability: 80, internet: 82, transport: 90 },
    summary: 'Central Bahir Dar district offering prime access to Felege Hiwot Hospital, regional commerce, schools, and quick transport across the city.',
    highlights: ['Walking distance to major hospitals & clinics', 'Frequent bajaj and taxi links', 'Family-friendly residential streets', 'Reliable commercial services'],
    avgRentEstimate: 14500,
    listingsCount: 9,
  },

  // Dire Dawa
  {
    _id: 'neigh-diredawa-kezira',
    name: 'Kezira',
    city: 'Dire Dawa',
    overall: 90,
    scores: { safety: 92, noise: 87, floodRisk: 88, waterReliability: 84, electricityReliability: 85, internet: 86, transport: 90 },
    summary: 'The historic, grid-planned European railway quarter of Dire Dawa. Distinguished by lush giant neem trees, French colonial architecture, and high safety standards.',
    highlights: ['Historic Franco-Ethiopian railway heritage', 'Shaded tree-lined boulevards', 'Very clean and exceptionally safe', 'Proximity to Dire Dawa International Airport'],
    avgRentEstimate: 17000,
    listingsCount: 13,
  },
  {
    _id: 'neigh-diredawa-sabian',
    name: 'Sabian',
    city: 'Dire Dawa',
    overall: 82,
    scores: { safety: 83, noise: 78, floodRisk: 84, waterReliability: 80, electricityReliability: 81, internet: 82, transport: 85 },
    summary: 'An established residential quarter popular with local professionals and civil servants. Quiet, neighborhood-focused, and well serviced by local markets.',
    highlights: ['Affordable compound homes & villas', 'Quality private and government schools', 'Close community feel', 'Good transit links'],
    avgRentEstimate: 13500,
    listingsCount: 8,
  },

  // Adama
  {
    _id: 'neigh-adama-bole',
    name: 'Bole Adama',
    city: 'Adama',
    overall: 84,
    scores: { safety: 85, noise: 78, floodRisk: 88, waterReliability: 80, electricityReliability: 82, internet: 85, transport: 92 },
    summary: 'Adama’s premier modern residential district along the Addis-Adama Expressway corridor. Excellent commercial activity and fast 45-minute highway access to the capital.',
    highlights: ['Direct Addis-Adama Expressway access', 'Modern commercial banks & dining', 'Spacious residential compounds', 'Rapidly appreciating rental values'],
    avgRentEstimate: 15000,
    listingsCount: 15,
  },

  // Bishoftu
  {
    _id: 'neigh-bishoftu-kuriftu',
    name: 'Kuriftu Lakefront',
    city: 'Bishoftu',
    overall: 91,
    scores: { safety: 93, noise: 90, floodRisk: 89, waterReliability: 85, electricityReliability: 86, internet: 87, transport: 82 },
    summary: 'Serene lakeside living around famous volcanic crater lakes. Pristine air quality, mild year-round climate, luxury weekend villas, and fast highway link to Addis Ababa.',
    highlights: ['Crater lake views & resort amenities', 'Tranquil retreat living with high safety', 'Fast 35-min expressway commute to Addis Ababa', 'Ideal for remote workers & families'],
    avgRentEstimate: 23000,
    listingsCount: 10,
  },

  // Mekelle
  {
    _id: 'neigh-mekelle-ayder',
    name: 'Ayder',
    city: 'Mekelle',
    overall: 83,
    scores: { safety: 84, noise: 80, floodRisk: 86, waterReliability: 79, electricityReliability: 80, internet: 81, transport: 86 },
    summary: 'The educational and medical epicenter of Mekelle, hosting Ayder Comprehensive Hospital and Mekelle University campuses with wide paved avenues.',
    highlights: ['Beside Ayder Referral Hospital & University', 'Modern apartment housing', 'Reliable commercial center', 'Wide planned road networks'],
    avgRentEstimate: 15500,
    listingsCount: 9,
  },
]

const DIMENSIONS: { key: keyof Neighborhood['scores']; label: string; hint: string }[] = [
  { key: 'safety', label: 'Safety', hint: 'Reported incidents, street lighting, police presence' },
  { key: 'noise', label: 'Quietness', hint: 'Higher = quieter streets (traffic, nightlife, markets)' },
  { key: 'floodRisk', label: 'Flood safety', hint: 'Higher = lower flood risk in rainy season' },
  { key: 'waterReliability', label: 'Water reliability', hint: 'Municipal supply consistency & backup availability' },
  { key: 'electricityReliability', label: 'Electricity reliability', hint: 'Grid stability & backup generator support' },
  { key: 'internet', label: 'Internet', hint: 'Fiber/mobile 4G/5G coverage quality' },
  { key: 'transport', label: 'Transport', hint: 'Bus, minibus, taxi and highway/transit access' },
]

const scoreColor = (v: number) =>
  v >= 85 ? 'bg-emerald-500' : v >= 75 ? 'bg-green-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500'

export default function NeighborhoodsPage() {
  const [all, setAll] = useState<Neighborhood[]>(DEFAULT_NEIGHBORHOODS)
  const [selectedCity, setSelectedCity] = useState<string>('All')
  const [selected, setSelected] = useState<string[]>(['Bole', 'Piazza & Haik Dar'])

  useEffect(() => {
    fetch(`${API_URL}/api/v1/neighborhoods`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.data) && d.data.length > 0) {
          setAll(d.data)
        }
      })
      .catch(() => {
        // Fallback remains active
      })
  }, [])

  // Unique list of cities with counts
  const cities = useMemo(() => {
    const map = new Map<string, number>()
    all.forEach((n) => {
      map.set(n.city, (map.get(n.city) || 0) + 1)
    })
    return Array.from(map.entries()).map(([city, count]) => ({ city, count }))
  }, [all])

  // Filtered list based on selectedCity
  const displayedNeighborhoods = useMemo(() => {
    if (selectedCity === 'All') return all
    return all.filter((n) => n.city.toLowerCase() === selectedCity.toLowerCase())
  }, [all, selectedCity])

  const compared = useMemo(
    () => selected.map((n) => all.find((x) => x.name === n)).filter(Boolean) as Neighborhood[],
    [selected, all]
  )

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) {
        if (prev.length <= 1) return prev // keep at least 1
        return prev.filter((p) => p !== name)
      }
      if (prev.length >= 4) return [...prev.slice(1), name] // keep last 3 + new
      return [...prev, name]
    })
  }

  // Best value in each dimension among the compared set
  const bestOf = (key: keyof Neighborhood['scores']) =>
    compared.length >= 2 ? Math.max(...compared.map((c) => c.scores[key])) : null

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-charcoal">Ethiopian Neighborhood & Regional Guide</h1>
            <span className="rounded-full bg-rust/10 px-2.5 py-0.5 text-xs font-semibold text-rust">
              {all.length} Regions & Cities
            </span>
          </div>
          <p className="text-sm text-charcoal/60 mt-1 max-w-3xl leading-relaxed">
            Compare safety, water reliability, power consistency, and rent prices across Addis Ababa, Hawassa, Bahir Dar, Dire Dawa, Adama, Bishoftu, and Mekelle to find the ideal location for your household.
          </p>
        </div>

        {/* ─── CITY FILTER TABS ─── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-charcoal/10 pb-3">
          <button
            type="button"
            onClick={() => setSelectedCity('All')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              selectedCity === 'All'
                ? 'bg-charcoal text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/70 hover:bg-sand/30'
            }`}
          >
            All Cities <span className="ml-1 opacity-75">({all.length})</span>
          </button>
          {cities.map(({ city, count }) => {
            const isActive = selectedCity.toLowerCase() === city.toLowerCase()
            return (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-rust text-white shadow-sm'
                    : 'border border-charcoal/15 bg-white text-charcoal/70 hover:border-rust hover:text-rust'
                }`}
              >
                {city} <span className="ml-1 opacity-75">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Pick up to 4 to compare */}
        <div className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal/60">
              Select 2–4 Areas to Compare <span className="text-charcoal/40 font-normal">({selected.length}/4 selected)</span>
            </p>
            <span className="text-xs text-charcoal/40">
              Showing {displayedNeighborhoods.length} areas {selectedCity !== 'All' ? `in ${selectedCity}` : 'across Ethiopia'}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {displayedNeighborhoods.map((n) => {
              const active = selected.includes(n.name)
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => toggle(n.name)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'border-rust bg-rust text-white shadow-sm'
                      : 'border-charcoal/15 bg-cream/30 text-charcoal/70 hover:border-rust hover:text-rust'
                  }`}
                >
                  <span>{n.name}</span>
                  <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-charcoal/5 text-charcoal/50'}`}>
                    {n.city}
                  </span>
                  <span className="text-[11px] opacity-90">★ {n.overall}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Side-by-side comparison table */}
        {compared.length >= 1 && (
          <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-charcoal/10 bg-cream/30">
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-charcoal/50">
                    Liveability Dimension
                  </th>
                  {compared.map((c) => (
                    <th key={c._id} className="p-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-bold text-charcoal">{c.name}</span>
                        <span className="rounded-md bg-rust/10 px-2 py-0.5 text-[10px] font-bold text-rust uppercase tracking-wider">
                          {c.city}
                        </span>
                      </div>
                      <div className="text-xs text-charcoal/50 mt-1">
                        Overall Score: <span className="font-bold text-charcoal">{c.overall}/100</span>
                      </div>
                      {typeof c.avgRentEstimate === 'number' && c.avgRentEstimate > 0 && (
                        <div className="text-xs font-semibold text-rust mt-0.5">
                          ~ ETB {c.avgRentEstimate.toLocaleString()}/mo
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map((dim) => {
                  const best = bestOf(dim.key)
                  return (
                    <tr key={dim.key} className="border-b border-charcoal/5 last:border-0 hover:bg-cream/10">
                      <td className="p-4">
                        <div className="text-xs font-semibold text-charcoal" title={dim.hint}>
                          {dim.label}
                        </div>
                        <div className="text-[11px] text-charcoal/40">{dim.hint}</div>
                      </td>
                      {compared.map((c) => {
                        const v = c.scores[dim.key]
                        const isBest = best !== null && v === best
                        return (
                          <td key={c._id} className="p-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-charcoal/10">
                                <div className={`h-full rounded-full ${scoreColor(v)}`} style={{ width: `${v}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${isBest ? 'text-emerald-700' : 'text-charcoal/80'}`}>
                                {v}
                                {isBest && <span className="ml-1 text-[10px] text-emerald-600 font-semibold">✓ top</span>}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                <tr className="border-t border-charcoal/10 bg-cream/20">
                  <td className="p-4 text-xs font-bold uppercase tracking-wider text-charcoal/60">Key Highlights</td>
                  {compared.map((c) => (
                    <td key={c._id} className="p-4">
                      <ul className="list-inside list-disc space-y-1 text-xs text-charcoal/70">
                        {(c.highlights || []).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Displayed neighborhoods — summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayedNeighborhoods.map((n) => (
            <div
              key={n._id}
              className={`rounded-xl border p-5 transition-all shadow-sm ${
                selected.includes(n.name) ? 'border-rust bg-rust/5 ring-1 ring-rust/20' : 'border-charcoal/10 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-charcoal">{n.name}</h3>
                  <span className="inline-block rounded bg-charcoal/5 px-2 py-0.5 text-[10px] font-semibold text-charcoal/60 mt-0.5">
                    {n.city}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-charcoal">{n.overall}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-charcoal/40">score</div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 pt-1">
                {DIMENSIONS.slice(0, 4).map((d) => (
                  <div key={d.key} className="flex items-center justify-between text-xs">
                    <span className="text-charcoal/60">{d.label}</span>
                    <span className="font-bold text-charcoal/80">{n.scores[d.key]}/100</span>
                  </div>
                ))}
              </div>

              {n.avgRentEstimate && (
                <p className="mt-3 text-xs font-semibold text-rust">
                  Avg. Rent: ETB {n.avgRentEstimate.toLocaleString()}/mo
                </p>
              )}

              {n.summary && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-charcoal/60">
                  {n.summary}
                </p>
              )}

              <button
                type="button"
                onClick={() => toggle(n.name)}
                className={`mt-4 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected.includes(n.name)
                    ? 'border border-charcoal/20 bg-charcoal/5 text-charcoal hover:bg-charcoal/10'
                    : 'border border-rust text-rust hover:bg-rust hover:text-white'
                }`}
              >
                {selected.includes(n.name) ? '✓ In Comparison' : '+ Compare Area'}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-4 text-xs text-charcoal/50">
          Neighborhood scores are calculated using platform reviews, municipal infrastructure data, and community reports across Ethiopian cities. Always schedule an in-person viewing before committing to a lease.{' '}
          <Link href="/explore" className="font-semibold text-rust underline hover:text-rust-dark">
            Explore active listings in these areas →
          </Link>
        </div>
      </main>
    </>
  )
}
