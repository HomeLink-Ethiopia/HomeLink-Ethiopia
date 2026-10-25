'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ReviewRatings {
  overall?: number
  maintenance?: number
  leaseFairness?: number
  propertyAccuracy?: number
  communication?: number
  wouldRecommend?: string
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
  propertyId?: { _id?: string; title?: string } | string
  landlordId?: { _id?: string; firstName?: string; lastName?: string } | string
}

export default function TenantReviewsPage() {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [ratedAgreements, setRatedAgreements] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState('')

  // Criteria ratings
  const [overallRating, setOverallRating] = useState(5)
  const [maintenanceRating, setMaintenanceRating] = useState(5)
  const [leaseFairnessRating, setLeaseFairnessRating] = useState(5)
  const [propertyAccuracyRating, setPropertyAccuracyRating] = useState(5)
  const [communicationRating, setCommunicationRating] = useState(5)
  const [wouldRecommend, setWouldRecommend] = useState<'yes' | 'no'>('yes')
  const [comment, setComment] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      // Signed agreements = legitimate interactions I can review once each.
      const agrRes = await fetch(`${API_URL}/api/v1/agreements/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (agrRes.ok) {
        const agrData = await agrRes.json()
        const agrs: AgreementRow[] = agrData.data || []
        setAgreements(agrs)

        // Preselect agreement if passed in URL query
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const targetId = urlParams.get('agreementId')
          if (targetId && agrs.some(a => a._id === targetId)) {
            setSelectedAgreement(targetId)
            setShowForm(true)
          }
        }

        const mineRes = await fetch(`${API_URL}/api/v1/reviews/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (mineRes.ok) {
          const mineData = await mineRes.json()
          const mine = mineData.data || []
          setReviews(mine)
          setRatedAgreements(new Set(mine.filter((r: Review) => r.agreementId).map((r: Review) => String(r.agreementId))))
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const selected = agreements.find(a => a._id === selectedAgreement)
  const alreadyRated = selectedAgreement ? ratedAgreements.has(selectedAgreement) : false

  const submitReview = async () => {
    if (!selectedAgreement || !overallRating) return
    if (!selected) { setMessage({ type: 'error', text: 'Pick the stay you are reviewing.' }); return }
    setSubmitting(true)
    setMessage(null)
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
          ratings: {
            overall: overallRating,
            maintenance: maintenanceRating,
            leaseFairness: leaseFairnessRating,
            propertyAccuracy: propertyAccuracyRating,
            communication: communicationRating,
            wouldRecommend,
          },
          comment,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage({ type: 'success', text: 'Your evaluation and review were submitted successfully — thank you!' })
        setShowForm(false)
        setSelectedAgreement('')
        setComment('')
        fetchReviews()
      } else {
        setMessage({ type: 'error', text: data.message || `Failed to submit review (${res.status})` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server.' })
    }
    setSubmitting(false)
  }

  const renderStars = (count: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={`text-base ${s <= count ? 'text-amber-500' : 'text-charcoal/20'}`}>
          {s <= count ? '★' : '☆'}
        </span>
      ))}
    </div>
  )

  const renderRatingSelector = (label: string, icon: string, desc: string, value: number, onChange: (n: number) => void) => (
    <div className="rounded-xl border border-charcoal/10 bg-cream/30 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
            <span>{icon}</span> {label}
          </p>
          <p className="text-[11px] text-charcoal/50 mt-0.5">{desc}</p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`text-xl transition-transform hover:scale-110 ${s <= value ? 'text-amber-500' : 'text-charcoal/20 hover:text-amber-300'}`}
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
      const a = agreements.find(x => (typeof x.propertyId === 'object' && x.propertyId ? x.propertyId._id : x.propertyId) === r.propertyId)
      return (typeof a?.propertyId === 'object' && a.propertyId ? a.propertyId.title : '') || 'Property'
    }
    return 'Property'
  }

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-charcoal">My Reviews &amp; Ratings</h1>
            <p className="text-sm text-charcoal/60 mt-1">
              Rate the landlords and properties you have leased. Authentic feedback fosters transparency and fair housing in Ethiopia.
            </p>
          </div>
          {agreements.length > 0 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark shadow-sm"
            >
              {showForm ? 'Close Form' : '★ Rate Landlord & Home'}
            </button>
          )}
        </div>

        {message && (
          <div className={`rounded-xl border p-4 ${message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{message.text}</p>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-charcoal/10 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-charcoal">Rate Landlord &amp; Tenancy Experience</h3>
              <p className="text-xs text-charcoal/50 mt-1">
                Evaluate your landlord across verified criteria. Only signed leases can be reviewed (one review per stay).
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">Select Verified Lease</label>
              <select
                value={selectedAgreement}
                onChange={(e) => setSelectedAgreement(e.target.value)}
                className="w-full mt-1.5 rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm focus:border-rust focus:outline-none"
              >
                <option value="">-- Choose your rental agreement --</option>
                {agreements.map(a => {
                  const prop = typeof a.propertyId === 'object' && a.propertyId ? a.propertyId.title : 'Property'
                  const isDone = ratedAgreements.has(a._id)
                  return (
                    <option key={a._id} value={a._id} disabled={isDone}>
                      {prop} {isDone ? '✓ (Already reviewed)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {alreadyRated && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                You have already submitted your evaluation for this lease. Duplicate ratings are blocked to maintain system trust.
              </div>
            )}

            {!alreadyRated && selectedAgreement && (
              <>
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-charcoal/60">Rating Criteria for Landlord &amp; Property</p>

                  {/* 1. Maintenance & Repair Speed */}
                  {renderRatingSelector(
                    'Maintenance & Repair Speed',
                    '🔧',
                    'Promptness in solving plumbing, water reservoir, backup generator, electrical or structural repairs.',
                    maintenanceRating,
                    setMaintenanceRating
                  )}

                  {/* 2. Lease Fairness & Respect of Privacy */}
                  {renderRatingSelector(
                    'Lease Fairness & Privacy Respect',
                    '⚖️',
                    'Respects tenant privacy, provides advance notice before visits, and deals fairly with utility bills & deposit terms.',
                    leaseFairnessRating,
                    setLeaseFairnessRating
                  )}

                  {/* 3. Property Condition vs Listing Accuracy */}
                  {renderRatingSelector(
                    'Listing Accuracy & Condition',
                    '🏡',
                    'The home condition, water availability, and advertised amenities matched the real property at move-in.',
                    propertyAccuracyRating,
                    setPropertyAccuracyRating
                  )}

                  {/* 4. Communication & Professionalism */}
                  {renderRatingSelector(
                    'Communication & Professionalism',
                    '💬',
                    'Easy to contact by phone or message, respectful interaction, and provides rent payment confirmations.',
                    communicationRating,
                    setCommunicationRating
                  )}
                </div>

                {/* Overall Rating & Recommendation */}
                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div className="rounded-xl border border-charcoal/10 bg-cream/20 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">Overall Rating</label>
                    <div className="flex items-center gap-1.5 mt-2">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setOverallRating(s)}
                          className={`text-2xl transition-transform hover:scale-110 ${s <= overallRating ? 'text-amber-500' : 'text-charcoal/20 hover:text-amber-300'}`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="ml-2 font-bold text-charcoal text-sm">{overallRating}.0 / 5.0</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-charcoal/10 bg-cream/20 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">Would You Recommend to Future Tenants?</label>
                    <div className="mt-2 flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                        <input
                          type="radio"
                          name="wouldRecommend"
                          checked={wouldRecommend === 'yes'}
                          onChange={() => setWouldRecommend('yes')}
                          className="text-rust focus:ring-rust"
                        />
                        <span className="text-emerald-700 font-semibold">✓ Yes, recommend</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                        <input
                          type="radio"
                          name="wouldRecommend"
                          checked={wouldRecommend === 'no'}
                          onChange={() => setWouldRecommend('no')}
                          className="text-rust focus:ring-rust"
                        />
                        <span className="text-red-700 font-semibold">✗ No, would not</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-charcoal/70">Review Comments &amp; Advice (Optional)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share honest tips for next tenants (e.g., neighborhood safety, water schedule, landlord cooperation)..."
                    rows={3}
                    className="w-full mt-1.5 rounded-lg border border-charcoal/20 p-3 text-sm focus:border-rust focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={submitReview}
                    disabled={!selectedAgreement || submitting || alreadyRated}
                    className="px-6 py-2.5 rounded-lg bg-rust text-white text-sm font-semibold hover:bg-rust-dark disabled:opacity-50 shadow-sm"
                  >
                    {submitting ? 'Submitting Evaluation...' : 'Submit Evaluation & Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            description="After taking a lease in a property, you can evaluate your landlord and property condition here."
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const rts = review.ratings
              return (
                <div key={review._id} className="bg-white rounded-xl border border-charcoal/10 shadow-sm p-6 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-charcoal text-base">{propTitle(review)}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-xs font-bold text-charcoal/70">{review.rating}.0 / 5.0</span>
                        {rts?.wouldRecommend && (
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rts.wouldRecommend === 'yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {rts.wouldRecommend === 'yes' ? '✓ Recommends Landlord' : '✗ Does Not Recommend'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-charcoal/40">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Multi-criteria scorecard */}
                  {rts && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                      {rts.maintenance !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2">
                          <p className="text-[10px] uppercase font-bold text-charcoal/50">Maintenance</p>
                          <p className="text-xs font-semibold text-charcoal mt-0.5">★ {rts.maintenance}/5 Speed</p>
                        </div>
                      )}
                      {rts.leaseFairness !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2">
                          <p className="text-[10px] uppercase font-bold text-charcoal/50">Lease Fairness</p>
                          <p className="text-xs font-semibold text-charcoal mt-0.5">★ {rts.leaseFairness}/5 Privacy</p>
                        </div>
                      )}
                      {rts.propertyAccuracy !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2">
                          <p className="text-[10px] uppercase font-bold text-charcoal/50">Accuracy</p>
                          <p className="text-xs font-semibold text-charcoal mt-0.5">★ {rts.propertyAccuracy}/5 Match</p>
                        </div>
                      )}
                      {rts.communication !== undefined && (
                        <div className="rounded-lg bg-cream/40 border border-charcoal/5 p-2">
                          <p className="text-[10px] uppercase font-bold text-charcoal/50">Communication</p>
                          <p className="text-xs font-semibold text-charcoal mt-0.5">★ {rts.communication}/5 Prompt</p>
                        </div>
                      )}
                    </div>
                  )}

                  {review.comment && (
                    <p className="text-sm text-charcoal/80 bg-stone-50 rounded-lg p-3 border border-charcoal/5">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}

                  {review.landlordReply && (
                    <div className="rounded-lg bg-amber-50/50 border border-amber-200/50 p-3.5">
                      <p className="text-xs font-bold text-amber-900">Landlord Response:</p>
                      <p className="text-sm text-charcoal/80 mt-1">{review.landlordReply}</p>
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
