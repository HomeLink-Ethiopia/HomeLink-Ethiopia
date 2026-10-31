'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/landlord/TopBar'
import RentEstimateGauge from '@/components/property/RentEstimateGauge'
import BuildingFloorManager from '@/components/landlord/BuildingFloorManager'
import type { BuildingDetails } from '@/lib/properties'
import { fetchRentEstimate } from '@/services/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const RESIDENTIAL_AMENITIES = [
  'Parking', 'WiFi', 'Generator', 'Security Guard', 'CCTV',
  'Water Tank', 'Elevator', 'Furnished', 'Air Conditioning', 'Balcony',
  'Garden', 'Gym', 'Swimming Pool', 'Pet Friendly', 'Laundry'
]

const BUILDING_FACILITIES = [
  'Elevator', 'Backup Generator', '3-Phase Electric Power', 'Underground Parking',
  '24/7 Security Guard', 'CCTV Surveillance', 'Water Reservoir Tank',
  'Fiber Optic Internet', 'Fire Suppression System', 'Emergency Exits',
  'Reception Lobby', 'Accessible Ramps'
]

const NEIGHBORHOODS = [
  'Bole', 'Kazanchis', 'CMC', 'Saris', 'Yeka', 'Piassa',
  'Merkato', 'Arat Kilo', 'Mekanissa', 'Kality', 'Old Airport',
  'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle', 'Adama',
  'Jimma', 'Gondar', 'Dessie', 'Harar', 'Axum'
]

const CITIES = ['Addis Ababa', 'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle', 'Adama', 'Jimma', 'Gondar']

interface ImagePreview {
  file: File
  preview: string
  isPrimary: boolean
}

export default function NewPropertyPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [images, setImages] = useState<ImagePreview[]>([])

  // Category choice: 'residential' vs 'building'
  const [propertyCategory, setPropertyCategory] = useState<'residential' | 'building'>('residential')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    propertyType: 'apartment',
    rentAmount: '',
    depositAmount: '',
    bedrooms: '',
    bathrooms: '1',
    sizeM2: '',
    city: 'Addis Ababa',
    subCity: 'Bole',
    address: '',
    furnished: false,
    amenities: [] as string[],
    availableFrom: '',
  })

  const [rentEstimate, setRentEstimate] = useState<{ low: number; fair: number; high: number } | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [buildingDetails, setBuildingDetails] = useState<BuildingDetails | null>(null)

  const isBuilding = propertyCategory === 'building'

  // When switching category, adjust propertyType
  const handleCategoryChange = (category: 'residential' | 'building') => {
    setPropertyCategory(category)
    if (category === 'building') {
      setFormData(prev => ({
        ...prev,
        propertyType: 'building',
        title: prev.title || 'Bole Commercial Business Tower',
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        propertyType: 'apartment',
      }))
    }
    setErrors([])
  }

  // Auto-estimate rent via XGBoost for residential properties
  useEffect(() => {
    if (isBuilding) return // AI rent estimation is for residential units

    const subCity = formData.subCity
    const bedrooms = Number(formData.bedrooms)
    const bathrooms = Number(formData.bathrooms) || 1
    const sizeM2 = Number(formData.sizeM2) || 0

    if (subCity && bedrooms > 0) {
      if (sizeM2 <= 0) {
        setRentEstimate(null)
        setEstimating(false)
        return
      }

      const timer = setTimeout(async () => {
        setEstimating(true)
        try {
          const res = await fetchRentEstimate({
            subCity,
            bedrooms,
            bathrooms,
            sizeM2,
            is_furnished: formData.furnished,
            has_water_tank: formData.amenities.some(a => a.toLowerCase().includes('water')),
            has_generator: formData.amenities.some(a => a.toLowerCase().includes('generator')),
            amenities: formData.amenities,
          })
          setRentEstimate({ low: res.low, fair: res.fair, high: res.high })
        } catch (error) {
          console.error("AI Estimation failed - ensure Python FastAPI is running on port 8000:", error)
          setRentEstimate(null)
        } finally {
          setEstimating(false)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isBuilding, formData.subCity, formData.bedrooms, formData.bathrooms, formData.sizeM2, formData.furnished, formData.amenities])

  // Image handling
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > 10) {
      setErrors(['Maximum 10 photos allowed for the property exterior / facade'])
      return
    }

    const newImages: ImagePreview[] = []
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors([`"${file.name}" is too large. Maximum 5MB per image.`])
        return
      }
      if (!file.type.startsWith('image/')) {
        setErrors([`"${file.name}" is not an image file.`])
        return
      }
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        isPrimary: images.length === 0 && newImages.length === 0,
      })
    }
    setImages(prev => [...prev, ...newImages])
    setErrors([])
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = prev.filter((_, i) => i !== index)
      if (prev[index].isPrimary && updated.length > 0) {
        updated[0].isPrimary = true
      }
      return updated
    })
  }

  const setPrimaryImage = (index: number) => {
    setImages(prev => prev.map((img, i) => ({ ...img, isPrimary: i === index })))
  }

  const uploadImages = async (propertyId: string): Promise<boolean> => {
    if (images.length === 0) return true

    const token = localStorage.getItem('hl_token')
    for (let i = 0; i < images.length; i++) {
      const formDataImg = new FormData()
      formDataImg.append('image', images[i].file)
      formDataImg.append('isPrimary', images[i].isPrimary ? 'true' : 'false')
      formDataImg.append('order', String(i))

      try {
        const res = await fetch(`${API_URL}/api/v1/properties/${propertyId}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formDataImg,
        })
        if (!res.ok) {
          console.error(`Failed to upload image ${i + 1}`)
        }
      } catch {
        console.error(`Network error uploading image ${i + 1}`)
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const effectiveUnits = buildingDetails?.units || []
    const effectiveBedrooms = isBuilding
      ? (effectiveUnits.length > 0 ? effectiveUnits.length : 1)
      : Number(formData.bedrooms)

    const effectiveRent = isBuilding
      ? (effectiveUnits.length > 0
          ? Math.min(...effectiveUnits.map(u => u.monthlyRent || 0).filter(Boolean)) || 20000
          : 20000)
      : Number(formData.rentAmount)

    const effectiveDeposit = isBuilding
      ? effectiveRent * 2
      : (formData.depositAmount ? Number(formData.depositAmount) : effectiveRent * 2)

    const newErrors: string[] = []
    if (!formData.title.trim()) {
      newErrors.push(isBuilding ? 'Building Name is required' : 'Property Title is required')
    }
    if (!formData.subCity) newErrors.push('Neighborhood / Sub City is required')
    if (!isBuilding && (!effectiveRent || effectiveRent <= 0)) newErrors.push('Rent amount is required')
    if (!isBuilding && (!effectiveBedrooms || effectiveBedrooms <= 0)) newErrors.push('Number of bedrooms is required')
    if (images.length === 0) {
      newErrors.push(isBuilding ? 'At least one building exterior / facade photo is required' : 'At least one property photo is required')
    }
    if (isBuilding && effectiveUnits.length === 0) {
      newErrors.push('Please configure at least 1 room or office space in your building structure')
    }

    if (newErrors.length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('hl_token')

      const totalBuildingSqm = isBuilding && effectiveUnits.length > 0
        ? effectiveUnits.reduce((acc, u) => acc + (u.sizeM2 || 0), 0)
        : Number(formData.sizeM2) || 0

      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        propertyType: isBuilding ? 'building' : formData.propertyType,
        rentAmount: effectiveRent,
        depositAmount: effectiveDeposit,
        bedrooms: effectiveBedrooms,
        bathrooms: isBuilding ? 1 : (formData.bathrooms ? Number(formData.bathrooms) : 1),
        sizeM2: totalBuildingSqm > 0 ? totalBuildingSqm : undefined,
        location: {
          subCity: formData.subCity,
          address: formData.address.trim() || undefined,
          city: formData.city,
        },
        furnished: isBuilding ? false : formData.furnished,
        amenities: formData.amenities,
        availableFrom: formData.availableFrom || undefined,
        listingStatus: 'active',
      }

      if (isBuilding && buildingDetails && buildingDetails.units && buildingDetails.units.length > 0) {
        payload.buildingDetails = {
          isMultiUnit: true,
          rentalScope: buildingDetails.rentalScope || 'flexible',
          totalFloors: buildingDetails.totalFloors || 1,
          totalUnits: buildingDetails.units.length,
          units: buildingDetails.units.map((u, i) => ({
            ...u,
            unitId: u.id || `unit-${i + 1}`,
            rentAmount: u.monthlyRent ?? (u as any).rentAmount ?? 0,
            monthlyRent: u.monthlyRent ?? (u as any).rentAmount ?? 0,
            depositAmount: u.depositAmount ?? ((u.monthlyRent || 0) * 2),
            status: u.status || 'available',
            image: u.image || undefined,
          })),
        }
      }

      const res = await fetch(`${API_URL}/api/v1/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      let propertyId = ''
      try {
        if (res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json()
          if (!res.ok) {
            setErrors([data.message || 'Failed to create property'])
            return
          }
          propertyId = data.data?._id || data._id || ''
        }
      } catch (e) {
        if (!res.ok) {
          setErrors(['Failed to create property: Server returned an error'])
          return
        }
      }

      if (!res.ok) {
        setErrors(['Failed to create property'])
        return
      }

      // Upload main photos
      if (propertyId) {
        await uploadImages(propertyId)
      }

      setSuccess(true)
      setTimeout(() => router.push(isBuilding ? '/buildings' : '/landlord/properties'), 2000)
    } catch (err) {
      console.error('Create property error:', err)
      setErrors(['An unexpected error occurred while creating the property.'])
    } finally {
      setSubmitting(false)
    }
  }

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }))
  }

  if (success) {
    return (
      <>
        <TopBar
          title={isBuilding ? "Commercial Building Registered" : "Property Created"}
          subtitle="Your listing is now live on HomeLink"
        />
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-charcoal">
              {isBuilding ? "Building & Rooms Successfully Listed!" : "Property Listed Successfully!"}
            </h2>
            <p className="text-sm text-charcoal/60 mt-2">
              {isBuilding
                ? "Your commercial building is live in the dedicated Commercial Buildings directory."
                : "Your residential property has been listed for tenants."}
            </p>
            <p className="text-xs text-rust font-semibold mt-4">Redirecting...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar
        title="Add New Listing"
        subtitle="List a residential home or commercial multi-floor building"
      />

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* ═══ STEP 0: CHOOSE LISTING TYPE (LIKE SIGNUP) ═══ */}
          <div className="rounded-2xl border-2 border-rust/30 bg-white p-6 sm:p-8 shadow-sm">
            <div className="text-center max-w-lg mx-auto mb-6">
              <span className="inline-block rounded-full bg-rust-tint px-3 py-1 text-xs font-bold uppercase tracking-wider text-rust mb-2">
                Listing Type
              </span>
              <h2 className="font-display text-2xl font-bold text-charcoal">
                What type of property are you listing?
              </h2>
              <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
                Select your property type below so the form adapts directly to your requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Residential Home */}
              <button
                type="button"
                onClick={() => handleCategoryChange('residential')}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  propertyCategory === 'residential'
                    ? 'border-rust bg-rust-tint/25 ring-2 ring-rust/30 shadow-md'
                    : 'border-charcoal/15 bg-white hover:border-rust/40 hover:bg-sand/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-sand/40 border border-charcoal/10 text-rust">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </div>
                    {propertyCategory === 'residential' && (
                      <span className="rounded-full bg-rust text-white text-[11px] font-bold px-2.5 py-0.5">
                        Selected ✓
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-charcoal mt-3">
                    Residential Home / Apartment
                  </h3>
                  <p className="text-xs text-charcoal/70 mt-1 leading-relaxed">
                    A single apartment, villa, condo, or studio leased to one tenant or household.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-charcoal/10 flex items-center text-xs font-semibold text-rust">
                  <span>Standard Residential Form →</span>
                </div>
              </button>

              {/* Option 2: Commercial Multi-Floor Building */}
              <button
                type="button"
                onClick={() => handleCategoryChange('building')}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  propertyCategory === 'building'
                    ? 'border-rust bg-rust-tint/25 ring-2 ring-rust/30 shadow-md'
                    : 'border-charcoal/15 bg-white hover:border-rust/40 hover:bg-sand/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-sand/40 border border-charcoal/10 text-rust">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {propertyCategory === 'building' && (
                      <span className="rounded-full bg-rust text-white text-[11px] font-bold px-2.5 py-0.5">
                        Selected ✓
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-charcoal mt-3">
                    Commercial Building / Business Center
                  </h3>
                  <p className="text-xs text-charcoal/70 mt-1 leading-relaxed">
                    A multi-floor building with multiple floors, offices, retail shops, or clinic rooms to rent.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-charcoal/10 flex items-center text-xs font-semibold text-rust">
                  <span>Multi-Floor & Room Configurator →</span>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Errors */}
            {errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">Please fix the following:</p>
                {errors.map((error, i) => (
                  <p key={i} className="text-xs sm:text-sm text-red-700">• {error}</p>
                ))}
              </div>
            )}

            {/* ═══ 1. PHOTOS (FACADE / EXTERIOR) ═══ */}
            <div className="rounded-2xl border border-charcoal/15 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-charcoal">
                  {isBuilding ? "1. Building Facade & Exterior Photos" : "1. Property Photos"}
                </h2>
                <span className="text-xs text-charcoal/50">{images.length}/10 photos</span>
              </div>
              <p className="text-xs text-charcoal/60 mb-4">
                {isBuilding
                  ? "Upload photos of the building entrance, facade, parking, and common lobby. You can attach individual room photos in the room section below."
                  : "Add up to 10 photos of your home. The first photo will be the main cover image."}
              </p>

              {/* Image Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 mb-4">
                  {images.map((img, index) => (
                    <div
                      key={index}
                      className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
                        img.isPrimary ? 'border-rust ring-2 ring-rust/20' : 'border-charcoal/10'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-charcoal/5">
                        <img src={img.preview} alt={`Property ${index + 1}`} className="w-full h-full object-cover" />
                      </div>

                      {img.isPrimary && (
                        <div className="absolute top-1.5 left-1.5 bg-rust text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                          MAIN COVER
                        </div>
                      )}

                      <div className="absolute top-1.5 right-1.5 flex gap-1">
                        {!img.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(index)}
                            className="w-6 h-6 rounded bg-white/90 hover:bg-white text-xs flex items-center justify-center shadow-xs cursor-pointer"
                            title="Set as main photo"
                          >
                            ★
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="w-6 h-6 rounded bg-red-500/90 hover:bg-red-500 text-white text-xs flex items-center justify-center shadow-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-charcoal/20 rounded-xl p-6 text-center hover:border-rust hover:bg-rust-tint/10 transition-colors cursor-pointer"
              >
                <div className="flex justify-center mb-2 text-charcoal/40">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-charcoal">
                  {images.length === 0
                    ? (isBuilding ? 'Click to upload building exterior photos' : 'Click to upload property photos')
                    : `Add more photos (${images.length}/10)`}
                </p>
                <p className="text-xs text-charcoal/50 mt-1">PNG, JPG, WebP — Up to 5MB each</p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* ═══ 2. BASIC BUILDING OR HOME INFORMATION ═══ */}
            <div className="rounded-2xl border border-charcoal/15 bg-white p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-charcoal">
                {isBuilding ? "2. Building Profile & Location" : "2. Basic Information"}
              </h2>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                  {isBuilding ? "Building Name *" : "Property Title *"}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  placeholder={isBuilding ? "e.g., Bole Medhanialem Commercial Center" : "e.g., Luxury 3-Bedroom Villa in CMC"}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                    City *
                  </label>
                  <select
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  >
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                    Neighborhood / Sub City *
                  </label>
                  <select
                    value={formData.subCity}
                    onChange={e => setFormData({ ...formData, subCity: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  >
                    <option value="">Select neighborhood</option>
                    {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                  Street Address / Landmark
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  placeholder="e.g., Behind Edna Mall, Bole Road"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  placeholder={
                    isBuilding
                      ? "Describe the building: prime location, road access, anchor tenants, security, and parking facilities..."
                      : "Describe the home, room layouts, natural lighting, quiet neighborhood, and compound..."
                  }
                />
              </div>
            </div>

            {/* ═══ 3. CONDITIONAL: BUILDING FLOORS & ROOMS CONFIGURATOR ═══ */}
            {isBuilding ? (
              <div className="space-y-4">
                <BuildingFloorManager
                  initialDetails={buildingDetails || undefined}
                  onChange={(details) => {
                    setBuildingDetails(details)
                    if (details.units.length > 0) {
                      const minRent = Math.min(...details.units.map(u => u.monthlyRent || 0).filter(Boolean))
                      const totalSqm = details.units.reduce((acc, u) => acc + (u.sizeM2 || 0), 0)
                      setFormData(prev => ({
                        ...prev,
                        bedrooms: String(details.units.length),
                        sizeM2: totalSqm > 0 ? String(totalSqm) : prev.sizeM2,
                        rentAmount: minRent > 0 && isFinite(minRent) ? String(minRent) : prev.rentAmount,
                        depositAmount: minRent > 0 && isFinite(minRent) ? String(minRent * 2) : prev.depositAmount,
                      }))
                    }
                  }}
                  baseRent={Number(formData.rentAmount) || 18000}
                />
              </div>
            ) : (
              /* ═══ RESIDENTIAL SPECS & PRICING ═══ */
              <div className="rounded-2xl border border-charcoal/15 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-charcoal">3. Residential Specifications & Rent</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                      Property Type *
                    </label>
                    <select
                      value={formData.propertyType}
                      onChange={e => setFormData({ ...formData, propertyType: e.target.value })}
                      className="w-full rounded-xl border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none"
                    >
                      <option value="apartment">Apartment</option>
                      <option value="house">House</option>
                      <option value="villa">Villa</option>
                      <option value="studio">Studio</option>
                      <option value="room">Private Room</option>
                      <option value="compound">Compound</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                      Rent (ETB/mo) *
                    </label>
                    <input
                      type="number"
                      value={formData.rentAmount}
                      onChange={e => setFormData({ ...formData, rentAmount: e.target.value })}
                      className="w-full rounded-xl border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none"
                      placeholder="18000"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                      Bedrooms *
                    </label>
                    <input
                      type="number"
                      value={formData.bedrooms}
                      onChange={e => setFormData({ ...formData, bedrooms: e.target.value })}
                      className="w-full rounded-xl border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none"
                      placeholder="2"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                      Bathrooms
                    </label>
                    <input
                      type="number"
                      value={formData.bathrooms}
                      onChange={e => setFormData({ ...formData, bathrooms: e.target.value })}
                      className="w-full rounded-xl border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none"
                      placeholder="1"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                      Size (m²)
                    </label>
                    <input
                      type="number"
                      value={formData.sizeM2}
                      onChange={e => setFormData({ ...formData, sizeM2: e.target.value })}
                      className="w-full rounded-xl border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none"
                      placeholder="85"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-1.5">
                      Deposit (ETB)
                    </label>
                    <input
                      type="number"
                      value={formData.depositAmount}
                      onChange={e => setFormData({ ...formData, depositAmount: e.target.value })}
                      className="w-full rounded-xl border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none"
                      placeholder="36000"
                      min="0"
                    />
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.furnished}
                        onChange={e => setFormData({ ...formData, furnished: e.target.checked })}
                        className="h-4 w-4 rounded border-charcoal/20 text-rust focus:ring-rust"
                      />
                      <span className="text-sm font-semibold text-charcoal">Furnished Property</span>
                    </label>
                  </div>
                </div>

                {/* AI Fair Rent Estimate */}
                <div className="mt-4 rounded-xl border border-rust/20 bg-cream/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-charcoal">AI Fair Market Rent Guidance (XGBoost)</span>
                    </div>
                    {estimating && <span className="text-[11px] text-charcoal/50">Estimating...</span>}
                  </div>
                  {!formData.sizeM2 || Number(formData.sizeM2) <= 0 ? (
                    <p className="text-xs text-charcoal/60">Enter property size (m²) to generate AI rent guidance.</p>
                  ) : rentEstimate ? (
                    <>
                      <RentEstimateGauge estimate={rentEstimate} />
                      <div className="mt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, rentAmount: String(rentEstimate.fair) }))}
                          className="text-xs font-bold text-rust hover:underline cursor-pointer"
                        >
                          Apply AI Fair Rent ({rentEstimate.fair.toLocaleString()} ETB) →
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-charcoal/50">Fill in neighborhood and bedroom count to calculate.</p>
                  )}
                </div>
              </div>
            )}

            {/* ═══ 4. AMENITIES / BUILDING FACILITIES ═══ */}
            <div className="rounded-2xl border border-charcoal/15 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-charcoal mb-1">
                {isBuilding ? "4. Building Facilities & Infrastructure" : "4. Property Amenities"}
              </h2>
              <p className="text-xs text-charcoal/60 mb-4">
                {isBuilding
                  ? "Select key commercial infrastructure available to tenants in this building."
                  : "Select amenities included with this home."}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {(isBuilding ? BUILDING_FACILITIES : RESIDENTIAL_AMENITIES).map(amenity => {
                  const isChecked = formData.amenities.includes(amenity)
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => handleAmenityToggle(amenity)}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-semibold transition-all cursor-pointer ${
                        isChecked
                          ? 'border-rust bg-rust-tint/25 text-rust'
                          : 'border-charcoal/15 bg-white hover:border-rust/40 text-charcoal/70'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        isChecked ? 'bg-rust border-rust text-white' : 'border-charcoal/30'
                      }`}>
                        {isChecked && '✓'}
                      </span>
                      <span>{amenity}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ═══ 5. SUBMIT ═══ */}
            <div className="flex gap-4 pt-4 pb-12">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-xl border border-charcoal/20 px-6 py-3.5 text-sm font-bold text-charcoal hover:bg-sand/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-rust px-6 py-3.5 text-sm font-bold text-white hover:bg-rust-dark disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Publishing...
                  </span>
                ) : (
                  isBuilding ? 'Publish Commercial Building' : 'Publish Residential Property'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
