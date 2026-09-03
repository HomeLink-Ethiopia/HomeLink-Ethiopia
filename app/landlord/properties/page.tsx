'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'

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

export default function PropertiesPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/properties/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setProperties(data.data || [])
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      setError('Failed to load properties. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProperties()
  }, [])

  const handleStatusToggle = async (propertyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      setActionLoading(propertyId)
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingStatus: newStatus }),
      })
      setProperties((prev) =>
        prev.map((p) =>
          p._id === propertyId ? { ...p, listingStatus: newStatus } : p
        )
      )
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return
    try {
      setActionLoading(propertyId)
      const token = localStorage.getItem('hl_token')
      await fetch(`${API_URL}/api/v1/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setProperties((prev) => prev.filter((p) => p._id !== propertyId))
    } catch (err) {
      console.error('Failed to delete property:', err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.properties.title}
        subtitle={t.dashboard.landlord.properties.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-charcoal">
            {t.dashboard.landlord.properties.myProperties}
          </h2>
          <Link
            href="/landlord/properties/new"
            className="bg-rust text-white px-4 py-2 rounded-lg hover:bg-rust-dark transition-colors"
          >
            + {t.dashboard.landlord.properties.addNew}
          </Link>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-sand p-6 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-sand rounded w-1/3"></div>
                    <div className="h-4 bg-sand rounded w-1/4"></div>
                    <div className="h-6 bg-sand rounded w-1/5"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-sand rounded w-16"></div>
                    <div className="h-8 bg-sand rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchProperties}
              className="mt-2 text-rust hover:text-rust-dark underline text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && properties.length === 0 && (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-charcoal/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-charcoal">
              {t.dashboard.landlord.properties.noProperties}
            </h3>
            <p className="mt-2 text-charcoal/60">
              Add your first property to start receiving applications from tenants.
            </p>
            <Link
              href="/landlord/properties/new"
              className="inline-block mt-4 bg-rust text-white px-6 py-2 rounded-lg hover:bg-rust-dark transition-colors"
            >
              + Add Your First Property
            </Link>
          </div>
        )}

        {/* Properties List */}
        {!loading && properties.length > 0 && (
          <div className="grid gap-4">
            {properties.map((property) => {
              const location = property.location || {}
              const neighborhood = location.subCity || location.address || 'Unknown'
              const primaryImage = property.images?.find((img) => img.isPrimary)
              const isDeleting = actionLoading === property._id

              return (
                <div
                  key={property._id}
                  className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 bg-sand rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {primaryImage ? (
                        <img
                          src={`${API_URL}${primaryImage.url}`}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-8 h-8 text-charcoal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-charcoal">
                          {property.title}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            property.listingStatus === 'active'
                              ? 'bg-verified text-white'
                              : property.listingStatus === 'rented'
                              ? 'bg-gold text-charcoal'
                              : 'bg-sand text-charcoal'
                          }`}
                        >
                          {property.listingStatus === 'active'
                            ? 'Active'
                            : property.listingStatus === 'rented'
                            ? 'Rented'
                            : property.listingStatus === 'draft'
                            ? 'Draft'
                            : 'Inactive'}
                        </span>
                        {property.verificationStatus === 'verified' && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Verified
                          </span>
                        )}
                        {property.verificationStatus === 'pending' && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            Under Review
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-charcoal/60 mt-1">
                        {neighborhood} • {property.bedrooms || 0} bed • {property.bathrooms || 0} bath
                        {property.sizeM2 ? ` • ${property.sizeM2} m²` : ''}
                      </p>
                      <p className="text-lg font-bold text-charcoal mt-2">
                        ETB {property.rentAmount?.toLocaleString()}<span className="text-sm font-normal text-charcoal/60">/month</span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Link
                        href={`/landlord/properties/${property._id}/edit`}
                        className="px-3 py-1.5 border border-sand rounded hover:bg-sand transition-colors text-sm text-center"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleStatusToggle(property._id, property.listingStatus)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 border border-sand rounded hover:bg-sand transition-colors text-sm disabled:opacity-50"
                      >
                        {property.listingStatus === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(property._id)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors text-sm disabled:opacity-50"
                      >
                        {isDeleting ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
