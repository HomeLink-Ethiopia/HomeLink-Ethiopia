'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Review {
  _id: string
  propertyId?: { title?: string; _id?: string } | string
  authorId?: { firstName?: string; lastName?: string } | string
  rating: number
  comment?: string
  landlordReply?: string
  landlordRepliedAt?: string
  createdAt: string
}

interface AgreementRow {
  _id: string
  tenantId?: { firstName?: string; lastName?: string; _id?: string } | string
  propertyId?: { title?: string } | string
  status?: string
}

export default function LandlordReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)
  // Sprint 10 — rate your tenants (landlord→tenant ratings on shared agreements)
  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [ratedAgreements, setRatedAgreements] = useState<Set<string>>(new Set())
  const [tenantRating, setTenantRating] = useState<Record<string, number>>({})
  const [tenantComment, setTenantComment] = useState<Record<string, string>>({})
  const [submittingRating, setSubmittingRating] = useState<string | null>(null)
  const [ratingMsg, setRatingMsg] = useState('')

  useEffect(() => {
    fetchReviews()
    fetchAgreements()
  }, [])

  async function fetchAgreements() {
    try {
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const rows: AgreementRow[] = data.data || []
        setAgreements(rows.filter(a => ['active', 'pending_tenant', 'pending_landlord'].includes(a.status || '')))
        // Which agreements has this landlord already rated?
        const mine = await fetch(`${API_URL}/api/v1/reviews/mine`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (mine.ok) {
          const md = await mine.json()
          const rated = new Set<string>((md.data || []).filter((r: any) => r.agreementId).map((r: any) => String(r.agreementId)))
          setRatedAgreements(rated)
        }
      }
    } catch (e) {
      console.error('Fetch agreements error:', e)
    }
  }

  async function handleRateTenant(agreementId: string) {
    const rating = tenantRating[agreementId]
    if (!rating) { setRatingMsg('Pick a star rating first.'); return }
    setSubmittingRating(agreementId)
    setRatingMsg('')
    try {
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/reviews/rate-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ agreementId, rating, comment: tenantComment[agreementId] || '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRatedAgreements(prev => new Set(prev).add(agreementId))
        setRatingMsg('Tenant rating saved.')
      } else {
        setRatingMsg(data.message || `Could not save rating (${res.status}).`)
      }
    } catch {
      setRatingMsg('Could not reach the server.')
    } finally {
      setSubmittingRating(null)
    }
  }

  async function fetchReviews() {
    try {
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/reviews/my-properties`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setReviews(data.data || data.reviews || [])
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
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/reviews/${reviewId}/reply`, {
        method: 'POST',
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

  function renderStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-amber-500' : 'text-gray-300'}>&#9733;</span>
    ))
  }

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0'

  return (
    <div className="flex min-h-screen bg-[#F5F1EC]">
      <TopBar title="Reviews" />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-charcoal">Reviews</h1>
          <p className="text-sm text-charcoal/60 mt-1">See what tenants say about your properties</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-charcoal/10 bg-white p-4">
            <p className="text-sm text-charcoal/60">Total Reviews</p>
            <p className="text-2xl font-bold text-charcoal">{reviews.length}</p>
          </div>
          <div className="rounded-xl border border-charcoal/10 bg-white p-4">
            <p className="text-sm text-charcoal/60">Average Rating</p>
            <p className="text-2xl font-bold text-charcoal">{avgRating} <span className="text-sm font-normal text-charcoal/60">/ 5</span></p>
          </div>
          <div className="rounded-xl border border-charcoal/10 bg-white p-4">
            <p className="text-sm text-charcoal/60">Replied</p>
            <p className="text-2xl font-bold text-charcoal">{reviews.filter(r => r.landlordReply).length}</p>
          </div>
        </div>

        {/* Sprint 10 — Rate your tenants (after legitimate shared agreements) */}
        {agreements.length > 0 && (
          <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5">
            <h2 className="text-lg font-bold text-charcoal">Rate your tenants</h2>
            <p className="text-xs text-charcoal/50 mt-0.5">
              After signing an agreement you can rate the tenant once per agreement — the same anti-abuse rules apply.
            </p>
            {ratingMsg && <p className="mt-2 text-xs font-medium text-rust">{ratingMsg}</p>}
            <div className="mt-3 space-y-3">
              {agreements.map(a => {
                const tenant = typeof a.tenantId === 'object' && a.tenantId
                  ? `${a.tenantId.firstName || ''} ${a.tenantId.lastName || ''}`.trim() || 'Tenant'
                  : 'Tenant'
                const prop = typeof a.propertyId === 'object' && a.propertyId ? a.propertyId.title || '' : ''
                const rated = ratedAgreements.has(a._id)
                return (
                  <div key={a._id} className="rounded-lg border border-charcoal/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-charcoal">{tenant}</p>
                        {prop && <p className="text-xs text-charcoal/50">{prop}</p>}
                      </div>
                      {rated ? (
                        <span className="rounded-full bg-verified/10 px-3 py-1 text-xs font-semibold text-verified">Rated ✓</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setTenantRating(prev => ({ ...prev, [a._id]: n }))}
                              className={`text-xl leading-none transition-colors ${(tenantRating[a._id] || 0) >= n ? 'text-amber-500' : 'text-gray-300 hover:text-amber-300'}`}
                              aria-label={`${n} star${n > 1 ? 's' : ''}`}
                            >&#9733;</button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleRateTenant(a._id)}
                            disabled={submittingRating === a._id || !tenantRating[a._id]}
                            className="rounded-lg bg-rust px-3 py-1.5 text-xs font-medium text-white hover:bg-rust/90 disabled:opacity-50"
                          >
                            {submittingRating === a._id ? 'Saving...' : 'Submit'}
                          </button>
                        </div>
                      )}
                    </div>
                    {!rated && tenantRating[a._id] ? (
                      <input
                        type="text"
                        placeholder="Optional comment about this tenant"
                        className="mt-2 w-full rounded-lg border border-charcoal/15 p-2 text-sm focus:border-rust focus:outline-none"
                        value={tenantComment[a._id] || ''}
                        onChange={e => setTenantComment(prev => ({ ...prev, [a._id]: e.target.value }))}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        )}

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
            {reviews.map(review => {
              const authorName = typeof review.authorId === 'object' && review.authorId
                ? `${review.authorId.firstName || ''} ${review.authorId.lastName || ''}`.trim() || 'Tenant'
                : 'Tenant'
              const propertyName = typeof review.propertyId === 'object' && review.propertyId
                ? review.propertyId.title || 'Property'
                : 'Property'
              return (
                <div key={review._id} className="rounded-xl border border-charcoal/10 bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-charcoal">{authorName}</p>
                      <p className="text-xs text-charcoal/50">{propertyName}</p>
                      <div className="mt-1 flex items-center gap-1">{renderStars(review.rating)}</div>
                    </div>
                    <span className="text-xs text-charcoal/40">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-3 text-sm text-charcoal/80">{review.comment}</p>
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
    </div>
  )
}
