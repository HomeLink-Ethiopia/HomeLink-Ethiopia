'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { validatePropertyForm, PropertyFormData } from '@/lib/propertyValidation'
import { Neighborhood } from '@/lib/properties'

export default function NewPropertyPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const [errors, setErrors] = useState<string[]>([])
  const [formData, setFormData] = useState<Partial<PropertyFormData>>({
    title: '',
    neighborhood: undefined,
    priceEtb: undefined,
    beds: undefined,
    baths: undefined,
    sizeSqm: undefined,
    description: '',
    propertyType: undefined,
    amenities: [],
    images: [],
  })

  // Verification guard
  useEffect(() => {
    if (user && user.verificationStatus !== 'verified') {
      router.push('/landlord/verification-status?message=verification_required')
    }
  }, [user, router])

  if (!user || user.verificationStatus !== 'verified') {
    return null // Will redirect
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validatePropertyForm(formData)
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    // In production, save to backend
    console.log('Creating property:', formData)
    
    // Redirect to properties list
    router.push('/landlord/properties')
  }

  const handleAmenityToggle = (amenity: string) => {
    const currentAmenities = formData.amenities || []
    if (currentAmenities.includes(amenity)) {
      setFormData({
        ...formData,
        amenities: currentAmenities.filter((a) => a !== amenity),
      })
    } else {
      setFormData({
        ...formData,
        amenities: [...currentAmenities, amenity],
      })
    }
  }

  return (
    <>
      <TopBar
        title={t.propertyForm.title}
        subtitle={t.propertyForm.subtitle}
      />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-sand p-6 space-y-6">
            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, i) => (
                    <li key={i} className="text-red-700 text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t.propertyForm.titleLabel} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                placeholder="e.g., Modern 2BR Apartment in Bole"
              />
            </div>

            {/* Neighborhood */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t.propertyForm.neighborhoodLabel} *
              </label>
              <select
                value={formData.neighborhood || ''}
                onChange={(e) =>
                  setFormData({ ...formData, neighborhood: e.target.value as Neighborhood })
                }
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
              >
                <option value="">Select neighborhood</option>
                <option value="Bole">Bole</option>
                <option value="Kazanchis">Kazanchis</option>
                <option value="CMC">CMC</option>
                <option value="Saris">Saris</option>
                <option value="Yeka">Yeka</option>
              </select>
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t.propertyForm.typeLabel} *
              </label>
              <select
                value={formData.propertyType || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    propertyType: e.target.value as 'apartment' | 'house' | 'studio' | 'villa',
                  })
                }
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
              >
                <option value="">Select type</option>
                <option value="apartment">{t.propertyForm.apartment}</option>
                <option value="house">{t.propertyForm.house}</option>
                <option value="studio">{t.propertyForm.studio}</option>
                <option value="villa">{t.propertyForm.villa}</option>
              </select>
            </div>

            {/* Price, Beds, Baths Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t.propertyForm.priceLabel} *
                </label>
                <input
                  type="number"
                  value={formData.priceEtb || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, priceEtb: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="18000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t.propertyForm.bedsLabel} *
                </label>
                <input
                  type="number"
                  value={formData.beds || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, beds: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="2"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t.propertyForm.bathsLabel} *
                </label>
                <input
                  type="number"
                  value={formData.baths || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, baths: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                  placeholder="1"
                  min="1"
                />
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t.propertyForm.sizeLabel}
              </label>
              <input
                type="number"
                value={formData.sizeSqm || ''}
                onChange={(e) =>
                  setFormData({ ...formData, sizeSqm: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                placeholder="65"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t.propertyForm.descriptionLabel} *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust"
                placeholder="Describe your property, its features, and what makes it special..."
              />
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t.propertyForm.amenitiesLabel}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['parking', 'wifi', 'generator', 'security'].map((amenity) => (
                  <label
                    key={amenity}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.amenities?.includes(amenity)}
                      onChange={() => handleAmenityToggle(amenity)}
                      className="rounded border-sand text-rust focus:ring-rust"
                    />
                    <span className="text-sm text-charcoal">
                      {t.propertyForm[amenity as keyof typeof t.propertyForm]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 border border-sand rounded-lg hover:bg-sand transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                className="bg-rust text-white px-6 py-2 rounded-lg hover:bg-rust-dark transition-colors"
              >
                {t.propertyForm.submit}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
