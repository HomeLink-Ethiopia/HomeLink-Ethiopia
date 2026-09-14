'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { fetchProperty, mapApiProperty, type Property } from '@/services/api'
import { useFavoritesStore } from '@/lib/store'
import ReviewsSection from '@/components/property/ReviewsSection'
import ActionCard from '@/components/property/ActionCard'
import ReportButton from '@/components/property/ReportButton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const PropertyMap = dynamic(() => import('@/components/discovery/PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-sand text-sm text-charcoal/50">
      Loading map…
    </div>
  ),
})

/* ─── RAW BACKEND SHAPE (superset of the mapped Property) ──────────────── */

interface RawLandlord {
  _id?: string
  legalName?: string
  verificationStatus?: string
  averageRating?: number
  reviewCount?: number
  createdAt?: string
  accountId?: { email?: string; phone?: string; createdAt?: string }
}

interface RawProperty extends Property {
  address?: string
  city?: string
  location?: { address?: string; subCity?: string; city?: string }
  depositAmount?: number
  availableFrom?: string
  listingStatus?: string
  landlord?: RawLandlord
  fraudRiskScore?: number
  condition?: string
  floor?: number
  rentFrequency?: string
}

const AVAILABILITY_LABEL: Record<string, { text: string; cls: string }> = {
  active: { text: 'Available Now', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  draft: { text: 'Draft', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  rented: { text: 'Rented', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  inactive: { text: 'Unavailable', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  suspended: { text: 'Unavailable', cls: 'bg-red-50 border-red-200 text-red-700' },
}

const VERIFICATION_LABEL: Record<string, { text: string; cls: string }> = {
  verified: { text: 'Verified Property', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  pending: { text: 'Verification Pending', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  under_review: { text: 'Verification Under Review', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  unverified: { text: 'Unverified', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  rejected: { text: 'Verification Rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
  suspended: { text: 'Verification Rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
}

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [property, setProperty] = useState<RawProperty | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const saved = useFavoritesStore((s) => s.favorites.has(id))
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  useFavoritesStore((s) => s.hydrate)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`${API_URL}/api/public/properties/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'This property no longer exists or has been removed.' : `Server error (${res.status})`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const raw = json?.data
        if (!raw) throw new Error('This property no longer exists or has been removed.')
        // Keep the full raw record (landlord, deposit, availability) and merge
        // the mapped fields so the rest of the UI keeps working.
        const mapped = mapApiProperty(raw)
        setProperty({ ...mapped, ...raw, id: raw._id, images: mapped.images, image: mapped.image } as RawProperty)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || 'Could not load this property.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
          <div className="h-72 animate-pulse rounded-xl bg-charcoal/5" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-charcoal/5" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-charcoal/5" />
          <div className="h-40 animate-pulse rounded-xl bg-charcoal/5" />
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="max-w-md px-4 text-center">
          <h1 className="font-display text-xl font-semibold text-charcoal">
            {error || 'Property not found'}
          </h1>
          <Link
            href="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-rust px-5 py-2.5 text-sm font-semibold text-white shadow-stamp transition-colors hover:bg-rust-dark"
          >
            Browse properties
          </Link>
        </div>
      </div>
    )
  }

  const galleryImages = (property.images && property.images.length > 0)
    ? property.images
    : [property.image || '/images/placeholder.svg']
  const gallery = galleryImages.map((u) => (u.startsWith('http') ? u : `${API_URL}${u}`))

  const city = property.city || property.location?.city || 'Addis Ababa'
  const areaLabel = [property.location?.subCity, city].filter(Boolean).join(', ')
  const deposit = property.depositAmount ?? (property.priceEtb ? property.priceEtb * 2 : 0)
  const availability = AVAILABILITY_LABEL[property.listingStatus || property.availability || 'active'] || AVAILABILITY_LABEL.active
  const verification = VERIFICATION_LABEL[property.verificationStatus || (property.verified ? 'verified' : 'unverified')] || VERIFICATION_LABEL.unverified
  const landlord = property.landlord
  const landlordVerified = landlord?.verificationStatus === 'verified'
  const memberSince = landlord?.accountId?.createdAt || landlord?.createdAt

  return (
    <div className="min-h-screen bg-cream/40">

      <div className="border-b border-charcoal/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/explore"
            className="flex items-center gap-2 text-sm font-medium text-charcoal/70 transition-colors hover:text-rust"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to results
          </Link>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => toggleFavorite(id)}
              aria-pressed={saved}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${saved ? 'text-rust' : 'text-charcoal/60 hover:text-rust'}`}
            >
              <svg viewBox="0 0 20 20" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                <path d="M10 17.3s-6.5-3.9-8.5-8.1C.4 6.2 2 3.3 5 3c1.8-.2 3.6.7 5 2.4C11.4 3.7 13.2 2.8 15 3c3 .3 4.6 3.2 3.5 6.2-2 4.2-8.5 8.1-8.5 8.1z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Gallery */}
            <div>
              <div className="relative h-80 overflow-hidden rounded-xl border border-charcoal/10 bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gallery[0]} alt={property.title} className="h-full w-full object-cover" />
                {property.verified && (
                  <span className="absolute left-3 top-3 rounded bg-verified px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Verified
                  </span>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {gallery.slice(0, 5).map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img} alt={`${property.title} photo ${i + 1}`} className="h-20 w-full cursor-pointer rounded-lg border border-charcoal/10 object-cover transition-opacity hover:opacity-80" />
                  ))}
                </div>
              )}
            </div>

            {/* Title & Location */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold text-charcoal">{property.title}</h1>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${availability.cls}`}>
                  {availability.text}
                </span>
              </div>
              <p className="mt-1 text-base text-charcoal/60">{areaLabel}</p>
              {property.location?.address && (
                <p className="text-sm text-charcoal/50">{property.location.address}</p>
              )}
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${verification.cls}`}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001z" clipRule="evenodd" />
                </svg>
                {verification.text}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <p className="text-lg font-bold text-charcoal">{property.beds}</p>
                <p className="text-xs text-charcoal/60">Bedrooms</p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <p className="text-lg font-bold text-charcoal">{property.baths}</p>
                <p className="text-xs text-charcoal/60">Bathrooms</p>
              </div>
              {property.sizeSqm ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                  <p className="text-lg font-bold text-charcoal">{property.sizeSqm}</p>
                  <p className="text-xs text-charcoal/60">m²</p>
                </div>
              ) : null}
              {property.propertyType ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                  <p className="text-sm font-bold capitalize text-charcoal">{property.propertyType}</p>
                  <p className="text-xs text-charcoal/60">Type</p>
                </div>
              ) : null}
            </div>

            {/* About This Home */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-charcoal">About this home</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-charcoal/80">
                {property.description || 'The landlord has not added a description for this property yet.'}
              </p>
            </div>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="rounded-lg border border-charcoal/10 bg-white p-6">
                <h2 className="font-display text-lg font-semibold text-charcoal">Amenities</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {property.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2 rounded-lg border border-charcoal/10 px-3 py-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rust">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-charcoal/80">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-charcoal">Location</h2>
                  <p className="mt-1 text-sm text-charcoal/70">{areaLabel}</p>
                </div>
                <Link href="/explore" className="text-sm font-medium text-rust transition-colors hover:text-rust-dark">
                  View full map
                </Link>
              </div>
              <div className="mt-4 h-80 overflow-hidden rounded-lg">
                <PropertyMap properties={[property as Property]} />
              </div>
            </div>

            {/* Landlord verification */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-charcoal">Listed by</h2>
              <div className="mt-4 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand text-lg font-semibold text-charcoal/70">
                  {(landlord?.legalName || 'L').charAt(0).toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-charcoal">{landlord?.legalName || 'Landlord'}</p>
                    {landlordVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Identity Verified
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Identity Not Verified
                      </span>
                    )}
                  </div>
                  {memberSince && (
                    <p className="mt-1 text-xs text-charcoal/50">
                      Member since {new Date(memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-charcoal/50">
                    HomeLink verifies landlord identity documents before they can list properties.
                  </p>
                </div>
              </div>
            </div>

            {/* Reviews & Ratings */}
            <ReviewsSection propertyId={id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
            <ActionCard
              propertyId={id}
              propertyTitle={property.title}
              priceEtb={property.priceEtb}
              depositEtb={deposit}
            />

            <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-sm">
              <p className="text-center text-sm text-charcoal/70">
                Available from{' '}
                <span className="font-semibold text-charcoal">
                  {property.availableFrom
                    ? new Date(property.availableFrom).toLocaleDateString()
                    : 'now'}
                </span>
              </p>
              <Link
                href={`/explore?city=${encodeURIComponent(property.location?.subCity || '')}`}
                className="mt-4 block w-full rounded-lg border-2 border-charcoal/15 px-5 py-3 text-center text-sm font-bold text-charcoal transition-all hover:border-rust hover:text-rust"
              >
                Compare with similar homes
              </Link>
              <div className="mt-4 flex items-center justify-center gap-1 text-xs text-charcoal/50">
                <span>See something wrong?</span>
                <ReportButton propertyId={id} propertyTitle={property.title} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
