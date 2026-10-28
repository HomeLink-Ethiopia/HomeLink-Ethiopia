'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export type TenancyStage = 'move_in' | 'living' | 'move_out'

interface ReviewRatings {
  overall?: number
  tenancyStage?: TenancyStage
  // Move-in criteria
  propertyAccuracy?: number
  leaseFairness?: number
  moveInHandover?: number
  // Living criteria
  maintenance?: number
  communication?: number
  reliability?: number
  // Move-out criteria
  depositFairness?: number
  wouldRecommend?: 'yes' | 'no' | string
}

interface Review {
  _id: string
  propertyId?: { title?: string; _id?: string } | string
  agreementId?: string
  revieweeName?: string
  reviewType?: string
  rating: number
  ratings?: ReviewRatings
  comment?: string
  landlordReply?: string
  status?: string
  createdAt: string
}

interface AgreementRow {
  _id: string
  status?: string
  startDate?: string
  endDate?: string
  propertyId?: { _id?: string; title?: string } | string
  landlordId?: { _id?: string; firstName?: string; lastName?: string } | string
}

export default function TenantReviewsPage() {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState('')

  // Tenancy lifecycle stage
  const [stage, setStage] = useState<TenancyStage>('move_in')

  // Rating scores (1-5)
  const [overallRating, setOverallRating] = useState(5)
  const [crit1, setCrit1] = useState(5)
  const [crit2, setCrit2] = useState(5)
  const [crit3, setCrit3] = useState(5)
  const [crit4, setCrit4] = useState(5)
  const [wouldRecommend, setWouldRecommend] = useState<'yes' | 'no'>('yes')
  const [comment, setComment] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      const agrRes = await fetch(`${API_URL}/api/v1/agreements/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (agrRes.ok) {
        const agrData = await agrRes.json()
        const agrs: AgreementRow[] = agrData.data || []
        setAgreements(agrs)

        // URL query parameter check (?agreementId=...)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const targetId = urlParams.get('agreementId')
          if (targetId && agrs.some((a) => a._id === targetId)) {
            setSelectedAgreement(targetId)
            setShowForm(true)
          } else if (agrs.length > 0 && !selectedAgreement) {
            setSelectedAgreement(agrs[0]._id)
          }
        } else if (agrs.length > 0 && !selectedAgreement) {
          setSelectedAgreement(agrs[0]._id)
        }

        const mineRes = await fetch(`${API_URL}/api/v1/reviews/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (mineRes.ok) {
          const mineData = await mineRes.json()
          const mine = mineData.data || []
          setReviews(mine)
        }
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [selectedAgreement])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const selected = agreements.find((a) => a._id === selectedAgreement)
  const existingReview = reviews.find((r) => String(r.agreementId) === String(selectedAgreement))

  // Determine intelligent default stage and pre-fill form when agreement changes
  useEffect(() => {
    if (!selected) return

    if (existingReview) {
      const rts = existingReview.ratings || {}
      setOverallRating(existingReview.rating || rts.overall || 5)
      setComment(existingReview.comment || '')
      setWouldRecommend((rts.wouldRecommend as 'yes' | 'no') || 'yes')

      const savedStage = (rts.tenancyStage as TenancyStage) || 'move_in'
      setStage(savedStage)
      if (savedStage === 'move_in') {
        setCrit1(rts.propertyAccuracy || 5)
        setCrit2(rts.leaseFairness || 5)
        setCrit3(rts.moveInHandover || 5)
        setCrit4(rts.communication || 5)
      } else if (savedStage === 'living') {
        setCrit1(rts.maintenance || 5)
        setCrit2(rts.leaseFairness || 5)
        setCrit3(rts.propertyAccuracy || 5)
        setCrit4(rts.communication || 5)
      } else {
        setCrit1(rts.depositFairness || 5)
        setCrit2(rts.leaseFairness || 5)
        setCrit3(rts.propertyAccuracy || 5)
        setCrit4(rts.communication || 5)
      }
      return
    }

    // Default stage based on lease start/status
    const startMs = selected.startDate ? new Date(selected.startDate).getTime() : 0
    const daysLived = startMs > 0 && Date.now() > startMs ? Math.floor((Date.now() - startMs) / 86400000) : 0

    if (selected.status === 'completed' || selected.status === 'terminated') {
      setStage('move_out')
    } else if (daysLived >= 30) {
      setStage('living')
    } else {
      setStage('move_in')
    }
  }, [selectedAgreement, existingReview, selected])

  const submitReview = async () => {
    if (!selectedAgreement || !selected) {
      setMessage({ type: 'error', text: 'Please select a lease agreement to review.' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    // Map ratings according to stage
    const ratingsPayload: ReviewRatings = {
      overall: overallRating,
      tenancyStage: stage,
      wouldRecommend,
      communication: crit4,
    }

    if (stage === 'move_in') {
      ratingsPayload.propertyAccuracy = crit1
      ratingsPayload.leaseFairness = crit2
      ratingsPayload.moveInHandover = crit3
      ratingsPayload.maintenance = overallRating // sensible default
      ratingsPayload.depositFairness = overallRating
    } else if (stage === 'living') {
      ratingsPayload.maintenance = crit1
      ratingsPayload.leaseFairness = crit2
      ratingsPayload.propertyAccuracy = crit3
      ratingsPayload.moveInHandover = crit3
      ratingsPayload.depositFairness = overallRating
    } else {
      ratingsPayload.depositFairness = crit1
      ratingsPayload.leaseFairness = crit2
      ratingsPayload.propertyAccuracy = crit3
      ratingsPayload.maintenance = crit3
      ratingsPayload.moveInHandover = crit3
    }

    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          agreementId: selected._id,
          reviewType: 'tenant_to_property',
          propertyId: typeof selected.propertyId === 'object' ? selected.propertyId?._id : selected.propertyId,
          revieweeId: typeof selected.landlordId === 'object' ? selected.landlordId?._id : selected.landlordId,
          rating: overallRating,
          ratings: ratingsPayload,
          comment,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage({
          type: 'success',
          text: existingReview
            ? 'Your evaluation has been updated successfully!'
            : 'Your review was submitted successfully! It helps build authentic housing transparency in Ethiopia.',
        })
        setShowForm(false)
        await fetchReviews()
      } else {
        setMessage({ type: 'error', text: data.message || `Failed to submit review (${res.status})` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server. Is the backend running?' })
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (count: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-base ${s <= count ? 'text-amber-500' : 'text-charcoal/20'}`}>
          {s <= count ? '★' : '☆'}
        </span>
      ))}
    </div>
  )

  const renderRatingSelector = (
    label: string,
    icon: string,
    desc: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div className="rounded-xl border border-charcoal/10 bg-cream/30 p-3.5 transition-colors hover:border-rust/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-md">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
            <span>{icon}</span> {label}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/60 leading-relaxed">{desc}</p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`text-xl transition-transform hover:scale-110 ${
                s <= value ? 'text-amber-500' : 'text-charcoal/20 hover:text-amber-300'
              }`}
              aria-label={`${s} stars`}
            >
              ★
            </button>
          ))}
          <span className="ml-1 text-xs font-bold text-charcoal/70">{value}/5</span>
        </div>
      </div>
    </div>
  )

  const propTitle = (r: Review) => {
    if (typeof r.propertyId === 'object' && r.propertyId) return r.propertyId.title || 'Property'
    if (typeof r.propertyId === 'string') {
      const a = agreements.find(
        (x) => (typeof x.propertyId === 'object' && x.propertyId ? x.propertyId._id : x.propertyId) === r.propertyId
      )
      return (typeof a?.propertyId === 'object' && a.propertyId ? a.propertyId.title : '') || 'Property'
    }
    return 'Property'
  }

  const landlordNameOf = (a?: AgreementRow) => {
    if (!a) return 'Landlord'
    if (typeof a.landlordId === 'object' && a.landlordId) {
      return `${a.landlordId.firstName || ''} ${a.landlordId.lastName || ''}`.trim() || 'Landlord'
    }
    return 'Landlord'
  }

  const stageBadge = (stg?: TenancyStage) => {
    if (stg === 'move_in') {
      return <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">🔑 Move-In &amp; Handover</span>
    }
    if (stg === 'living') {
      return <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">🏡 Living Experience</span>
    }
    if (stg === 'move_out') {
      return <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">📦 Move-Out Settlement</span>
    }
    return <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-medium text-charcoal/60">Verified Tenancy</span>
  }

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal">My Reviews &amp; Ratings</h1>
            <p className="mt-1 text-sm text-charcoal/60">
              Evaluate your landlord and home based on your real experience — from key handover to living conditions and deposit return.
            </p>
          </div>
          {agreements.length > 0 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rust-dark transition-colors"
            >
              {showForm ? 'Close Form' : existingReview ? '✏️ Edit / Update My Review' : '★ Rate Landlord & Home'}
            </button>
          )}
        </div>

        {message && (
          <div
            className={`rounded-xl border p-4 ${
              message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {showForm && (
          <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-sm">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-charcoal">
                  {existingReview ? 'Update Landlord & Home Evaluation' : 'Rate Landlord & Home'}
                </h2>
                {existingReview && (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                    ✓ Previously Submitted ({existingReview.rating}★)
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-charcoal/60">
                Choose what stage of your tenancy you are evaluating. Real-life feedback gives future renters genuine insights and holds landlords accountable.
              </p>
            </div>

            {/* Step 1: Select Verified Lease */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                1. Select Verified Lease Agreement
              </label>
              <select
                value={selectedAgreement}
                onChange={(e) => setSelectedAgreement(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm focus:border-rust focus:outline-none"
              >
                {agreements.length === 0 && <option value="">No rental agreements found</option>}
                {agreements.map((a) => {
                  const prop = typeof a.propertyId === 'object' && a.propertyId ? a.propertyId.title : 'Property Lease'
                  const host = landlordNameOf(a)
                  const isDone = reviews.some((r) => String(r.agreementId) === String(a._id))
                  return (
                    <option key={a._id} value={a._id}>
                      {prop} (Landlord: {host}) {isDone ? '✓ [Reviewed]' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Step 2: Realistic Tenancy Lifecycle Stage Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                2. What Experience Are You Evaluating?
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setStage('move_in')}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    stage === 'move_in'
                      ? 'border-rust bg-rust-tint/30 shadow-xs'
                      : 'border-charcoal/10 bg-cream/20 hover:border-charcoal/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🔑</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-900">
                      NEW LEASE
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-charcoal">Move-In &amp; Handover</p>
                  <p className="mt-0.5 text-[11px] text-charcoal/60 leading-tight">
                    Listing accuracy, contract transparency, and keys delivery.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStage('living')}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    stage === 'living'
                      ? 'border-rust bg-rust-tint/30 shadow-xs'
                      : 'border-charcoal/10 bg-cream/20 hover:border-charcoal/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🏡</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-900">
                      DURING STAY
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-charcoal">Active Living &amp; Maintenance</p>
                  <p className="mt-0.5 text-[11px] text-charcoal/60 leading-tight">
                    Repair speed, water/generator reliability, and respect for privacy.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStage('move_out')}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    stage === 'move_out'
                      ? 'border-rust bg-rust-tint/30 shadow-xs'
                      : 'border-charcoal/10 bg-cream/20 hover:border-charcoal/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">📦</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                      MOVE-OUT
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-charcoal">Move-Out &amp; Deposit Return</p>
                  <p className="mt-0.5 text-[11px] text-charcoal/60 leading-tight">
                    Deposit refund punctuality, exit walk-through, and final settlement.
                  </p>
                </button>
              </div>

              {/* Informative Guidance Banner */}
              {stage === 'move_in' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                  <span className="text-base shrink-0">💡</span>
                  <div>
                    <span className="font-semibold">Move-In &amp; Handover Stage (Logical for New Leases):</span>
                    <p className="mt-0.5 text-[11px] text-blue-800/80">
                      If you just made an agreement, you don&apos;t know the landlord&apos;s long-term maintenance yet! Rate what you have actually experienced: listing accuracy vs reality, agreement fairness, and key handover. You can come back and add your Living Experience anytime.
                    </p>
                  </div>
                </div>
              )}
              {stage === 'living' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                  <span className="text-base shrink-0">🏡</span>
                  <div>
                    <span className="font-semibold">Active Living Experience:</span>
                    <p className="mt-0.5 text-[11px] text-emerald-800/80">
                      Evaluates how the landlord handles plumbing, water tank, generator maintenance, and respect for your quiet privacy.
                    </p>
                  </div>
                </div>
              )}
              {stage === 'move_out' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <span className="text-base shrink-0">📦</span>
                  <div>
                    <span className="font-semibold">Move-Out &amp; Deposit Settlement:</span>
                    <p className="mt-0.5 text-[11px] text-amber-800/80">
                      Evaluates whether your security deposit was refunded fairly and promptly, and how the final check-out inspection went.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Stage-Specific Evaluation Criteria */}
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                3. Rate Relevant Criteria for {landlordNameOf(selected)}
              </label>

              {stage === 'move_in' && (
                <>
                  {renderRatingSelector(
                    'Listing Accuracy vs Real Home',
                    '🏡',
                    'Did the photos, rooms, promised water reservoir, generator, and furnishings match reality at move-in?',
                    crit1,
                    setCrit1
                  )}
                  {renderRatingSelector(
                    'Agreement Fairness & Transparency',
                    '📜',
                    'Clear contract terms with no surprise upfront fees, sudden rent escalation clauses, or hidden charges.',
                    crit2,
                    setCrit2
                  )}
                  {renderRatingSelector(
                    'Keys Handover & Move-In Readiness',
                    '🔑',
                    'Keys handed over on schedule, apartment delivered clean, and water/electricity meters clearly verified.',
                    crit3,
                    setCrit3
                  )}
                  {renderRatingSelector(
                    'Initial Communication & Welcome',
                    '💬',
                    'Easy to contact, punctual for viewing & signing, and welcoming during the initial onboarding.',
                    crit4,
                    setCrit4
                  )}
                </>
              )}

              {stage === 'living' && (
                <>
                  {renderRatingSelector(
                    'Maintenance & Repair Response Speed',
                    '🔧',
                    'Promptness in addressing water pump, plumbing leaks, backup generator, electrical, or structural repairs.',
                    crit1,
                    setCrit1
                  )}
                  {renderRatingSelector(
                    'Respect for Tenant Privacy',
                    '⚖️',
                    'Gives proper advance notice before visiting the property; respects your quiet enjoyment and privacy.',
                    crit2,
                    setCrit2
                  )}
                  {renderRatingSelector(
                    'Utility & Fair Cost Sharing',
                    '💡',
                    'Fair and transparent sub-metering or cost breakdown for electricity, water tankers, and compound security.',
                    crit3,
                    setCrit3
                  )}
                  {renderRatingSelector(
                    'Ongoing Communication & Cooperation',
                    '💬',
                    'Responsive to phone calls or messages; cooperative and constructive in resolving home issues.',
                    crit4,
                    setCrit4
                  )}
                </>
              )}

              {stage === 'move_out' && (
                <>
                  {renderRatingSelector(
                    'Security Deposit Return Fairness',
                    '💰',
                    'Refunded the security deposit promptly and without unjustified deductions or bogus damage claims.',
                    crit1,
                    setCrit1
                  )}
                  {renderRatingSelector(
                    'Checkout Inspection & Amicable Handover',
                    '📋',
                    'Fair walk-through inspection that recognized normal wear-and-tear and concluded the stay professionally.',
                    crit2,
                    setCrit2
                  )}
                  {renderRatingSelector(
                    'Contractual Departure Compliance',
                    '⚖️',
                    'Respected the agreed notice period and termination terms without disputes or hostility.',
                    crit3,
                    setCrit3
                  )}
                  {renderRatingSelector(
                    'Overall Landlord Conduct',
                    '💬',
                    'Professional and fair throughout the concluding transition.',
                    crit4,
                    setCrit4
                  )}
                </>
              )}
            </div>

            {/* Step 4: Overall Rating & Recommendation */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="rounded-xl border border-charcoal/10 bg-cream/20 p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                  Overall Landlord &amp; Property Rating
                </label>
                <div className="mt-2 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOverallRating(s)}
                      className={`text-2xl transition-transform hover:scale-110 ${
                        s <= overallRating ? 'text-amber-500' : 'text-charcoal/20 hover:text-amber-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 font-bold text-charcoal text-sm">{overallRating}.0 / 5.0</span>
                </div>
              </div>

              <div className="rounded-xl border border-charcoal/10 bg-cream/20 p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                  Would You Recommend to Future Renters?
                </label>
                <div className="mt-2 flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                    <input
                      type="radio"
                      name="wouldRecommend"
                      checked={wouldRecommend === 'yes'}
                      onChange={() => setWouldRecommend('yes')}
                      className="text-rust focus:ring-rust"
                    />
                    <span className="font-semibold text-emerald-700">✓ Yes, recommend</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                    <input
                      type="radio"
                      name="wouldRecommend"
                      checked={wouldRecommend === 'no'}
                      onChange={() => setWouldRecommend('no')}
                      className="text-rust focus:ring-rust"
                    />
                    <span className="font-semibold text-red-700">✗ No, would not</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 5: Honest Advice for Future Tenants */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                Review Comments &amp; Practical Advice (Optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share helpful tips for future tenants (e.g., water supply days in the neighborhood, generator operation, landlord responsiveness, noise levels)..."
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 p-3 text-sm focus:border-rust focus:outline-none resize-none"
              />
            </div>

            {/* Submission Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={submitReview}
                disabled={!selectedAgreement || submitting}
                className="rounded-lg bg-rust px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rust-dark disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Saving Evaluation…'
                  : existingReview
                  ? 'Update My Review'
                  : 'Submit Evaluation & Review'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-charcoal/15 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Existing Reviews List */}
        {loading ? (
          <SkeletonList count={3} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            description="You have not submitted a review yet. Once you take a lease in a property, you can evaluate the move-in, living experience, or move-out."
          />
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-charcoal">Evaluations You Have Submitted</h2>
            {reviews.map((review) => {
              const rts = review.ratings
              const stg = rts?.tenancyStage as TenancyStage | undefined
              const isSelectedReview = String(review.agreementId) === String(selectedAgreement)

              return (
                <div
                  key={review._id}
                  className="space-y-3 rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display font-bold text-charcoal text-base">{propTitle(review)}</h3>
                        {stageBadge(stg)}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-xs font-bold text-charcoal/70">{review.rating}.0 / 5.0</span>
                        {rts?.wouldRecommend && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              rts.wouldRecommend === 'yes'
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {rts.wouldRecommend === 'yes' ? '✓ Recommends' : '✗ Does Not Recommend'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-charcoal/40">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                      {review.agreementId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAgreement(review.agreementId || '')
                            setShowForm(true)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className="rounded-lg border border-charcoal/15 bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:bg-sand transition-colors"
                        >
                          ✏️ Update
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-criteria Scorecard */}
                  {rts && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                      {stg === 'move_in' ? (
                        <>
                          {rts.propertyAccuracy !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Listing Accuracy</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.propertyAccuracy}/5 Match</p>
                            </div>
                          )}
                          {rts.leaseFairness !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Lease Terms</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.leaseFairness}/5 Clear</p>
                            </div>
                          )}
                          {rts.moveInHandover !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Key Handover</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.moveInHandover}/5 On-time</p>
                            </div>
                          )}
                          {rts.communication !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Onboarding</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.communication}/5 Welcoming</p>
                            </div>
                          )}
                        </>
                      ) : stg === 'move_out' ? (
                        <>
                          {rts.depositFairness !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Deposit Refund</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.depositFairness}/5 Fair</p>
                            </div>
                          )}
                          {rts.leaseFairness !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Checkout Walkthrough</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.leaseFairness}/5 Amicable</p>
                            </div>
                          )}
                          {rts.propertyAccuracy !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Contract Compliance</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.propertyAccuracy}/5 Respected</p>
                            </div>
                          )}
                          {rts.communication !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Exit Professionalism</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.communication}/5 Conduct</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {rts.maintenance !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Maintenance Speed</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.maintenance}/5 Repairs</p>
                            </div>
                          )}
                          {rts.leaseFairness !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Privacy Respect</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.leaseFairness}/5 Notice</p>
                            </div>
                          )}
                          {rts.propertyAccuracy !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Utility Billing</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.propertyAccuracy}/5 Fair</p>
                            </div>
                          )}
                          {rts.communication !== undefined && (
                            <div className="rounded-lg border border-charcoal/5 bg-cream/40 p-2">
                              <p className="text-[10px] font-bold uppercase text-charcoal/50">Communication</p>
                              <p className="mt-0.5 text-xs font-semibold text-charcoal">★ {rts.communication}/5 Prompt</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {review.comment && (
                    <p className="rounded-lg border border-charcoal/5 bg-stone-50 p-3 text-sm text-charcoal/80">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}

                  {review.landlordReply && (
                    <div className="rounded-lg border border-amber-200/50 bg-amber-50/50 p-3.5">
                      <p className="text-xs font-bold text-amber-900">Landlord Response:</p>
                      <p className="mt-1 text-sm text-charcoal/80">{review.landlordReply}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
