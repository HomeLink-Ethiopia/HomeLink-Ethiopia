'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'

interface Property {
  _id: string
  title: string
  description?: string
  propertyType: string
  rentAmount: number
  bedrooms?: number
  bathrooms?: number
  sizeM2?: number
  location?: {
    address?: string
    subCity?: string
    woreda?: string
    city?: string
  }
  amenities?: string[]
  listingStatus: string
  verificationStatus: string
  images?: { url: string; isPrimary: boolean }[]
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: 'Available', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  reserved: { label: 'Reserved', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  rented: { label: 'Rented', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  inactive: { label: 'Inactive', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
  draft: { label: 'Draft', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
}

const TYPE_ICONS: Record<string, string> = {
  apartment: 'Apt',
  house: 'House',
  villa: 'Villa',
  studio: 'Studio',
  room: 'Room',
  compound: 'Compound',
  commercial: 'Commercial',
}

const MOCK_PROPERTIES: Property[] = [
  { _id: 'mock-p1', title: '2 Bedroom Apartment, Bole', description: 'Modern apartment near Edna Mall with great views', propertyType: 'apartment', rentAmount: 22000, bedrooms: 2, bathrooms: 1, sizeM2: 65, location: { address: 'Bole Road', subCity: 'Bole', city: 'Addis Ababa' }, amenities: ['Parking', 'WiFi', 'Generator', 'Security Guard'], listingStatus: 'active', verificationStatus: 'verified', images: [{ url: '', isPrimary: true }], createdAt: '2026-03-15T10:00:00Z' },
  { _id: 'mock-p2', title: 'Studio Apartment, Kazanchis', description: 'Cozy studio near UN Campus, fully furnished', propertyType: 'studio', rentAmount: 14500, bedrooms: 1, bathrooms: 1, sizeM2: 35, location: { address: 'Kazanchis', subCity: 'Kazanchis', city: 'Addis Ababa' }, amenities: ['WiFi', 'Furnished', 'Water Tank'], listingStatus: 'active', verificationStatus: 'verified', images: [{ url: '', isPrimary: true }], createdAt: '2026-04-01T08:00:00Z' },
  { _id: 'mock-p3', title: '3 Bedroom House, CMC', description: 'Spacious family home with garden', propertyType: 'house', rentAmount: 32000, bedrooms: 3, bathrooms: 2, sizeM2: 120, location: { address: 'CMC Area', subCity: 'CMC', city: 'Addis Ababa' }, amenities: ['Parking', 'Garden', 'Security Guard', 'Water Tank'], listingStatus: 'rented', verificationStatus: 'verified', images: [{ url: '', isPrimary: true }], createdAt: '2026-02-20T14:00:00Z' },
  { _id: 'mock-p4', title: 'Villa, Old Airport', description: 'Luxury villa with pool and compound', propertyType: 'villa', rentAmount: 45000, bedrooms: 4, bathrooms: 3, sizeM2: 200, location: { address: 'Old Airport', subCity: 'Old Airport', city: 'Addis Ababa' }, amenities: ['Swimming Pool', 'Garden', 'CCTV', 'Parking', 'Gym'], listingStatus: 'reserved', verificationStatus: 'pending', images: [{ url: '', isPrimary: true }], createdAt: '2026-05-01T09:00:00Z' },
  { _id: 'mock-p5', title: 'Room Rental, Saris', description: 'Affordable room with shared kitchen', propertyType: 'room', rentAmount: 6500, bedrooms: 1, bathrooms: 1, sizeM2: 18, location: { address: 'Saris', subCity: 'Saris', city: 'Addis Ababa' }, amenities: ['WiFi', 'Water Tank'], listingStatus: 'inactive', verificationStatus: 'verified', images: [{ url: '', isPrimary: true }], createdAt: '2026-01-10T12:00:00Z' },
]

export default function PropertiesPage() {
  const { t } = useLanguage()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/properties/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const props = data.data || []
        if (props.length > 0) {
          setProperties(props)
        } else {
          setProperties(MOCK_PROPERTIES)
        }
      } else {
        setProperties(MOCK_PROPERTIES)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      setProperties(MOCK_PROPERTIES)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProperties() }, [])

  const filteredProperties = filter === 'all'
    ? properties
    : properties.filter(p => p.listingStatus === filter)

  const stats = {
    total: properties.length,
    active: properties.filter(p => p.listingStatus === 'active').length,
    reserved: properties.filter(p => p.listingStatus === 'reserved').length,
    rented: properties.filter(p => p.listingStatus === 'rented').length,
    inactive: properties.filter(p => p.listingStatus === 'inactive').length,
    totalRevenue: properties.reduce((sum, p) => sum + (p.listingStatus === 'rented' ? p.rentAmount : 0), 0),
  }

  const handleStatusChange = async (propertyId: string, newStatus: string) => {
    try {
      setActionLoading(propertyId)
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingStatus: newStatus }),
      })
      setProperties(prev => prev.map(p => p._id === propertyId ? { ...p, listingStatus: newStatus } : p))
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (propertyId: string) => {
    try {
      setActionLoading(propertyId)
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setProperties(prev => prev.filter(p => p._id !== propertyId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete property:', err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <TopBar title="My Properties" subtitle="Manage your property listings" />

      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-charcoal">My Properties</h2>
            <p className="text-sm text-charcoal/50 mt-1">{properties.length} total properties</p>
          </div>
          <Link
            href="/landlord/properties/new"
            className="bg-rust text-white px-5 py-2.5 rounded-lg hover:bg-rust/90 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <span>+</span> Add New Property
          </Link>
        </div>

        {/* Stats */}
        {!loading && properties.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-charcoal/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-charcoal">{stats.total}</p>
              <p className="text-xs text-charcoal/50">Total</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
              <p className="text-xs text-emerald-600">Available</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.reserved}</p>
              <p className="text-xs text-amber-600">Reserved</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{stats.rented}</p>
              <p className="text-xs text-blue-600">Rented</p>
            </div>
            <div className="rounded-xl border border-charcoal/10 bg-charcoal/5 p-4 text-center">
              <p className="text-2xl font-bold text-charcoal">ETB {stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-charcoal/50">Monthly Revenue</p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        {!loading && properties.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: `All (${stats.total})` },
              { key: 'active', label: `Available (${stats.active})` },
              { key: 'reserved', label: `Reserved (${stats.reserved})` },
              { key: 'rented', label: `Rented (${stats.rented})` },
              { key: 'inactive', label: `Inactive (${stats.inactive})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-rust text-white'
                    : 'bg-white border border-charcoal/10 text-charcoal/60 hover:border-rust hover:text-rust'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-charcoal/10 p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 bg-charcoal/5 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-charcoal/5 rounded w-1/3" />
                    <div className="h-4 bg-charcoal/5 rounded w-1/4" />
                    <div className="h-6 bg-charcoal/5 rounded w-1/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-600">{error}</p>
            <button onClick={fetchProperties} className="mt-2 text-rust hover:underline text-sm">Try Again</button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && properties.length === 0 && (
          <div className="text-center py-16 rounded-xl border border-charcoal/10 bg-white">
            <div className="mx-auto h-16 w-16 rounded-full bg-charcoal/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-charcoal/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-charcoal">No Properties Yet</h3>
            <p className="mt-2 text-charcoal/50 max-w-sm mx-auto">
              Add your first property to start receiving applications from tenants.
            </p>
            <Link
              href="/landlord/properties/new"
              className="inline-block mt-4 bg-rust text-white px-6 py-2.5 rounded-lg hover:bg-rust/90 transition-colors text-sm font-medium"
            >
              + Add Your First Property
            </Link>
          </div>
        )}

        {/* Properties List */}
        {!loading && filteredProperties.length > 0 && (
          <div className="space-y-4">
            {filteredProperties.map(property => {
              const loc = property.location || {}
              const neighborhood = loc.subCity || loc.address || 'Unknown'
              const statusConfig = STATUS_CONFIG[property.listingStatus] || STATUS_CONFIG.inactive
              const typeLabel = TYPE_ICONS[property.propertyType] || property.propertyType
              const isDeleting = actionLoading === property._id

              return (
                <div key={property._id} className="bg-white rounded-xl border border-charcoal/10 hover:shadow-md transition-shadow overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Image Thumbnail */}
                      <Link href={`/landlord/properties/${property._id}`} className="w-24 h-24 rounded-lg bg-charcoal/5 flex items-center justify-center overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity">
                        {property.images?.[0]?.url ? (
                          <img src={`${API_URL}${property.images[0].url}`} alt={property.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-charcoal/40 uppercase tracking-wider">{typeLabel}</span>
                        )}
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/landlord/properties/${property._id}`} className="text-base font-semibold text-charcoal hover:text-rust transition-colors truncate">
                            {property.title}
                          </Link>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                            {statusConfig.label}
                          </span>
                          {property.verificationStatus === 'verified' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                              Verified
                            </span>
                          )}
                          {property.verificationStatus === 'pending' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-charcoal/50 mt-1">
                          {neighborhood}, {loc.city || 'Addis Ababa'}
                          {' • '}{property.bedrooms || 0} bed{' • '}{property.bathrooms || 0} bath
                          {property.sizeM2 ? ` • ${property.sizeM2} m²` : ''}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-lg font-bold text-charcoal">
                            ETB {property.rentAmount?.toLocaleString()}<span className="text-sm font-normal text-charcoal/40">/mo</span>
                          </p>
                          {property.amenities && property.amenities.length > 0 && (
                            <p className="text-xs text-charcoal/40">
                              {property.amenities.slice(0, 3).join(' • ')}{property.amenities.length > 3 ? ` +${property.amenities.length - 3}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Link
                          href={`/landlord/properties/${property._id}`}
                          className="px-3 py-1.5 rounded-lg border border-charcoal/10 text-xs font-medium text-charcoal/60 hover:bg-charcoal/5 transition-colors text-center"
                        >
                          View
                        </Link>
                        <Link
                          href={`/landlord/properties/${property._id}/edit`}
                          className="px-3 py-1.5 rounded-lg border border-charcoal/10 text-xs font-medium text-charcoal/60 hover:bg-charcoal/5 transition-colors text-center"
                        >
                          Edit
                        </Link>

                        {/* Status Change Dropdown */}
                        <div className="relative group">
                          <button className="px-3 py-1.5 rounded-lg border border-charcoal/10 text-xs font-medium text-charcoal/60 hover:bg-charcoal/5 transition-colors w-full">
                            Status ▾
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg border border-charcoal/10 shadow-lg py-1 z-10 hidden group-hover:block">
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                              <button
                                key={key}
                                onClick={() => handleStatusChange(property._id, key)}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-charcoal/5 transition-colors ${
                                  property.listingStatus === key ? 'font-medium text-rust' : 'text-charcoal/70'
                                }`}
                              >
                                {config.label}
                                {property.listingStatus === key && ' ✓'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Delete */}
                        {deleteConfirm === property._id ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleDelete(property._id)}
                              disabled={isDeleting}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
                            >
                              {isDeleting ? '...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-3 py-1.5 rounded-lg border border-charcoal/10 text-xs text-charcoal/60 hover:bg-charcoal/5 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(property._id)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No results for filter */}
        {!loading && properties.length > 0 && filteredProperties.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-charcoal/10 bg-white">
            <span className="text-3xl">🔍</span>
            <p className="mt-2 text-sm text-charcoal/50">No properties with status &quot;{STATUS_CONFIG[filter]?.label || filter}&quot;</p>
            <button onClick={() => setFilter('all')} className="mt-2 text-rust text-sm hover:underline">Show all properties</button>
          </div>
        )}
      </main>
    </>
  )
}
