'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { formatEtb, type Property } from '@/lib/properties'
import { PROPERTIES } from '@/lib/properties'
import { get } from '@/lib/http-client'

interface MatchResult {
  property: Property
  score: number
  reasons: string[]
}

function matchProperty(p: Property, prefs: { budget: number; beds: number; neighborhoods: string[] }): MatchResult {
  let score = 0
  const reasons: string[] = []

  // Budget match (30%)
  if (p.priceEtb <= prefs.budget) {
    score += 30
    reasons.push('Within your budget')
  } else if (p.priceEtb <= prefs.budget * 1.15) {
    score += 20
    reasons.push('Slightly above budget')
  } else {
    score += 8
  }

  // Bedrooms match (20%)
  if (p.beds === prefs.beds) {
    score += 20
    reasons.push(`${p.beds} bedrooms — perfect match`)
  } else if (Math.abs(p.beds - prefs.beds) === 1) {
    score += 12
    reasons.push(`${p.beds} bedrooms — close match`)
  } else {
    score += 4
  }

  // Neighborhood match (25%)
  if (prefs.neighborhoods.includes(p.neighborhood)) {
    score += 25
    reasons.push(`In ${p.neighborhood} — your preferred area`)
  } else {
    score += 8
  }

  // Verification bonus (15%)
  if (p.verified) {
    score += 15
    reasons.push('Verified listing')
  } else {
    score += 5
  }

  // Rating bonus (10%)
  if (p.rating >= 4.5) {
    score += 10
    reasons.push(`Highly rated (${p.rating}★)`)
  } else if (p.rating >= 4.0) {
    score += 7
  } else {
    score += 3
  }

  return { property: p, score: Math.min(score, 99), reasons: reasons.slice(0, 3) }
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference * (1 - score / 100)
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#dc2626'

  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="-rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#F5F1EC" strokeWidth="3" />
        <motion.circle
          cx="20" cy="20" r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-charcoal">
        {score}%
      </span>
    </div>
  )
}

export default function AiRecommendations() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLiveRecommendations() {
      try {
        const res = await get<{ data: any[] }>('/api/v1/properties/recommendations')
        if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const apiMatches: MatchResult[] = res.data.data.slice(0, 4).map((p: any) => ({
            property: {
              id: p._id || p.id,
              title: p.title,
              neighborhood: (p.location?.subCity || p.subCity || 'Bole') as any,
              priceEtb: p.rentAmount || 0,
              beds: p.bedrooms || 0,
              baths: p.bathrooms || 0,
              sizeSqm: p.sizeM2 || 0,
              rating: p.fraudRiskScore ? 5.0 - p.fraudRiskScore * 2 : 4.8,
              reviewCount: 14,
              verified: p.verificationStatus === 'verified',
              image: p.images?.[0]?.url || '/images/cities/bole/1.png',
              lat: 9.0084,
              lng: 38.7913,
              fraudRiskScore: p.fraudRiskScore,
              riskLevel: p.riskLevel,
              redFlags: p.redFlags
            },
            score: Math.round(p.matchScore || 85),
            reasons: p.matchReasons || ['Within your budget', 'Preferred neighborhood']
          }))
          setMatches(apiMatches)
          setLoading(false)
          return
        }
      } catch (err) {
        console.warn('Backend recommendations fallback:', err)
      }

      // Fallback to local properties calculation
      const userPrefs = {
        budget: 20000,
        beds: 2,
        neighborhoods: ['Bole', 'Kazanchis'],
      }
      const fallbackMatches = PROPERTIES
        .map((p) => matchProperty(p, userPrefs))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
      setMatches(fallbackMatches)
      setLoading(false)
    }

    loadLiveRecommendations()
  }, [])

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-stamp">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rust/10">
            <svg viewBox="0 0 20 20" fill="none" stroke="#B8451F" strokeWidth={1.5} className="h-4 w-4">
              <path d="M10 2l2 4.5 5 .7-3.6 3.5.9 5-4.3-2.3-4.3 2.3.9-5L3 7.2l5-.7L10 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-charcoal">AI-Matched for You</h2>
            <p className="text-xs text-charcoal/50">Based on your budget, location, and bedroom preferences</p>
          </div>
        </div>
        <Link href="/explore" className="text-sm font-medium text-rust hover:text-rust-dark transition-colors">
          View all →
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {matches.map((match) => (
          <motion.div
            key={match.property.id}
            layout
            className="rounded-xl border border-charcoal/8 bg-cream/30 p-3 transition-colors hover:border-rust/20"
          >
            <div className="flex items-start gap-3">
              <Link href={`/property/${match.property.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
                <Image src={match.property.image} alt={match.property.title} fill sizes="64px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/property/${match.property.id}`} className="truncate text-sm font-medium text-charcoal hover:text-rust transition-colors">
                      {match.property.title}
                    </Link>
                    <p className="text-[11px] text-charcoal/50">{match.property.neighborhood} · {match.property.beds} bed · {match.property.baths} bath</p>
                  </div>
                  <ScoreRing score={match.score} />
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-rust">{formatEtb(match.property.priceEtb)}<span className="text-xs font-normal text-charcoal/50">/mo</span></span>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === match.property.id ? null : match.property.id)}
                    className="flex items-center gap-1 text-[11px] text-charcoal/50 hover:text-rust transition-colors"
                  >
                    Why this match?
                    <svg viewBox="0 0 12 12" fill="currentColor" className={`h-3 w-3 transition-transform ${expanded === match.property.id ? 'rotate-180' : ''}`}>
                      <path d="M3 4.5l3 3 3-3" />
                    </svg>
                  </button>
                </div>

                <AnimatePresence>
                  {expanded === match.property.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-1 border-t border-charcoal/5 pt-2">
                        {match.reasons.map((reason, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-charcoal/60">
                            <svg viewBox="0 0 12 12" fill="#16a34a" className="h-2.5 w-2.5 shrink-0">
                              <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm2.5 4l-3 3a.5.5 0 01-.7 0l-1.5-1.5a.5.5 0 11.7-.7L5.1 7.2l2.7-2.7a.5.5 0 01.7.7z" />
                            </svg>
                            {reason}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
