'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ReviewRatings {
  overall?: number
  paymentReliability?: number
  propertyCare?: number
  conductAndRules?: number
  communication?: number
  wouldRentAgain?: string
  maintenance?: number
  leaseFairness?: number
  propertyAccuracy?: number
  reliability?: number
  wouldRecommend?: string
}

interface Review {
  _id: string
  propertyId?: { title?: string; _id?: string } | string
  authorId?: { firstName?: string; lastName?: string } | string
  reviewerName?: string
  revieweeName?: string
  propertyTitle?: string
  reviewType?: string
  rating: number
  ratings?: ReviewRatings
  comment?: string
  landlordReply?: string
  landlordRepliedAt?: string
  createdAt: string
}

interface AgreementRow {
  _id: string
  tenantId?: { firstName?: string; lastName?: string; _id?: string; phone?: string } | string
  propertyId?: { title?: string } | string
  status?: string
}

interface TenantEvalState {
  overall: number
  payment: number
  care: number
  conduct: number
  communication: number
  wouldRentAgain: 'yes' | 'conditional' | 'no'
  comment: string
}

export default function LandlordReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [myTenantRatings, setMyTenantRatings] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)

  // Rate your tenants (multi-criteria behavioral evaluations)
  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [ratedAgreements, setRatedAgreements] = useState<Set<string>>(new Set())
  const [activeEvalId, setActiveEvalId] = useState<string | null>(null)
  const [evalForms, setEvalForms] = useState<Record<string, TenantEvalState>>({})
  const [submittingRating, setSubmittingRating] = useState<string | null>(null)
  const [ratingMsg, setRatingMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchReviews()
    fetchAgreements()
  }, [])

  const getToken = () => localStorage.getItem('homelink-token') || localStorage.getItem('hl_token') || ''

  async function fetchAgreements() {
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/agreements/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const rows: AgreementRow[] = data.data || []
        setAgreements(rows.filter(a => ['active', 'pending_tenant', 'pending_landlord', 'completed', 'terminated'].includes(a.status || '')))

        // Which agreements has this landlord already rated?
        const mine = await fetch(`${API_URL}/api/v1/reviews/mine`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (mine.ok) {
          const md = await mine.json()
          const rated = new Set<string>((md.data || []).filter((r: any) => r.agreementId && r.reviewType === 'landlord_to_tenant').map((r: any) => String(r.agreementId)))
          setRatedAgreements(rated)
        }
      }
    } catch (e) {
      console.error('Fetch agreements error:', e)
    }
  }

  function getForm(agreementId: string): TenantEvalState {
    return evalForms[agreementId] || {
      overall: 5,
      payment: 5,
      care: 5,
      conduct: 5,
      communication: 5,
      wouldRentAgain: 'yes',
      comment: '',
    }
  }

  function updateForm(agreementId: string, patch: Partial<TenantEvalState>) {
    setEvalForms(prev => ({
      ...prev,
      [agreementId]: { ...getForm(agreementId), ...patch }
    }))
  }

  async function handleRateTenant(agreementId: string) {
    const form = getForm(agreementId)
    setSubmittingRating(agreementId)
    setRatingMsg(null)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/reviews/rate-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agreementId,
          rating: form.overall,
          paymentScore: form.payment,
          careScore: form.care,
          conductScore: form.conduct,
          commScore: form.communication,
          wouldRentAgain: form.wouldRentAgain,
          comment: form.comment,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRatedAgreements(prev => new Set(prev).add(agreementId))
        setActiveEvalId(null)
        setRatingMsg({ text: 'Tenant evaluation saved successfully! Your review will guide future landlords.', type: 'success' })
        fetchReviews()
      } else {
        setRatingMsg({ text: data.message || `Could not save rating (${res.status}).`, type: 'error' })
      }
    } catch {
      setRatingMsg({ text: 'Could not reach the server.', type: 'error' })
    } finally {
      setSubmittingRating(null)
    }
  }

  async function fetchReviews() {
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/reviews/my-properties`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setReviews(data.data || data.reviews || [])
      }

      // Ratings I gave to tenants (landlord→tenant)
      const mineRes = await fetch(`${API_URL}/api/v1/reviews/mine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (mineRes.ok) {
        const mineData = await mineRes.json()
        setMyTenantRatings((mineData.data || []).filter((r: Review) => r.reviewType === 'landlord_to_tenant'))
      }
    } catch (e) {
      console.error('Fetch reviews error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleReply(reviewId: string) {
    const reply = replyDrafts[reviewId]?.trim()
    if (!reply) return
    setReplying(reviewId)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/reviews/${reviewId}/reply`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reply }),
      })
      if (res.ok) {
        setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, landlordReply: reply, landlordRepliedAt: new Date().toISOString() } : r))
        setReplyDrafts(prev => { const n = { ...prev }; delete n[reviewId]; return n })
      }
    } catch (e) {
      console.error('Reply error:', e)
    } finally {
      setReplying(null)
    }
  }

  function renderStars(count: number) {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`text-base ${i < count ? 'text-amber-500' : 'text-gray-300'}`}>&#9733;</span>
        ))}
      </div>
    )
  }

  const renderStarInput = (val: number, onChange: (n: number) => void) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-xl transition-transform hover:scale-110 ${val >= n ? 'text-amber-500' : 'text-gray-300 hover:text-amber-300'}`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          &#9733;
        </button>
      ))}
      <span className="ml-1 text-xs font-bold text-charcoal/70">{val}/5</span>
    </div>
  )

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0'

  return (
    <>
      <TopBar title="Reviews & Evaluations" subtitle="See what tenants say about your properties & rate your past tenants" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Total Reviews</p>
            <p className="mt-1 text-2xl font-bold text-charcoal">{reviews.length}</p>
          </div>
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Average Rating</p>
            <p className="mt-1 text-2xl font-bold text-charcoal">{avgRating} <span className="text-sm font-normal text-charcoal/60">/ 5.0</span></p>
          </div>
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Tenant Replies</p>
            <p className="mt-1 text-2xl font-bold text-charcoal">{reviews.filter(r => r.landlordReply).length}</p>
          </div>
        </div>

        {/* Rate your tenants (multi-criteria behavioral evaluations) */}
        {agreements.length > 0 && (
          <section className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-charcoal">Rate Your Tenants</h2>
              <p className="text-xs text-charcoal/50 mt-0.5">
                Authentic behavioral ratings by previous landlords ensure trustworthy tenancies. Rate your tenant across verified criteria: payment punctuality, property upkeep, noise &amp; house rules compliance.
              </p>
            </div>

            {ratingMsg && (
              <div className={`rounded-xl border p-3.5 text-xs font-medium ${ratingMsg.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                {ratingMsg.text}
              </div>
            )}

            <div className="space-y-4">
              {agreements.map(a => {
                const tenantName = typeof a.tenantId === 'object' && a.tenantId
                  ? `${a.tenantId.firstName || ''} ${a.tenantId.lastName || ''}`.trim() || 'Tenant'
                  : 'Tenant'
                const prop = typeof a.propertyId === 'object' && a.propertyId ? a.propertyId.title || '' : ''
                const rated = ratedAgreements.has(a._id)
                const isEvaluating = activeEvalId === a._id
                const form = getForm(a._id)

                return (
                  <div key={a._id} className="rounded-xl border border-charcoal/10 bg-cream/20 p-4 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-charcoal">{tenantName}</p>
                          <span className="rounded-full bg-sand/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-charcoal/70">
                            {a.status || 'Active Lease'}
                          </span>
                        </div>
                        {prop && <p className="text-xs text-charcoal/50 mt-0.5">{prop}</p>}
                      </div>

                      {rated ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                          ✓ Tenant Evaluated
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveEvalId(isEvaluating ? null : a._id)}
                          className="rounded-lg bg-rust px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rust-dark shadow-sm transition-colors"
                        >
                          {isEvaluating ? 'Cancel' : '★ Evaluate Tenant'}
                        </button>
                      )}
                    </div>

                    {/* Expandable Multi-Criteria Evaluation Card */}
                    {isEvaluating && !rated && (
                      <div className="mt-4 rounded-xl border border-charcoal/10 bg-white p-5 space-y-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal/60">
                          Landlord Evaluation Form for {tenantName}
                        </p>

                        <div className="space-y-3">
                          {/* 1. Payment Punctuality */}
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream/30 border border-charcoal/5 p-3">
                            <div>
                              <p className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
                                <span>💰</span> Payment Punctuality &amp; Discipline
                              </p>
                              <p className="text-[11px] text-charcoal/50">Rent, utility shares, and bank transfers paid on the agreed date.</p>
                            </div>
                            {renderStarInput(form.payment, (n) => updateForm(a._id, { payment: n }))}
                          </div>

                          {/* 2. Property Care */}
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream/30 border border-charcoal/5 p-3">
                            <div>
                              <p className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
                                <span>🧹</span> Property Care &amp; Cleanliness
                              </p>
                              <p className="text-[11px] text-charcoal/50">Kept home fixtures, walls, plumbing, and compound spaces clean and undamaged.</p>
                            </div>
                            {renderStarInput(form.care, (n) => updateForm(a._id, { care: n }))}
                          </div>

                          {/* 3. Quiet Hours & Conduct */}
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream/30 border border-charcoal/5 p-3">
                            <div>
                              <p className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
                                <span>🕊️</span> House Rules Compliance &amp; Peaceful Conduct
                              </p>
                              <p className="text-[11px] text-charcoal/50">Respected quiet hours, good neighbor relations, no smoke or substance disturbance.</p>
                            </div>
                            {renderStarInput(form.conduct, (n) => updateForm(a._id, { conduct: n }))}
                          </div>

                          {/* 4. Communication & Cooperation */}
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream/30 border border-charcoal/5 p-3">
                            <div>
                              <p className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
                                <span>💬</span> Communication &amp; Cooperation
                              </p>
                              <p className="text-[11px] text-charcoal/50">Easy to reach by phone/messaging, respectful dialogue, and responsive to notices.</p>
                            </div>
                            {renderStarInput(form.communication, (n) => updateForm(a._id, { communication: n }))}
                          </div>
                        </div>

                        {/* Overall Rating & Verdict */}
                        <div className="grid gap-3 sm:grid-cols-2 pt-2">
                          <div className="rounded-lg border border-charcoal/10 bg-cream/20 p-3">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">Overall Rating</label>
                            <div className="mt-1.5 flex items-center gap-2">
                              {renderStarInput(form.overall, (n) => updateForm(a._id, { overall: n }))}
                              <span className="font-bold text-xs text-charcoal">{form.overall}.0 / 5.0</span>
                            </div>
                          </div>

                          <div className="rounded-lg border border-charcoal/10 bg-cream/20 p-3">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">Would You Rent to This Tenant Again?</label>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`reRent-${a._id}`}
                                  checked={form.wouldRentAgain === 'yes'}
                                  onChange={() => updateForm(a._id, { wouldRentAgain: 'yes' })}
                                  className="text-rust focus:ring-rust"
                                />
                                <span className="font-semibold text-emerald-700">✓ Yes</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`reRent-${a._id}`}
                                  checked={form.wouldRentAgain === 'conditional'}
                                  onChange={() => updateForm(a._id, { wouldRentAgain: 'conditional' })}
                                  className="text-rust focus:ring-rust"
                                />
                                <span className="font-semibold text-amber-700">? Conditional</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`reRent-${a._id}`}
                                  checked={form.wouldRentAgain === 'no'}
                                  onChange={() => updateForm(a._id, { wouldRentAgain: 'no' })}
                                  className="text-rust focus:ring-rust"
                                />
                                <span className="font-semibold text-red-700">✗ No</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">
                            Landlord Reference Notes for Future Landlords
                          </label>
                          <textarea
                            placeholder="Share an authentic reference (e.g. prompt payer, treated the apartment with respect, followed compound rules)..."
                            rows={3}
                            className="mt-1.5 w-full rounded-lg border border-charcoal/20 p-2.5 text-sm focus:border-rust focus:outline-none resize-none"
                            value={form.comment}
                            onChange={e => updateForm(a._id, { comment: e.target.value })}
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRateTenant(a._id)}
                            disabled={submittingRating === a._id}
                            className="rounded-lg bg-rust px-5 py-2 text-xs font-semibold text-white hover:bg-rust-dark disabled:opacity-50 shadow-sm"
                          >
                            {submittingRating === a._id ? 'Saving Evaluation...' : 'Save Tenant Evaluation'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveEvalId(null)}
                            className="rounded-lg border border-charcoal/15 px-3.5 py-2 text-xs font-medium text-charcoal/70 hover:bg-charcoal/5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Ratings You Gave Tenants */}
        {myTenantRatings.length > 0 && (
          <section className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-charcoal">Tenant Behavioral Evaluations You Submitted</h2>
            <p className="text-xs text-charcoal/50">These verified evaluations appear on the tenant&apos;s verified profile when they apply for new housing.</p>
            <div className="mt-3 space-y-3">
              {myTenantRatings.map(r => {
                const rts = r.ratings
                return (
                  <div key={r._id} className="rounded-xl border border-charcoal/10 bg-cream/20 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-charcoal">{r.revieweeName || 'Tenant'}</span>
                        {renderStars(r.rating)}
                        <span className="text-xs font-bold text-charcoal/60">{r.rating}.0/5.0</span>
                      </div>
                      {rts?.wouldRentAgain && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          rts.wouldRentAgain === 'yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          rts.wouldRentAgain === 'conditional' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {rts.wouldRentAgain === 'yes' ? '✓ Would Rent Again' : rts.wouldRentAgain === 'conditional' ? '? Conditional Re-rent' : '✗ Would Not Re-rent'}
                        </span>
                      )}
                    </div>

                    {rts && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                        {rts.paymentReliability !== undefined && (
                          <div className="rounded-lg bg-white border border-charcoal/5 p-2 text-xs">
                            <span className="text-charcoal/50 text-[10px] uppercase font-bold block">Payment</span>
                            <span className="font-semibold text-charcoal">★ {rts.paymentReliability}/5</span>
                          </div>
                        )}
                        {rts.propertyCare !== undefined && (
                          <div className="rounded-lg bg-white border border-charcoal/5 p-2 text-xs">
                            <span className="text-charcoal/50 text-[10px] uppercase font-bold block">Property Care</span>
                            <span className="font-semibold text-charcoal">★ {rts.propertyCare}/5</span>
                          </div>
                        )}
                        {rts.conductAndRules !== undefined && (
                          <div className="rounded-lg bg-white border border-charcoal/5 p-2 text-xs">
                            <span className="text-charcoal/50 text-[10px] uppercase font-bold block">Conduct &amp; Rules</span>
                            <span className="font-semibold text-charcoal">★ {rts.conductAndRules}/5</span>
                          </div>
                        )}
                        {rts.communication !== undefined && (
                          <div className="rounded-lg bg-white border border-charcoal/5 p-2 text-xs">
                            <span className="text-charcoal/50 text-[10px] uppercase font-bold block">Communication</span>
                            <span className="font-semibold text-charcoal">★ {rts.communication}/5</span>
                          </div>
                        )}
                      </div>
                    )}

                    {r.comment && (
                      <p className="text-xs text-charcoal/70 italic bg-white rounded-lg p-2.5 border border-charcoal/5">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Reviews Landlord Received from Tenants */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-charcoal/5" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="When tenants review your properties, they will appear here." />
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-charcoal">Tenant Reviews for Your Properties</h2>
            {reviews.map(review => {
              const authorName = review.reviewerName
                || (typeof review.authorId === 'object' && review.authorId
                  ? `${review.authorId.firstName || ''} ${review.authorId.lastName || ''}`.trim() || 'Tenant'
                  : 'Tenant')
              const propertyName = review.propertyTitle
                || (typeof review.propertyId === 'object' && review.propertyId
                  ? review.propertyId.title || 'Property'
                  : 'Property')
              const rts = review.ratings

              return (
                <div key={review._id} className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-charcoal">{authorName}</p>
                      <p className="text-xs text-charcoal/50">{propertyName}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-xs font-bold text-charcoal/70">{review.rating}.0 / 5.0</span>
                        {rts?.wouldRecommend && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${rts.wouldRecommend === 'yes' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {rts.wouldRecommend === 'yes' ? '✓ Recommends' : '✗ Does not recommend'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-charcoal/40">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {rts && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                      {rts.maintenance !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2 text-xs">
                          <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Maintenance</span>
                          <span className="font-semibold text-charcoal">★ {rts.maintenance}/5</span>
                        </div>
                      )}
                      {rts.leaseFairness !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2 text-xs">
                          <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Lease Fairness</span>
                          <span className="font-semibold text-charcoal">★ {rts.leaseFairness}/5</span>
                        </div>
                      )}
                      {rts.propertyAccuracy !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2 text-xs">
                          <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Condition Match</span>
                          <span className="font-semibold text-charcoal">★ {rts.propertyAccuracy}/5</span>
                        </div>
                      )}
                      {rts.communication !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2 text-xs">
                          <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Communication</span>
                          <span className="font-semibold text-charcoal">★ {rts.communication}/5</span>
                        </div>
                      )}
                    </div>
                  )}

                  {review.comment && (
                    <p className="mt-2 text-sm text-charcoal/80 bg-stone-50 rounded-lg p-3 border border-charcoal/5">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}

                  {review.landlordReply ? (
                    <div className="mt-3 rounded-lg bg-stone-50 p-3 border border-charcoal/5">
                      <p className="text-xs font-semibold text-charcoal/70 mb-1">Your reply</p>
                      <p className="text-sm text-charcoal/80">{review.landlordReply}</p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        className="w-full rounded-lg border border-charcoal/15 p-2 text-sm focus:border-rust focus:outline-none"
                        placeholder="Reply to this review..."
                        rows={2}
                        value={replyDrafts[review._id] || ''}
                        onChange={e => setReplyDrafts(prev => ({ ...prev, [review._id]: e.target.value }))}
                      />
                      <button
                        onClick={() => handleReply(review._id)}
                        disabled={replying === review._id || !replyDrafts[review._id]?.trim()}
                        className="mt-1 rounded-lg bg-rust px-4 py-1.5 text-sm text-white hover:bg-rust/90 disabled:opacity-50"
                      >
                        {replying === review._id ? 'Sending...' : 'Reply'}
                      </button>
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
