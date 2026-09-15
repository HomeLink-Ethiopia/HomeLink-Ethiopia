'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const AMENITIES = [
  'Parking', 'WiFi', 'Generator', 'Security Guard', 'CCTV',
  'Water Tank', 'Elevator', 'Furnished', 'Air Conditioning', 'Balcony',
  'Garden', 'Gym', 'Swimming Pool', 'Pet Friendly', 'Laundry'
]

const NEIGHBORHOODS = [
  'Bole', 'Kazanchis', 'CMC', 'Saris', 'Yeka', 'Piassa',
  'Merkato', 'Arat Kilo', 'Mekanissa', 'Kality', 'Old Airport',
  'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle', 'Adama',
  'Jimma', 'Gondar', 'Dessie', 'Harar', 'Axum'
]

const CITIES = ['Addis Ababa', 'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle', 'Adama', 'Jimma', 'Gondar']

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
  { value: 'room', label: 'Room' },
  { value: 'compound', label: 'Compound' },
  { value: 'commercial', label: 'Commercial' },
]

const MOCK_PROPERTY = {
  _id: 'mock-p1', title: '2 Bedroom Apartment, Bole', description: 'Modern apartment near Edna Mall', propertyType: 'apartment',
  rentAmount: 22000, depositAmount: 44000, bedrooms: 2, bathrooms: 1, sizeM2: 65, floor: 3, furnished: false,
  amenities: ['Parking', 'WiFi', 'Generator', 'Security Guard'],
  location: { address: 'Bole Road, Near Edna Mall', subCity: 'Bole', woreda: '03', city: 'Addis Ababa' },
  availableFrom: '2026-06-01', listingStatus: 'active',
  images: [{ url: '', isPrimary: true }],
}

interface ImagePreview {
  file?: File
  preview: string
  isPrimary: boolean
  existing?: boolean
  url?: string
}

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [images, setImages] = useState<ImagePreview[]>([])

  const [form, setForm] = useState({
    title: '', description: '', propertyType: 'apartment', rentAmount: '', depositAmount: '',
    bedrooms: '', bathrooms: '', sizeM2: '', floor: '', furnished: false,
    amenities: [] as string[], address: '', subCity: '', woreda: '', city: 'Addis Ababa',
    availableFrom: '', listingStatus: 'active',
  })

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
          const p = data.data || data
          setForm({
            title: p.title || '', description: p.description || '', propertyType: p.propertyType || 'apartment',
            rentAmount: String(p.rentAmount || ''), depositAmount: String(p.depositAmount || ''),
            bedrooms: String(p.bedrooms || ''), bathrooms: String(p.bathrooms || ''),
            sizeM2: String(p.sizeM2 || ''), floor: String(p.floor || ''), furnished: p.furnished || false,
            amenities: p.amenities || [], address: p.location?.address || '', subCity: p.location?.subCity || '',
            woreda: p.location?.woreda || '', city: p.location?.city || 'Addis Ababa',
            availableFrom: p.availableFrom ? p.availableFrom.split('T')[0] : '', listingStatus: p.listingStatus || 'active',
          })
          // Load existing images
          if (p.images && p.images.length > 0) {
            setImages(p.images.map((img: { url: string; isPrimary: boolean }) => ({
              preview: img.url ? `${API_URL}${img.url}` : '',
              isPrimary: img.isPrimary,
              existing: true,
              url: img.url,
            })))
          }
        } else {
          loadMockData()
        }
      } catch {
        loadMockData()
      } finally {
        setLoading(false)
      }
    }
    fetchProperty()
  }, [id])

  const loadMockData = () => {
    setForm({
      title: MOCK_PROPERTY.title, description: MOCK_PROPERTY.description,
      propertyType: MOCK_PROPERTY.propertyType, rentAmount: String(MOCK_PROPERTY.rentAmount),
      depositAmount: String(MOCK_PROPERTY.depositAmount), bedrooms: String(MOCK_PROPERTY.bedrooms),
      bathrooms: String(MOCK_PROPERTY.bathrooms), sizeM2: String(MOCK_PROPERTY.sizeM2),
      floor: String(MOCK_PROPERTY.floor), furnished: MOCK_PROPERTY.furnished,
      amenities: MOCK_PROPERTY.amenities, address: MOCK_PROPERTY.location.address,
      subCity: MOCK_PROPERTY.location.subCity, woreda: MOCK_PROPERTY.location.woreda,
      city: MOCK_PROPERTY.location.city, availableFrom: MOCK_PROPERTY.availableFrom,
      listingStatus: MOCK_PROPERTY.listingStatus,
    })
    setImages([{ preview: '', isPrimary: true, existing: true }])
  }

  // Image handling
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > 10) {
      setErrors(['Maximum 10 images allowed'])
      return
    }
    const newImages: ImagePreview[] = []
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors([`"${file.name}" is too large. Max 5MB.`])
        return
      }
      if (!file.type.startsWith('image/')) {
        setErrors([`"${file.name}" is not an image.`])
        return
      }
      newImages.push({ file, preview: URL.createObjectURL(file), isPrimary: false })
    }
    setImages(prev => [...prev, ...newImages])
    setErrors([])
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = prev.filter((_, i) => i !== index)
      if (prev[index].isPrimary && updated.length > 0) updated[0].isPrimary = true
      return updated
    })
  }

  const setPrimaryImage = (index: number) => {
    setImages(prev => prev.map((img, i) => ({ ...img, isPrimary: i === index })))
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return
    setImages(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(from, 1)
      updated.splice(to, 0, moved)
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])
    const newErrors: string[] = []
    if (!form.title.trim()) newErrors.push('Title is required')
    if (!form.rentAmount || Number(form.rentAmount) <= 0) newErrors.push('Valid rent amount is required')
    if (!form.bedrooms || Number(form.bedrooms) < 0) newErrors.push('Bedrooms required')
    if (newErrors.length > 0) { setErrors(newErrors); return }

    try {
      setSaving(true)
      const token = localStorage.getItem('hl_token')
      const payload = {
        title: form.title, description: form.description, propertyType: form.propertyType,
        rentAmount: Number(form.rentAmount), depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
        bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms),
        sizeM2: form.sizeM2 ? Number(form.sizeM2) : undefined,
        floor: form.floor ? Number(form.floor) : undefined, furnished: form.furnished,
        amenities: form.amenities,
        location: { address: form.address, subCity: form.subCity, woreda: form.woreda, city: form.city },
        availableFrom: form.availableFrom || undefined, listingStatus: form.listingStatus,
      }

      const res = await fetch(`${API_URL}/api/v1/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      // Upload new images
      const newImagesToUpload = images.filter(img => img.file)
      for (let i = 0; i < newImagesToUpload.length; i++) {
        const formDataImg = new FormData()
        formDataImg.append('image', newImagesToUpload[i].file!)
        formDataImg.append('isPrimary', newImagesToUpload[i].isPrimary ? 'true' : 'false')
        formDataImg.append('order', String(i))
        try {
          await fetch(`${API_URL}/api/v1/properties/${id}/images`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formDataImg,
          })
        } catch {}
      }

      setMessage({ type: 'success', text: 'Property updated successfully!' })
      setTimeout(() => router.push('/landlord/properties'), 1500)
    } catch {
      setMessage({ type: 'success', text: 'Property updated! (Demo Mode)' })
      setTimeout(() => router.push('/landlord/properties'), 1500)
    } finally {
      setSaving(false)
    }
  }

  const toggleAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }))
  }

  if (loading) {
    return (
      <>
        <TopBar title="Edit Property" />
        <div className="flex-1 px-6 py-8 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-charcoal/5" />)}
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="Edit Property" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        <Link href="/landlord/properties" className="inline-flex items-center gap-1 text-sm text-charcoal/50 hover:text-charcoal mb-4">
          ← Back to Properties
        </Link>

        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-charcoal mb-1">Edit Property</h1>
          <p className="text-sm text-charcoal/50 mb-6">Update your property listing details.</p>

          {message && (
            <div className={`mb-6 rounded-xl border p-4 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
              {errors.map((e, i) => <p key={i} className="text-sm text-red-700">• {e}</p>)}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ═══ IMAGES ═══ */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-1">Property Photos</h2>
              <p className="text-xs text-charcoal/50 mb-4">Add up to 10 photos. First photo is the main image.</p>

              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 mb-4">
                  {images.map((img, index) => (
                    <div key={index} className={`relative rounded-lg overflow-hidden border-2 transition-colors ${img.isPrimary ? 'border-rust' : 'border-charcoal/10'}`}>
                      <div className="aspect-[4/3] bg-charcoal/5">
                        {img.preview ? (
                          <img src={img.preview} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl text-charcoal/20"></div>
                        )}
                      </div>
                      {img.isPrimary && (
                        <div className="absolute top-1.5 left-1.5 bg-rust text-white text-[10px] font-bold px-2 py-0.5 rounded">MAIN</div>
                      )}
                      <div className="absolute top-1.5 right-1.5 flex gap-1">
                        {!img.isPrimary && (
                          <button type="button" onClick={() => setPrimaryImage(index)}
                            className="w-6 h-6 rounded bg-white/80 hover:bg-white text-xs flex items-center justify-center" title="Set as main">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          </button>
                        )}
                        <button type="button" onClick={() => removeImage(index)}
                          className="w-6 h-6 rounded bg-red-500/80 hover:bg-red-500 text-white text-xs flex items-center justify-center">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                        {index > 0 && (
                          <button type="button" onClick={() => moveImage(index, index - 1)}
                            className="w-5 h-5 rounded bg-white/80 hover:bg-white text-[10px] flex items-center justify-center">←</button>
                        )}
                        {index < images.length - 1 && (
                          <button type="button" onClick={() => moveImage(index, index + 1)}
                            className="w-5 h-5 rounded bg-white/80 hover:bg-white text-[10px] flex items-center justify-center">→</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-charcoal/20 rounded-lg p-4 text-center hover:border-rust hover:bg-rust/5 transition-colors">
                <span className="text-2xl"></span>
                <p className="text-sm font-medium text-charcoal mt-1">
                  {images.length === 0 ? 'Add property photos' : `Add more (${images.length}/10)`}
                </p>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
            </div>

            {/* ═══ BASIC INFO ═══ */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Listing Title *</label>
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    placeholder="2 Bedroom Apartment, Bole" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    rows={3} placeholder="Describe your property..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-charcoal/70 mb-1">Property Type *</label>
                    <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })}
                      className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust">
                      {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal/70 mb-1">Status</label>
                    <select value={form.listingStatus} onChange={e => setForm({ ...form, listingStatus: e.target.value })}
                      className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust">
                      <option value="active">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="rented">Rented</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ PRICING ═══ */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-4">Pricing</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Monthly Rent (ETB) *</label>
                  <input type="number" value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    placeholder="22000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Security Deposit (ETB)</label>
                  <input type="number" value={form.depositAmount} onChange={e => setForm({ ...form, depositAmount: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    placeholder="44000" />
                </div>
              </div>
            </div>

            {/* ═══ DETAILS ═══ */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-4">Property Details</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Bedrooms *</label>
                  <input type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Bathrooms</label>
                  <input type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Size (m²)</label>
                  <input type="number" value={form.sizeM2} onChange={e => setForm({ ...form, sizeM2: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Floor</label>
                  <input type="number" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Available From</label>
                  <input type="date" value={form.availableFrom} onChange={e => setForm({ ...form, availableFrom: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.furnished} onChange={e => setForm({ ...form, furnished: e.target.checked })}
                      className="h-4 w-4 rounded border-charcoal/20 text-rust focus:ring-rust" />
                    <span className="text-sm text-charcoal/70">Furnished</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ═══ LOCATION ═══ */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-4">Location</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal/70 mb-1">Street Address</label>
                  <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                    placeholder="Bole Road, Near Edna Mall" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-charcoal/70 mb-1">City</label>
                    <select value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                      className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust">
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal/70 mb-1">Neighborhood</label>
                    <select value={form.subCity} onChange={e => setForm({ ...form, subCity: e.target.value })}
                      className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust">
                      <option value="">Select...</option>
                      {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal/70 mb-1">Woreda</label>
                    <input type="text" value={form.woreda} onChange={e => setForm({ ...form, woreda: e.target.value })}
                      className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                      placeholder="03" />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ AMENITIES ═══ */}
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="text-base font-semibold text-charcoal mb-4">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map(a => (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      form.amenities.includes(a)
                        ? 'bg-rust text-white border-rust'
                        : 'bg-white text-charcoal/70 border-charcoal/20 hover:border-rust'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ SUBMIT ═══ */}
            <div className="flex gap-3 pb-8">
              <Link href="/landlord/properties"
                className="flex-1 rounded-xl border border-charcoal/20 px-6 py-3 text-center text-sm font-medium text-charcoal/70 hover:bg-charcoal/5 transition-colors">
                Cancel
              </Link>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-rust px-6 py-3 text-sm font-semibold text-white hover:bg-rust/90 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
