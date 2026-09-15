'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { MOCK_REVIEWS, getPropertyRating, type Review } from '@/lib/reviews'

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          fill={i <= rating ? '#B8451F' : 'none'}
          stroke={i <= rating ? '#B8451F' : '#D1CBC4'}
          strokeWidth={1.5}
          className={sz}
        >
          <path d="M10 2l2.4 4.8 5.3.8-3.8 3.7.9 5.2L10 13.8l-4.8 2.7.9-5.2L2.3 7.6l5.3-.8L10 2z" />
        </svg>
      ))}
    </div>
  )
}

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-right text-xs font-medium text-charcoal/50">{stars}</span>
      <svg viewBox="0 0 12 12" fill="#B8451F" className="h-3 w-3">
        <path d="M6 1l1.5 3 3.3.5-2.4 2.3.6 3.2L6 8.4 3 10l.6-3.2L1.2 4.5l3.3-.5L6 1z" />
      </svg>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full bg-rust"
        />
      </div>
      <span className="w-6 text-right text-xs text-charcoal/40">{count}</span>
    </div>
  )
}

export default function ReviewsSection({ propertyId }: { propertyId: string }) {
  const [showAll, setShowAll] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'highest'>('recent')
  const summary = getPropertyRating(propertyId)
  const reviews = MOCK_REVIEWS[propertyId] || []

  const sorted = [...reviews].sort((a, b) => {
    if (sortBy === 'helpful') return b.helpful - a.helpful
    if (sortBy === 'highest') return b.rating - a.rating
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const displayed = showAll ? sorted : sorted.slice(0, 3)

  if (reviews.length === 0) return null

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-stamp">
      <h2 className="font-display text-lg font-semibold text-charcoal">Reviews & Ratings</h2>

      {/* Summary */}
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center">
          <span className="font-display text-4xl font-bold text-charcoal">{summary.averageRating}</span>
          <StarRating rating={Math.round(summary.averageRating)} size="lg" />
          <span className="mt-1 text-xs text-charcoal/50">{summary.totalReviews} reviews</span>
        </div>

        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((s) => (
            <RatingBar key={s} stars={s} count={summary.breakdown[s as keyof typeof summary.breakdown]} total={summary.totalReviews} />
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="mt-6 flex items-center gap-2 border-t border-charcoal/10 pt-4">
        <span className="text-xs text-charcoal/50">Sort by:</span>
        {(['recent', 'helpful', 'highest'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSortBy(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              sortBy === s ? 'bg-rust text-white' : 'bg-cream text-charcoal/60 hover:text-charcoal'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Reviews */}
      <div className="mt-4 space-y-4">
        {displayed.map((review) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-charcoal/5 pb-4 last:border-0"
          >
            <div className="flex items-start gap-3">
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-sand">
                <Image src={review.authorAvatar} alt={review.authorName} fill sizes="36px" className="object-cover" />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{review.authorName}</p>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="text-[11px] text-charcoal/40">{review.date}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-charcoal">{review.title}</p>
                <p className="mt-1 text-sm text-charcoal/70 leading-relaxed">{review.text}</p>
                <button type="button" className="mt-2 flex items-center gap-1 text-[11px] text-charcoal/40 hover:text-rust transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} className="h-3.5 w-3.5">
                    <path d="M5 14V7l3-5a1 1 0 011 1v3h4.5a1 1 0 01.9.6l1.5 4a1 1 0 01-1 1.4H5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Helpful ({review.helpful})
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {reviews.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-4 text-sm font-medium text-rust hover:text-rust-dark transition-colors"
        >
          {showAll ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
        </button>
      )}
    </div>
  )
}
