'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Review {
  _id: string
  propertyId?: { title?: string; _id?: string } | string
  authorId?: { firstName?: string; lastName?: string } | string
  authorRole?: string
  rating: number
  comment?: string
  landlordReply?: string
  createdAt: string
}

interface Property {
  _id: string
  title: string
}

export default function TenantReviewsPage() {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || ''

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      // Fetch tenant's agreements to get properties they've rented
      const agrRes = await fetch(`${API_URL}/api/v1/applications/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (agrRes.ok) {
        const agrData = await agrRes.json()
        const apps = agrData.data || []
        const approved = apps.filter((a: { status?: string }) => a.status === 'approved')
        const props = approved.map((a: { propertyId?: { _id?: string; title?: string } | string }) => {
          if (typeof a.propertyId === 'object' && a.propertyId) {
            return { _id: a.propertyId._id || '', title: a.propertyId.title || 'Property' }
          }
          return null
        }).filter(Boolean) as Property[]
        setProperties(props)
      }

      // Fetch all reviews by this tenant
      const res = await fetch(`${API_URL}/api/v1/reviews/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReviews(data.data || data.reviews || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const submitReview = async () => {
    if (!selectedProperty || !rating) return
    setSubmitting(true)
    setMessage(null)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyId: selectedProperty, rating, comment }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Review submitted successfully!' })
        setShowForm(false)
        setSelectedProperty('')
        setRating(5)
        setComment('')
        fetchReviews()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.message || 'Failed to submit review' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server.' })
    }
    setSubmitting(false)
  }

  const renderStars = (count: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={`text-lg ${s <= count ? 'text-gold' : 'text-charcoal/20'}`}>
          {s <= count ? '\u2605' : '\u2606'}
        </span>
      ))}
    </div>
  )

  const propertyName = (r: Review) =>
    typeof r.propertyId === 'object' ? r.propertyId?.title : 'Property'

  return (
    <>
      <TopBar tenantName="Tenant" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-charcoal">My Reviews</h1>
            <p className="text-sm text-charcoal/60 mt-1">Rate properties you have stayed in</p>
          </div>
          {properties.length > 0 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark"
            >
              {showForm ? 'Cancel' : 'Write a Review'}
            </button>
          )}
        </div>

        {message && (
          <div className={`rounded-lg border p-4 ${message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{message.text}</p>
          </div>
        )}

        {/* Review form */}
        {showForm && (
          <div className="bg-white rounded-lg border border-sand p-6 space-y-4">
            <h3 className="font-semibold text-charcoal">Write a Review</h3>
            <div>
              <label className="text-sm font-medium text-charcoal">Property</label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full mt-1 rounded-lg border border-charcoal/20 px-3 py-2 text-sm focus:border-rust focus:outline-none"
              >
                <option value="">Select a property</option>
                {properties.map(p => (
                  <option key={p._id} value={p._id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-charcoal">Rating</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className={`text-2xl transition-colors ${s <= rating ? 'text-gold' : 'text-charcoal/20 hover:text-gold/50'}`}
                  >
                    {s <= rating ? '\u2605' : '\u2606'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-charcoal">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="w-full mt-1 rounded-lg border border-charcoal/20 px-3 py-2 text-sm focus:border-rust focus:outline-none resize-none"
              />
            </div>
            <button
              onClick={submitReview}
              disabled={!selectedProperty || submitting}
              className="px-6 py-2 rounded-lg bg-rust text-white text-sm font-medium hover:bg-rust-dark disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            description="After staying in a property, you can leave a review here."
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review._id} className="bg-white rounded-lg border border-sand p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-charcoal">{propertyName(review)}</h3>
                    <div className="mt-1">{renderStars(review.rating)}</div>
                    {review.comment && (
                      <p className="text-sm text-charcoal/70 mt-2">{review.comment}</p>
                    )}
                    <p className="text-xs text-charcoal/40 mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {review.landlordReply && (
                  <div className="mt-4 rounded-lg bg-sand/30 border border-sand p-4">
                    <p className="text-xs font-medium text-charcoal/60">Landlord reply:</p>
                    <p className="text-sm text-charcoal/80 mt-1">{review.landlordReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
