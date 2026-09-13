'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PROPERTIES, formatEtb, type Property } from '@/lib/properties'
import { useFavoritesStore } from '@/lib/store'
import TopNav from '@/components/TopNav'

export default function ExplorePropertyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [showGallery, setShowGallery] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const saved = useFavoritesStore((s) => s.favorites.has(id))
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

  useEffect(() => {
    const found = PROPERTIES.find(p => p.id === id)
    setProperty(found || null)
    setLoading(false)
  }, [id])

  if (loading) {
    return (
      <>
        <TopNav />
        <div className="min-h-screen bg-white pt-16">
          <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded bg-charcoal/5" />)}
          </div>
        </div>
      </>
    )
  }

  if (!property) {
    return (
      <>
        <TopNav />
        <div className="min-h-screen bg-white pt-16 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl font-bold text-charcoal">Property not found</h1>
          <p className="text-charcoal/50 mt-2">This listing may have been removed or is no longer available.</p>
          <Link href="/explore" className="mt-6 bg-rust text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-rust/90 transition-colors">
            Back to Explore
          </Link>
        </div>
      </>
    )
  }

  const neighborhood = property.neighborhood
  const allImages = [property.image, ...(property.images || [])]

  return (
    <>
      <TopNav />
      <div className="min-h-screen bg-white pt-16">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {/* Back */}
          <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-charcoal/50 hover:text-charcoal mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to listings
          </Link>

          {/* Image Gallery */}
          <div className="mb-6 rounded-xl overflow-hidden bg-charcoal/5">
            <div className="relative aspect-[16/9] bg-charcoal/5">
              <img
                src={allImages[activeImage]}
                alt={property.title}
                className="w-full h-full object-cover"
              />
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : allImages.length - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-charcoal shadow"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    onClick={() => setActiveImage(prev => prev < allImages.length - 1 ? prev + 1 : 0)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-charcoal shadow"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button
                    onClick={() => setShowGallery(true)}
                    className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
                  >
                    {allImages.length} photos
                  </button>
                </>
              )}
              {/* Badges */}
              <div className="absolute top-3 left-3 flex gap-2">
                {property.verified && (
                  <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Verified
                  </span>
                )}
                {property.status === 'active' && (
                  <span className="bg-white/90 text-charcoal text-xs font-semibold px-3 py-1 rounded-full">
                    Available
                  </span>
                )}
              </div>
              {/* Save button */}
              <button
                onClick={() => toggleFavorite(property.id)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow transition-colors"
              >
                <svg
                  className={`w-5 h-5 transition-colors ${saved ? 'text-red-500 fill-red-500' : 'text-charcoal/40'}`}
                  fill={saved ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </button>
            </div>
            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-white">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-12 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      i === activeImage ? 'border-rust' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & Location */}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-charcoal">{property.title}</h1>
                  {property.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-charcoal/50 text-sm mt-1">
                  {neighborhood}, Addis Ababa
                </p>
                {/* Rating */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-500">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-semibold text-charcoal">{property.rating}</span>
                    <span className="text-sm text-charcoal/50">({property.reviewCount} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Type', value: property.propertyType || 'Apartment' },
                  { label: 'Bedrooms', value: property.beds },
                  { label: 'Bathrooms', value: property.baths },
                  { label: 'Size', value: `${property.sizeSqm} m\u00B2` },
                ].map((stat, i) => (
                  <div key={i} className="rounded-lg bg-charcoal/5 p-3 text-center">
                    <p className="text-[11px] text-charcoal/40 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-sm font-semibold text-charcoal capitalize mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {property.description && (
                <div>
                  <h2 className="text-base font-semibold text-charcoal mb-3">About this property</h2>
                  <p className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{property.description}</p>
                </div>
              )}

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-charcoal mb-3">Amenities</h2>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((amenity, i) => (
                      <span key={i} className="rounded-full bg-charcoal/5 px-3 py-1.5 text-xs font-medium text-charcoal/70">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <h2 className="text-base font-semibold text-charcoal mb-3">Location</h2>
                <div className="rounded-lg bg-charcoal/5 p-4">
                  <p className="text-sm text-charcoal/70 font-medium">{neighborhood}, Addis Ababa</p>
                  <p className="text-xs text-charcoal/40 mt-1">Approximate location shown on map</p>
                  <div className="mt-3 h-40 rounded-lg bg-charcoal/5 flex items-center justify-center">
                    <p className="text-xs text-charcoal/30">Map integration</p>
                  </div>
                </div>
              </div>

              {/* Landlord Info */}
              <div>
                <h2 className="text-base font-semibold text-charcoal mb-3">Listed by</h2>
                <div className="flex items-center gap-4 rounded-lg border border-charcoal/10 p-4">
                  <div className="w-12 h-12 rounded-full bg-charcoal/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-charcoal/40">A</span>
                  </div>
                  <div>
                    <p className="font-medium text-charcoal">Abebe Kebede</p>
                    <p className="text-xs text-charcoal/50">Landlord since 2024</p>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Price Card */}
              <div className="rounded-xl border border-charcoal/10 bg-white p-6 sticky top-20">
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-charcoal">ETB {property.priceEtb.toLocaleString()}</p>
                  <p className="text-sm text-charcoal/50">/month</p>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal/50">Available</span>
                    <span className="font-medium text-charcoal">Immediately</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal/50">Deposit</span>
                    <span className="font-medium text-charcoal">1 month</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowContact(true)}
                  className="w-full bg-rust text-white py-3 rounded-lg text-sm font-semibold hover:bg-rust/90 transition-colors mb-2"
                >
                  Contact Landlord
                </button>
                <button
                  onClick={() => toggleFavorite(property.id)}
                  className={`w-full py-3 rounded-lg text-sm font-semibold border transition-colors ${
                    saved
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-charcoal/20 text-charcoal/70 hover:bg-charcoal/5'
                  }`}
                >
                  {saved ? 'Saved' : 'Save Property'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">{property.title}</h3>
              <button onClick={() => setShowGallery(false)} className="text-white/60 hover:text-white text-2xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="relative">
              <img src={allImages[activeImage]} alt="" className="w-full rounded-lg max-h-[70vh] object-contain" />
              <button
                onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : allImages.length - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={() => setActiveImage(prev => prev < allImages.length - 1 ? prev + 1 : 0)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                {activeImage + 1} / {allImages.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-charcoal">Contact Landlord</h3>
              <button onClick={() => setShowContact(false)} className="text-charcoal/40 hover:text-charcoal">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-charcoal/60">
                To contact the landlord about this property, you&apos;ll need an account.
              </p>
              <div className="rounded-lg bg-charcoal/5 p-4">
                <p className="text-sm font-medium text-charcoal">Abebe Kebede</p>
                <p className="text-xs text-charcoal/50 mt-1">Verified Landlord</p>
              </div>
              <Link
                href="/signup"
                className="block w-full bg-rust text-white py-2.5 rounded-lg text-sm font-semibold text-center hover:bg-rust/90 transition-colors"
              >
                Sign Up to Contact
              </Link>
              <Link
                href="/login"
                className="block w-full border border-charcoal/20 text-charcoal/70 py-2.5 rounded-lg text-sm font-medium text-center hover:bg-charcoal/5 transition-colors"
              >
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
