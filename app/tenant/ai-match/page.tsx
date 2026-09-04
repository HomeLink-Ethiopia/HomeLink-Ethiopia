'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/tenant/TopBar'
import { useLanguage } from '@/lib/language-context'
import { fetchProperties, type Property } from '@/services/api'
import { matchAllProperties, matchProperty, getGradeColor, type TenantPreferences, type MatchResult } from '@/lib/ai-matching'

const NEIGHBORHOODS = [
  // Addis Ababa
  'Bole', 'Kazanchis', 'CMC', 'Saris', 'Yeka', 'Piassa', 'Merkato', 'Arat Kilo',
  // Other Cities
  'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle', 'Adama', 'Jimma', 'Gondar', 'Dessie', 'Harar', 'Axum'
]
const AMENITIES = ['Parking', 'WiFi', 'Generator', 'Security Guard', 'CCTV', 'Water Tank', 'Elevator', 'Furnished', 'Air Conditioning', 'Balcony', 'Garden', 'Gym']
const PROPERTY_TYPES = ['any', 'apartment', 'house', 'studio', 'villa', 'room']

export default function AIMatchPage() {
  const { t } = useLanguage()
  const [step, setStep] = useState<'preferences' | 'results'>('preferences')
  const [loading, setLoading] = useState(false)
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [results, setResults] = useState<(MatchResult & { property: Property })[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Preferences state
  const [preferences, setPreferences] = useState<TenantPreferences>({
    budget: { min: 5000, max: 25000 },
    location: [],
    propertyType: 'any',
    bedrooms: 2,
    amenities: [],
    moveInDate: new Date().toISOString().split('T')[0],
    furnished: false,
  })

  useEffect(() => {
    fetchProperties({}).then(props => setAllProperties(props)).catch(() => {})
  }, [])

  const handleFindMatches = () => {
    setLoading(true)
    setTimeout(() => {
      const matched = matchAllProperties(allProperties, preferences)
      const resultsWithProperties = matched
        .map(m => {
          const property = allProperties.find(p => (p.id || (p as any)._id) === m.propertyId)
          if (!property) return null
          return { ...m, property }
        })
        .filter(Boolean) as (MatchResult & { property: Property })[]
      setResults(resultsWithProperties)
      setStep('results')
      setLoading(false)
    }, 800) // Simulate AI processing
  }

  const toggleLocation = (loc: string) => {
    setPreferences(prev => ({
      ...prev,
      location: prev.location.includes(loc)
        ? prev.location.filter(l => l !== loc)
        : [...prev.location, loc]
    }))
  }

  const toggleAmenity = (amenity: string) => {
    setPreferences(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  // Preferences Form
  if (step === 'preferences') {
    return (
      <>
        <TopBar title="AI Property Match" subtitle="Tell us what you're looking for" />
        <main className="flex-1 px-6 py-8 sm:px-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-rust/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-rust" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-charcoal">Find Your Perfect Home</h1>
              <p className="text-charcoal/60 mt-2">Our AI will match you with properties that fit your needs. The more details you provide, the better the match.</p>
            </div>

            <div className="bg-white rounded-lg border border-sand p-6 space-y-8">
              {/* Budget */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-3">Monthly Budget (ETB)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-charcoal/60 mb-1 block">Minimum</label>
                    <input
                      type="number"
                      value={preferences.budget.min}
                      onChange={(e) => setPreferences(prev => ({ ...prev, budget: { ...prev.budget, min: Number(e.target.value) } }))}
                      className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-charcoal/60 mb-1 block">Maximum</label>
                    <input
                      type="number"
                      value={preferences.budget.max}
                      onChange={(e) => setPreferences(prev => ({ ...prev, budget: { ...prev.budget, max: Number(e.target.value) } }))}
                      className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                      min="0"
                    />
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  {[15000, 20000, 25000, 35000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setPreferences(prev => ({ ...prev, budget: { ...prev.budget, max: amount } }))}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        preferences.budget.max === amount ? 'bg-rust text-white border-rust' : 'border-sand hover:bg-sand'
                      }`}
                    >
                      {amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-3">Preferred Neighborhoods</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {NEIGHBORHOODS.map(loc => (
                    <button
                      key={loc}
                      onClick={() => toggleLocation(loc)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        preferences.location.includes(loc)
                          ? 'bg-rust text-white border-rust'
                          : 'border-sand hover:bg-sand text-charcoal'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                {preferences.location.length > 0 && (
                  <p className="text-xs text-charcoal/60 mt-2">Selected: {preferences.location.join(', ')}</p>
                )}
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-3">Property Type</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {PROPERTY_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setPreferences(prev => ({ ...prev, propertyType: type }))}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                        preferences.propertyType === type
                          ? 'bg-rust text-white border-rust'
                          : 'border-sand hover:bg-sand text-charcoal'
                      }`}
                    >
                      {type === 'any' ? 'Any' : type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-3">Minimum Bedrooms</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => setPreferences(prev => ({ ...prev, bedrooms: num }))}
                      className={`w-12 h-12 rounded-lg border text-sm font-bold transition-colors ${
                        preferences.bedrooms === num
                          ? 'bg-rust text-white border-rust'
                          : 'border-sand hover:bg-sand text-charcoal'
                      }`}
                    >
                      {num}+
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-3">Desired Amenities</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {AMENITIES.map(amenity => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors flex items-center gap-2 ${
                        preferences.amenities.includes(amenity)
                          ? 'bg-rust/5 border-rust text-rust'
                          : 'border-sand hover:bg-sand text-charcoal'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                        preferences.amenities.includes(amenity) ? 'bg-rust border-rust' : 'border-charcoal/30'
                      }`}>
                        {preferences.amenities.includes(amenity) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Move-in Date */}
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-3">Move-in Date</label>
                <input
                  type="date"
                  value={preferences.moveInDate}
                  onChange={(e) => setPreferences(prev => ({ ...prev, moveInDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                />
              </div>

              {/* Find Matches Button */}
              <button
                onClick={handleFindMatches}
                disabled={loading}
                className="w-full bg-rust text-white py-3 rounded-lg font-semibold hover:bg-rust-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AI is analyzing {allProperties.length} properties...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Find My Perfect Match
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // Results Page
  return (
    <>
      <TopBar title="AI Property Match" subtitle={`${results.length} properties matched your preferences`} />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => setStep('preferences')}
            className="flex items-center gap-2 text-sm text-charcoal/60 hover:text-rust mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to preferences
          </button>

          {/* Summary */}
          <div className="bg-white rounded-lg border border-sand p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-rust/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-rust" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-charcoal">AI Analysis Complete</h2>
                <p className="text-sm text-charcoal/60">
                  Matched {results.length} of {allProperties.length} properties • Budget: ETB {preferences.budget.min.toLocaleString()} – {preferences.budget.max.toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep('preferences')}
              className="text-sm text-rust hover:text-rust-dark font-medium"
            >
              Edit Preferences
            </button>
          </div>

          {/* Results */}
          {results.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-sand">
              <svg className="w-16 h-16 text-charcoal/20 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-charcoal">No matches found</h3>
              <p className="text-charcoal/60 mt-2">Try adjusting your preferences — expand your budget or try different neighborhoods.</p>
              <button onClick={() => setStep('preferences')} className="mt-4 text-rust hover:text-rust-dark font-medium">
                Adjust Preferences
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => {
                const gradeColor = getGradeColor(result.grade)
                const isExpanded = expandedId === result.propertyId
                const neighborhood = result.property.neighborhood || (result.property as any).location?.subCity || 'Unknown'

                return (
                  <div
                    key={result.propertyId}
                    className="bg-white rounded-lg border border-sand hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Rank + Score Header */}
                    <div className="flex items-center gap-4 p-4">
                      <div className="text-center flex-shrink-0">
                        <div className="text-xs font-bold text-charcoal/40 mb-1">#{index + 1}</div>
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: gradeColor }}
                        >
                          {result.score}
                        </div>
                        <div className="text-xs font-bold mt-1" style={{ color: gradeColor }}>
                          {result.grade}
                        </div>
                      </div>

                      {/* Property Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-charcoal truncate">{result.property.title}</h3>
                          {(result.property.verified || (result.property as any).verificationStatus === 'verified') && (
                            <span className="px-2 py-0.5 bg-verified text-white text-xs rounded-full flex-shrink-0">VERIFIED</span>
                          )}
                        </div>
                        <p className="text-sm text-charcoal/60">{neighborhood} • {result.property.beds} bed • {result.property.baths} bath</p>
                        <p className="text-lg font-bold text-charcoal mt-1">ETB {(result.property.priceEtb || (result.property as any).rentAmount || 0).toLocaleString()}<span className="text-sm font-normal text-charcoal/60">/mo</span></p>
                      </div>

                      {/* Expand Button */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : result.propertyId)}
                        className="flex items-center gap-1 text-sm text-rust hover:text-rust-dark font-medium flex-shrink-0"
                      >
                        Why this match?
                        <svg viewBox="0 0 12 12" fill="currentColor" className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <path d="M3 4.5l3 3 3-3" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded Reason Panel */}
                    {isExpanded && (
                      <div className="border-t border-sand bg-cream/30 p-4">
                        <h4 className="text-sm font-semibold text-charcoal mb-3">WHY THIS HOME MATCHES YOU</h4>

                        {/* Score Breakdown Bar */}
                        <div className="grid grid-cols-6 gap-2 mb-4">
                          {Object.entries(result.breakdown).map(([key, score]) => (
                            <div key={key} className="text-center">
                              <div className="h-20 bg-sand rounded relative overflow-hidden">
                                <div
                                  className="absolute bottom-0 left-0 right-0 rounded transition-all"
                                  style={{
                                    height: `${score}%`,
                                    backgroundColor: score >= 80 ? '#059669' : score >= 50 ? '#F59E0B' : '#EF4444'
                                  }}
                                />
                              </div>
                              <div className="text-xs font-medium text-charcoal/60 mt-1 capitalize">
                                {key === 'propertyType' ? 'Type' : key}
                              </div>
                              <div className="text-xs font-bold" style={{ color: score >= 80 ? '#059669' : score >= 50 ? '#F59E0B' : '#EF4444' }}>
                                {score}%
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Reason List */}
                        <div className="space-y-2">
                          {result.reasons.map((reason, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              {reason.icon === 'check' && (
                                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {reason.icon === 'partial' && (
                                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              {reason.icon === 'close' && (
                                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              <span className={reason.icon === 'close' ? 'text-red-600' : 'text-charcoal'}>
                                {reason.text}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4 pt-4 border-t border-sand">
                          <Link
                            href={`/explore/${result.propertyId}`}
                            className="bg-rust text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rust-dark transition-colors"
                          >
                            View Details
                          </Link>
                          <Link
                            href={`/tenant/applications?property=${result.propertyId}`}
                            className="border border-rust text-rust px-4 py-2 rounded-lg text-sm font-medium hover:bg-rust/5 transition-colors"
                          >
                            Apply Now
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
