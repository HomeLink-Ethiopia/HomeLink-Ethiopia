'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/landlord/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface PropertyImage {
  url: string
  isPrimary: boolean
  caption?: string
}

interface Property {
  _id: string
  title: string
  description?: string
  propertyType: string
  rentAmount: number
  depositAmount?: number
  bedrooms?: number
  bathrooms?: number
  sizeM2?: number
  floor?: number
  furnished?: boolean
  amenities?: string[]
  location?: {
    address?: string
    subCity?: string
    woreda?: string
    city?: string
  }
  listingStatus: string
  verificationStatus: string
  images?: PropertyImage[]
  availableFrom?: string
  createdAt: string
}

const MOCK_PROPERTY: Property = {
  _id: 'mock-p1', title: '2 Bedroom Apartment, Bole', description: 'Modern 2-bedroom apartment located in the heart of Bole, near Edna Mall. Features a spacious living area, fitted kitchen, and great city views. The apartment is in a secure compound with 24/7 security guard, backup generator, and covered parking. Perfect for professionals or small families looking for a comfortable home in Addis Ababa\'s most vibrant neighborhood.',
  propertyType: 'apartment', rentAmount: 22000, depositAmount: 44000, bedrooms: 2, bathrooms: 1, sizeM2: 65, floor: 3, furnished: false,
  amenities: ['Parking', 'WiFi', 'Generator', 'Security Guard', 'Water Tank', 'Elevator'],
  location: { address: 'Bole Road, Near Edna Mall', subCity: 'Bole', woreda: '03', city: 'Addis Ababa' },
  listingStatus: 'active', verificationStatus: 'verified', images: [{ url: '', isPrimary: true }],
  availableFrom: '2026-06-01', createdAt: '2026-03-15T10:00:00Z',
}

const TYPE_ICONS: Record<string, string> = {
  apartment: 'Apt', house: 'House', villa: 'Villa', studio: 'Studio', room: 'Room', compound: 'Compound', commercial: 'Commercial',
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: 'Available', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  reserved: { label: 'Reserved', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  rented: { label: 'Rented', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  inactive: { label: 'Inactive', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
  draft: { label: 'Draft', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
}

const VERIFICATION_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  verified: { label: 'Verified', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  pending: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  unverified: { label: 'Unverified', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [showFullGallery, setShowFullGallery] = useState(false)
  const [statusMenu, setStatusMenu] = useState(false)

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('hl_token')
        const res = await fetch(`${API_URL}/api/v1/properties/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json()
          setProperty(data.data || data)
        } else {
          setProperty(MOCK_PROPERTY)
        }
      } catch {
        setProperty(MOCK_PROPERTY)
      } finally {
        setLoading(false)
      }
    }
    fetchProperty()
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!property) return
    try {
      setActionLoading(true)
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingStatus: newStatus }),
      })
      setProperty(prev => prev ? { ...prev, listingStatus: newStatus } : null)
    } catch {
      setProperty(prev => prev ? { ...prev, listingStatus: newStatus } : null)
    } finally {
      setActionLoading(false)
      setStatusMenu(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) return
    try {
      setActionLoading(true)
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/properties/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      router.push('/landlord/properties')
    } catch {
      router.push('/landlord/properties')
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Property Details" />
        <div className="flex-1 px-6 py-8 space-y-4">
          <div className="h-64 animate-pulse rounded-xl bg-charcoal/5" />
          <div className="h-8 animate-pulse rounded bg-charcoal/5 w-1/3" />
          <div className="h-4 animate-pulse rounded bg-charcoal/5 w-1/2" />
        </div>
      </>
    )
  }

  if (!property) {
    return (
      <>
        <TopBar title="Property Details" />
        <div className="flex-1 px-6 py-8 text-center">
          <span className="text-5xl">🔍</span>
          <p className="mt-4 text-charcoal/50 text-lg">Property not found</p>
          <Link href="/landlord/properties" className="mt-4 inline-block text-rust hover:underline">← Back to Properties</Link>
        </div>
      </>
    )
  }

  const status = STATUS_MAP[property.listingStatus] || STATUS_MAP.inactive
  const verification = VERIFICATION_MAP[property.verificationStatus] || VERIFICATION_MAP.unverified
  const loc = property.location || {}
  const neighborhood = loc.subCity || loc.address || 'Unknown'
  const typeLabel = TYPE_ICONS[property.propertyType] || property.propertyType
  const images = property.images || []
  const hasImages = images.length > 0

  return (
    <>
      <TopBar title="Property Details" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        {/* Back link */}
        <Link href="/landlord/properties" className="inline-flex items-center gap-1 text-sm text-charcoal/50 hover:text-charcoal mb-4">
          ← Back to Properties
        </Link>

        {/* ═══ IMAGE GALLERY ═══ */}
        <div className="mb-6 rounded-xl overflow-hidden bg-charcoal/5">
          {hasImages ? (
            <>
              {/* Main Image */}
              <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-charcoal/5">
                <img
                  src={`${API_URL}${images[activeImageIndex]?.url}`}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                {/* Image count badge */}
                {images.length > 1 && (
                  <button
                    onClick={() => setShowFullGallery(true)}
                    className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
                  >
                     {images.length} photos — View all
                  </button>
                )}
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-charcoal shadow-lg"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setActiveImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-charcoal shadow-lg"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`w-16 h-12 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        i === activeImageIndex ? 'border-rust' : 'border-transparent hover:border-charcoal/20'
                      }`}
                    >
                      <img src={`${API_URL}${img.url}`} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-[16/9] sm:aspect-[21/9] flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl font-medium text-charcoal/20 uppercase">{typeLabel}</span>
                <p className="mt-2 text-sm text-charcoal/40">No photos uploaded yet</p>
                <Link href={`/landlord/properties/${id}/edit`} className="mt-2 inline-block text-sm text-rust hover:underline">
                  Add photos →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-charcoal">{property.title}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block`}></span> {status.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${verification.bg} ${verification.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${verification.dot} inline-block`}></span> {verification.label}
              </span>
            </div>
            <p className="text-charcoal/50 text-sm mt-1">
              {neighborhood}, {loc.city || 'Addis Ababa'} {loc.address && `• ${loc.address}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ═══ MAIN CONTENT ═══ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {property.description && (
              <div className="rounded-xl border border-charcoal/10 bg-white p-6">
                <h2 className="text-base font-semibold text-charcoal mb-3">Description</h2>
                <p className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{property.description}</p>
              </div>
            )}

            {/* Property Details Grid */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-4">Property Details</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Type', value: property.propertyType, highlight: false },
                  { label: 'Bedrooms', value: property.bedrooms || 'N/A', highlight: false },
                  { label: 'Bathrooms', value: property.bathrooms || 'N/A', highlight: false },
                  { label: 'Size', value: property.sizeM2 ? `${property.sizeM2} m²` : 'N/A', highlight: false },
                  { label: 'Floor', value: property.floor ? `${property.floor}${property.floor === 1 ? 'st' : property.floor === 2 ? 'nd' : property.floor === 3 ? 'rd' : 'th'}` : 'N/A', highlight: false },
                  { label: 'Furnished', value: property.furnished ? ' Yes' : ' No', highlight: false },
                  { label: 'Available', value: property.availableFrom ? new Date(property.availableFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Now', highlight: false },
                  { label: 'Listed', value: new Date(property.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), highlight: false },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg bg-charcoal/5 p-3 text-center">
                    <p className="text-[11px] text-charcoal/40 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-charcoal mt-0.5 capitalize">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="rounded-xl border border-charcoal/10 bg-white p-6">
                <h2 className="text-base font-semibold text-charcoal mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a, i) => (
                    <span key={i} className="rounded-full bg-rust/10 px-3 py-1.5 text-xs font-medium text-rust">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-3">Location</h2>
              <div className="space-y-2 text-sm">
                {loc.address && <p className="text-charcoal/70">{loc.address}</p>}
                {loc.subCity && <p className="text-charcoal/50">Sub-City: <span className="font-medium text-charcoal/70">{loc.subCity}</span></p>}
                {loc.woreda && <p className="text-charcoal/50">Woreda: <span className="font-medium text-charcoal/70">{loc.woreda}</span></p>}
                <p className="text-charcoal/50">City: <span className="font-medium text-charcoal/70">{loc.city || 'Addis Ababa'}</span></p>
              </div>
              {/* Map placeholder */}
              <div className="mt-4 rounded-lg bg-charcoal/5 h-40 flex items-center justify-center">
                <p className="text-xs text-charcoal/30">Map view (coming soon)</p>
              </div>
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <div className="space-y-6">
            {/* Pricing */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6 sticky top-4">
              <h2 className="text-base font-semibold text-charcoal mb-4">Pricing</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-charcoal">ETB {property.rentAmount.toLocaleString()}</p>
                <p className="text-sm text-charcoal/50">/month</p>
              </div>
              {property.depositAmount && (
                <div className="rounded-lg bg-charcoal/5 p-3 text-center mb-3">
                  <p className="text-xs text-charcoal/40">Security Deposit</p>
                  <p className="text-sm font-medium text-charcoal">ETB {property.depositAmount.toLocaleString()}</p>
                </div>
              )}
              {property.availableFrom && (
                <div className="rounded-lg bg-charcoal/5 p-3 text-center mb-4">
                  <p className="text-xs text-charcoal/40">Available From</p>
                  <p className="text-sm font-medium text-charcoal">
                    {new Date(property.availableFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )}

              {/* Quick Stats */}
              <div className="border-t border-charcoal/10 pt-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal/50">Status</span>
                  <span className={`font-medium ${status.color}`}><span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block`}></span> {status.label}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-charcoal/50">Verification</span>
                  <span className={`font-medium ${verification.color}`}><span className={`w-1.5 h-1.5 rounded-full ${verification.dot} inline-block`}></span> {verification.label}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Link
                  href={`/landlord/properties/${id}/edit`}
                  className="block w-full rounded-lg bg-rust px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-rust/90 transition-colors"
                >
                  Edit Property
                </Link>

                {/* Status Change */}
                <div className="relative">
                  <button
                    onClick={() => setStatusMenu(!statusMenu)}
                    disabled={actionLoading}
                    className="block w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-center text-sm font-medium text-charcoal/70 hover:bg-charcoal/5 transition-colors disabled:opacity-50"
                  >
                    {property.listingStatus === 'active' ? 'Deactivate' : property.listingStatus === 'reserved' ? 'Mark Available' : 'Mark Available'} ▾
                  </button>
                  {statusMenu && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-charcoal/10 shadow-lg py-1 z-10">
                      {Object.entries(STATUS_MAP).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-charcoal/5 transition-colors ${
                            property.listingStatus === key ? 'font-medium text-rust' : 'text-charcoal/70'
                          }`}
                        >
                          {config.label}
                          {property.listingStatus === key && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="block w-full rounded-lg border border-red-200 px-4 py-2.5 text-center text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Delete Property
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FULL GALLERY MODAL ═══ */}
      {showFullGallery && hasImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">{property.title} — Photos</h3>
              <button onClick={() => setShowFullGallery(false)} className="text-white/60 hover:text-white text-2xl">✕</button>
            </div>
            <div className="relative">
              <img
                src={`${API_URL}${images[activeImageIndex]?.url}`}
                alt={`Photo ${activeImageIndex + 1}`}
                className="w-full rounded-lg max-h-[70vh] object-contain"
              />
              <button
                onClick={() => setActiveImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-2xl"
              >
                ‹
              </button>
              <button
                onClick={() => setActiveImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-2xl"
              >
                ›
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                {activeImageIndex + 1} / {images.length}
              </div>
            </div>
            <div className="flex gap-2 mt-4 overflow-x-auto justify-center">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`w-20 h-14 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                    i === activeImageIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={`${API_URL}${img.url}`} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
