'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const AMENITIES = [
  'Parking', 'WiFi', 'Generator', 'Security Guard', 'CCTV',
  'Water Tank', 'Elevator', 'Furnished', 'Air Conditioning', 'Balcony',
  'Garden', 'Gym', 'Swimming Pool', 'Pet Friendly', 'Laundry'
]

const NEIGHBORHOODS = [
  // Addis Ababa
  'Bole', 'Kazanchis', 'CMC', 'Saris', 'Yeka', 'Piassa',
  'Merkato', 'Arat Kilo', 'Mekanissa', 'Kality', 'Old Airport',
  // Other Cities
  'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle', 'Adama',
  'Jimma', 'Gondar', 'Dessie', 'Harar', 'Axum'
]

export default function NewPropertyPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    propertyType: '',
    rentAmount: '',
    depositAmount: '',
    bedrooms: '',
    bathrooms: '',
    sizeM2: '',
    subCity: '',
    address: '',
    furnished: false,
    amenities: [] as string[],
    availableFrom: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    // Validation
    const newErrors: string[] = []
    if (!formData.title.trim()) newErrors.push('Title is required')
    if (!formData.propertyType) newErrors.push('Property type is required')
    if (!formData.rentAmount || Number(formData.rentAmount) <= 0) newErrors.push('Rent amount is required')
    if (!formData.bedrooms || Number(formData.bedrooms) <= 0) newErrors.push('Number of bedrooms is required')
    if (!formData.subCity) newErrors.push('Neighborhood is required')

    if (newErrors.length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('hl_token')

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        propertyType: formData.propertyType,
        rentAmount: Number(formData.rentAmount),
        depositAmount: formData.depositAmount ? Number(formData.depositAmount) : undefined,
        bedrooms: Number(formData.bedrooms),
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : undefined,
        sizeM2: formData.sizeM2 ? Number(formData.sizeM2) : undefined,
        location: {
          subCity: formData.subCity,
          address: formData.address.trim() || undefined,
          city: 'Addis Ababa',
        },
        furnished: formData.furnished,
        amenities: formData.amenities,
        availableFrom: formData.availableFrom || undefined,
        listingStatus: 'active',
      }

      const res = await fetch(`${API_URL}/api/v1/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrors([data.message || 'Failed to create property'])
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/landlord/properties')
      }, 1500)
    } catch (err) {
      console.error('Create property error:', err)
      setErrors(['Network error. Please check your connection and try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  const handleAmenityToggle = (amenity: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }))
  }

  if (success) {
    return (
      <>
        <TopBar title="Property Created" subtitle="Your property has been added" />
        <main className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-charcoal">Property Created Successfully!</h2>
            <p className="text-charcoal/60 mt-2">Redirecting to your properties...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar
        title="Add New Property"
        subtitle="List your property on HomeLink"
      />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-sand p-6 space-y-6">
            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, i) => (
                    <li key={i} className="text-red-700 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Property Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                placeholder="e.g., Modern 2BR Apartment in Bole"
              />
            </div>

            {/* Property Type & Neighborhood */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Property Type *</label>
                <select
                  value={formData.propertyType}
                  onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                >
                  <option value="">Select type</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="studio">Studio</option>
                  <option value="villa">Villa</option>
                  <option value="room">Room</option>
                  <option value="compound">Compound</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Neighborhood (Sub City) *</label>
                <select
                  value={formData.subCity}
                  onChange={(e) => setFormData({ ...formData, subCity: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                >
                  <option value="">Select neighborhood</option>
                  {NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Street Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                placeholder="e.g., Bole Road, near Edna Mall"
              />
            </div>

            {/* Rent, Deposit, Beds, Baths */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Rent (ETB/month) *</label>
                <input
                  type="number"
                  value={formData.rentAmount}
                  onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="18000"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Deposit (ETB)</label>
                <input
                  type="number"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="18000"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Bedrooms *</label>
                <input
                  type="number"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="2"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Bathrooms</label>
                <input
                  type="number"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="1"
                  min="0"
                />
              </div>
            </div>

            {/* Size */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Size (m²)</label>
                <input
                  type="number"
                  value={formData.sizeM2}
                  onChange={(e) => setFormData({ ...formData, sizeM2: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="65"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Available From</label>
                <input
                  type="date"
                  value={formData.availableFrom}
                  onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                placeholder="Describe your property — its features, condition, nearby landmarks, and what makes it special..."
              />
            </div>

            {/* Furnished Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.furnished}
                onChange={(e) => setFormData({ ...formData, furnished: e.target.checked })}
                className="rounded border-sand text-rust focus:ring-rust w-4 h-4"
              />
              <span className="text-sm font-medium text-charcoal">Furnished</span>
            </label>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Amenities</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AMENITIES.map((amenity) => (
                  <label
                    key={amenity}
                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer border transition-colors ${
                      formData.amenities.includes(amenity)
                        ? 'border-rust bg-rust/5'
                        : 'border-sand hover:bg-sand/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.amenities.includes(amenity)}
                      onChange={() => handleAmenityToggle(amenity)}
                      className="rounded border-sand text-rust focus:ring-rust"
                    />
                    <span className="text-sm text-charcoal">{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-sand">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 border border-sand rounded-lg hover:bg-sand transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-rust text-white px-6 py-2.5 rounded-lg hover:bg-rust-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Property'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
