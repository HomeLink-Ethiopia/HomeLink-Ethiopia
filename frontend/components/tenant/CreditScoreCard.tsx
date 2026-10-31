'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface CreditScoreData {
  score: number
  tier: string
  breakdown: {
    onTimePayments: { points: number; detail: string }
    leaseCompletion: { points: number; detail: string }
    landlordReviews: { points: number; detail: string }
  }
  stats: {
    paymentsTotal: number
    paymentsOnTime: number
    agreementsCompleted: number
    monthsOfTenure: number
    reviewsCount: number
    reviewsAvgRating: number
  }
  computedAt: string
}

const TIER_STYLES: Record<string, { label: string; color: string; ring: string; bg: string }> = {
  excellent: { label: 'Excellent', color: 'text-emerald-600', ring: '#059669', bg: 'bg-emerald-50' },
  good: { label: 'Good', color: 'text-green-600', ring: '#16a34a', bg: 'bg-green-50' },
  fair: { label: 'Fair', color: 'text-amber-600', ring: '#d97706', bg: 'bg-amber-50' },
  building: { label: 'Building', color: 'text-sky-600', ring: '#0284c7', bg: 'bg-sky-50' },
  risky: { label: 'At Risk', color: 'text-red-600', ring: '#dc2626', bg: 'bg-red-50' },
}

/**
 * Tenant Rent Credit Score card — shows the tenant's 0-1000 score with a
 * transparent breakdown (payments / leases / reviews). Computed server-side
 * from real platform data on every dashboard load.
 */
export default function CreditScoreCard() {
  const [data, setData] = useState<CreditScoreData | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('hl_token')
    if (!token) return
    fetch(`${API_URL}/api/v1/credit-score/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.data && setData(d.data))
      .catch(() => {})
  }, [])

  if (!data) return null

  const tier = TIER_STYLES[data.tier] || TIER_STYLES.building
  const pct = Math.min(data.score / 1000, 1)
  const circumference = 2 * Math.PI * 34
  const dash = circumference * pct

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Score ring */}
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={tier.ring}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-charcoal">{data.score}</span>
              <span className="text-[10px] text-charcoal/50">/ 1000</span>
            </div>
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-charcoal">Rent Credit Score</h3>
            <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.bg} ${tier.color}`}>
              {tier.label}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-charcoal/60 underline-offset-2 hover:underline"
        >
          {expanded ? 'Hide details' : 'How is this calculated?'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-charcoal/10 pt-4">
          <p className="text-xs text-charcoal/60">
            Your score is built from real activity on HomeLink — never from personal background data.
            Landlords see this score when reviewing your applications, so a strong history helps you
            stand out.
          </p>
          {[
            { label: `On-time payments (0-400)`, d: data.breakdown.onTimePayments },
            { label: `Lease completion (0-300)`, d: data.breakdown.leaseCompletion },
            { label: `Landlord reviews (0-300)`, d: data.breakdown.landlordReviews },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-charcoal">{row.label}</span>
                <span className="text-charcoal/70">{row.d.points} pts</span>
              </div>
              <p className="text-xs text-charcoal/50">{row.d.detail}</p>
            </div>
          ))}
          <p className="text-[11px] text-charcoal/40">
            Last updated {new Date(data.computedAt).toLocaleString()} • New tenants start at 620 while
            history builds up.
          </p>
        </div>
      )}
    </div>
  )
}
