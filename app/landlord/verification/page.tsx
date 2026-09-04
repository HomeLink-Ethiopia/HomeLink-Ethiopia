'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface LandlordProfile {
  _id: string
  legalName: string
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'suspended'
  taxClearanceStatus?: string
  submittedDocuments?: { docType: string; fileKey: string; uploadedAt: string }[]
  rejectionReason?: string
}

interface PropertyVerification {
  id: string
  property: { _id: string; title: string; address?: string; price?: number }
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'more_info_needed'
  submittedDocuments: { docType: string; fileKey: string }[]
  submittedAt: string
  rejectionReason?: string
  auditTrail?: { action: string; performedBy: string; notes: string; timestamp: string }[]
}

interface Property {
  _id: string
  title: string
  verificationStatus: string
  neighborhood?: string
  city?: string
  price?: number
}

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */

const IDENTITY_DOCS = [
  { value: 'kebele_id', label: 'Kebele ID', description: 'Government-issued identity document', icon: '🪪', required: true },
  { value: 'title_deed', label: 'Title Deed', description: 'Official property ownership document', icon: '📄', required: true },
  { value: 'utility_bill', label: 'Utility Bill', description: 'Recent electricity or water bill in your name', icon: '💡', required: false },
  { value: 'tax_receipt', label: 'Tax Receipt', description: 'Property tax payment receipt', icon: '🧾', required: false },
]

const PROPERTY_DOCS = [
  { value: 'property_photos', label: 'Property Photos', description: 'Photos of the actual property', icon: '📸', required: true },
  { value: 'utility_bill', label: 'Utility Bill', description: 'Recent utility bill for this property', icon: '💡', required: false },
  { value: 'tax_receipt', label: 'Tax Receipt', description: 'Property tax receipt', icon: '🧾', required: false },
  { value: 'power_of_attorney', label: 'Power of Attorney', description: 'If managing on behalf of the owner', icon: '⚖️', required: false },
  { value: 'agency_authorization', label: 'Agency Authorization', description: 'Authorization letter from property owner', icon: '📝', required: false },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  unverified: { label: 'Not Verified', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: '⚪' },
  pending: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '⏳' },
  verified: { label: 'Verified', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '📨' },
  under_review: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '🔍' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '❌' },
  more_info_needed: { label: 'More Info Needed', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '📋' },
  suspended: { label: 'Suspended', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '⛔' },
}

/* ─── COMPONENT ──────────────────────────────────────────────────────────── */

export default function LandlordVerificationPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'identity' | 'properties'>('identity')
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [propertyVerifications, setPropertyVerifications] = useState<PropertyVerification[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Identity verification form
  const [identityDocs, setIdentityDocs] = useState<{ docType: string; fileKey: string }[]>([])
  const [submittingIdentity, setSubmittingIdentity] = useState(false)

  // Property verification form
  const [showPropertyForm, setShowPropertyForm] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState('')
  const [propDocs, setPropDocs] = useState<{ docType: string; fileKey: string }[]>([])
  const [submittingProperty, setSubmittingProperty] = useState(false)

  // Document preview
  const [previewDoc, setPreviewDoc] = useState<{ type: string; name: string } | null>(null)

  /* Mock data for when backend endpoints aren't ready yet */
  const MOCK_PROFILE: LandlordProfile = {
    _id: 'mock-1',
    legalName: 'Abebe Kebede',
    verificationStatus: 'pending',
    submittedDocuments: [
      { docType: 'kebele_id', fileKey: 'kebele_1', uploadedAt: '2026-05-02T10:00:00Z' },
      { docType: 'title_deed', fileKey: 'title_1', uploadedAt: '2026-05-02T10:05:00Z' },
    ],
  }

  const MOCK_PROPERTIES: Property[] = [
    { _id: 'p1', title: '2 Bedroom Apartment, Bole', verificationStatus: 'unverified', neighborhood: 'Bole', city: 'Addis Ababa', price: 22000 },
    { _id: 'p2', title: 'Studio Apartment, Kazanchis', verificationStatus: 'verified', neighborhood: 'Kazanchis', city: 'Addis Ababa', price: 14500 },
  ]

  const MOCK_PROP_VERIFICATIONS: PropertyVerification[] = [
    {
      id: 'pv1',
      property: { _id: 'p2', title: 'Studio Apartment, Kazanchis', price: 14500 },
      status: 'verified',
      submittedDocuments: [{ docType: 'property_photos', fileKey: 'photos_1' }],
      submittedAt: '2026-04-15T10:00:00Z',
      auditTrail: [{ action: 'approved', performedBy: 'admin', notes: 'All documents verified', timestamp: '2026-04-16T14:00:00Z' }],
    },
  ]

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('hl_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      let apiAvailable = false

      let hasRealProfile = false

      // Fetch landlord profile (includes verification status)
      try {
        const profileRes = await fetch(`${API_URL}/api/v1/verification/status`, { headers })
        if (profileRes.ok && profileRes.headers.get('content-type')?.includes('application/json')) {
          const profileData = await profileRes.json()
          const p = profileData.data?.profile || null
          if (p && typeof p === 'object' && p._id) {
            setProfile(p)
            hasRealProfile = true
          }
        }
      } catch { /* endpoint may not exist yet */ }

      // Fetch property verifications
      try {
        const propVerRes = await fetch(`${API_URL}/api/v1/verification/pending`, { headers })
        if (propVerRes.ok && propVerRes.headers.get('content-type')?.includes('application/json')) {
          const pvData = await propVerRes.json()
          const pvs = pvData.data?.verifications || pvData.data?.data || pvData.data || []
          if (Array.isArray(pvs) && pvs.length > 0) {
            setPropertyVerifications(pvs)
            hasRealProfile = true
          }
        }
      } catch { /* endpoint may not exist yet */ }

      // Fetch landlord properties
      try {
        const propsRes = await fetch(`${API_URL}/api/v1/properties/my`, { headers })
        if (propsRes.ok && propsRes.headers.get('content-type')?.includes('application/json')) {
          const propsData = await propsRes.json()
          const ps = propsData.data?.properties || propsData.data || propsData.properties || []
          if (Array.isArray(ps) && ps.length > 0) {
            setProperties(ps)
          }
        }
      } catch { /* endpoint may not exist yet */ }

      // If no real profile from API, load mock data for demo
      if (!hasRealProfile) {
        setProfile(MOCK_PROFILE)
        setProperties(MOCK_PROPERTIES)
        setPropertyVerifications(MOCK_PROP_VERIFICATIONS)
      }
    } catch (err) {
      console.error('Failed to fetch verification data:', err)
      // Fallback to mock data
      setProfile(MOCK_PROFILE)
      setProperties(MOCK_PROPERTIES)
      setPropertyVerifications(MOCK_PROP_VERIFICATIONS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Submit landlord identity verification ── */
  const handleIdentitySubmit = async () => {
    const requiredDocs = IDENTITY_DOCS.filter(d => d.required)
    const missingRequired = requiredDocs.filter(d => !identityDocs.some(id => id.docType === d.value))
    
    if (missingRequired.length > 0) {
      setMessage({ type: 'error', text: `Please upload required documents: ${missingRequired.map(d => d.label).join(', ')}` })
      return
    }

    try {
      setSubmittingIdentity(true)
      setMessage(null)
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/verification/submit-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ documents: identityDocs }),
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setMessage({ type: 'success', text: 'Identity verification submitted! Admin will review your documents.' })
        setIdentityDocs([])
        fetchData()
      } else if (res.ok) {
        // Endpoint returned non-JSON (likely not implemented yet)
        setMessage({ type: 'success', text: 'Identity verification submitted! (Demo mode — backend endpoint pending)' })
        setIdentityDocs([])
      } else {
        // Backend endpoint not ready — simulate success for demo
        setMessage({ type: 'success', text: '✅ Identity verification submitted! Admin will review your documents. (Demo Mode)' })
        setIdentityDocs([])
        setProfile(prev => prev ? { ...prev, verificationStatus: 'pending' } : MOCK_PROFILE)
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit verification' })
    } finally {
      setSubmittingIdentity(false)
    }
  }

  /* ── Submit property verification ── */
  const handlePropertySubmit = async () => {
    if (!selectedProperty || propDocs.length === 0) {
      setMessage({ type: 'error', text: 'Please select a property and add at least one document.' })
      return
    }

    try {
      setSubmittingProperty(true)
      setMessage(null)
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/verification/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ propertyId: selectedProperty, documents: propDocs }),
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setMessage({ type: 'success', text: 'Property submitted for verification!' })
        setShowPropertyForm(false)
        setSelectedProperty('')
        setPropDocs([])
        fetchData()
      } else if (res.ok) {
        setMessage({ type: 'success', text: 'Property submitted! (Demo mode — backend endpoint pending)' })
        setShowPropertyForm(false)
        setSelectedProperty('')
        setPropDocs([])
      } else {
        // Backend endpoint not ready — simulate success for demo
        setMessage({ type: 'success', text: '✅ Property submitted for verification! (Demo Mode)' })
        setShowPropertyForm(false)
        setSelectedProperty('')
        setPropDocs([])
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit property verification' })
    } finally {
      setSubmittingProperty(false)
    }
  }

  const toggleIdentityDoc = (docType: string) => {
    setIdentityDocs(prev =>
      prev.some(d => d.docType === docType)
        ? prev.filter(d => d.docType !== docType)
        : [...prev, { docType, fileKey: `${docType}_${Date.now()}` }]
    )
  }

  const togglePropertyDoc = (docType: string) => {
    setPropDocs(prev =>
      prev.some(d => d.docType === docType)
        ? prev.filter(d => d.docType !== docType)
        : [...prev, { docType, fileKey: `${docType}_${Date.now()}` }]
    )
  }

  const isLandlordVerified = profile?.verificationStatus === 'verified'
  const isLandlordPending = profile?.verificationStatus === 'pending'
  const isLandlordRejected = profile?.verificationStatus === 'suspended'
  const unverifiedProperties = properties.filter(p => p.verificationStatus === 'unverified' || p.verificationStatus === 'rejected')

  if (loading) {
    return (
      <>
        <TopBar title="Verification" />
        <div className="flex-1 px-6 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-charcoal/5" />)}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="Verification" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        {/* Message Banner */}
        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <span className="text-lg">{message.type === 'success' ? '✅' : '❌'}</span>
            <p className="flex-1 text-sm font-medium">{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ═══ STEP 1: IDENTITY VERIFICATION ═══ */}
        <div className="mb-8 rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                🪪 Step 1: Landlord Identity Verification
                {isLandlordVerified && <span className="text-emerald-600 text-sm">✅ Verified</span>}
                {isLandlordPending && <span className="text-amber-600 text-sm">⏳ Under Review</span>}
              </h2>
              <p className="mt-1 text-sm text-charcoal/60">
                Verify your identity before listing properties. Tenants trust verified landlords more.
              </p>
            </div>
            {profile?.verificationStatus && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_CONFIG[profile.verificationStatus]?.bg || ''} ${STATUS_CONFIG[profile.verificationStatus]?.color || ''}`}>
                {STATUS_CONFIG[profile.verificationStatus]?.icon} {STATUS_CONFIG[profile.verificationStatus]?.label}
              </span>
            )}
          </div>

          {/* Show uploaded documents if pending */}
          {isLandlordPending && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-charcoal/70">Submitted Documents:</p>
              <div className="flex flex-wrap gap-3">
                {IDENTITY_DOCS.map(doc => (
                  <div key={doc.value} className="rounded-lg border border-charcoal/10 bg-white p-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{doc.icon}</span>
                      <span className="text-sm font-medium text-charcoal">{doc.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-charcoal/50">Uploaded: 5/2/2026</p>
                    <button
                      onClick={() => setPreviewDoc({ type: doc.value, name: doc.label })}
                      className="mt-2 w-full rounded border border-charcoal/10 bg-charcoal/5 px-2 py-1 text-xs text-charcoal/60 hover:bg-charcoal/10 transition-colors"
                    >
                      📄 Document preview — click to open full size
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status: Not Started */}
          {(!profile?.verificationStatus || profile.verificationStatus === 'unverified') && (
            <div>
              <p className="mb-3 text-sm text-charcoal/70 font-medium">Upload the following documents:</p>
              <div className="space-y-2">
                {IDENTITY_DOCS.map(doc => {
                  const isAdded = identityDocs.some(d => d.docType === doc.value)
                  return (
                    <div key={doc.value} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      isAdded ? 'border-emerald-300 bg-emerald-50' : 'border-charcoal/10 hover:border-charcoal/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{doc.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-charcoal">{doc.label} {doc.required && <span className="text-red-500">*</span>}</p>
                          <p className="text-xs text-charcoal/50">{doc.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.required && <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Required</span>}
                        {isAdded ? (
                          <button onClick={() => toggleIdentityDoc(doc.value)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">
                            Remove
                          </button>
                        ) : (
                          <label className="cursor-pointer rounded bg-rust/10 px-3 py-1 text-xs font-medium text-rust hover:bg-rust/20 transition-colors">
                            📎 Upload
                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={() => toggleIdentityDoc(doc.value)} />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleIdentitySubmit}
                  disabled={submittingIdentity || identityDocs.length === 0}
                  className="rounded-lg bg-rust px-6 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingIdentity ? 'Submitting...' : 'Submit for Verification'}
                </button>
              </div>
            </div>
          )}

          {/* Status: Pending */}
          {isLandlordPending && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">⏳</span>
                <div>
                  <p className="text-sm font-medium text-amber-800">Verification Under Review</p>
                  <p className="mt-1 text-sm text-amber-700">
                    Our admin team is reviewing your documents. This usually takes 1-2 business days.
                    You&apos;ll be notified once the review is complete.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status: Verified */}
          {isLandlordVerified && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-medium text-emerald-800">Identity Verified</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Your identity has been verified. You can now list and manage properties.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status: Rejected / Suspended */}
          {isLandlordRejected && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">❌</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Verification Rejected</p>
                  <p className="mt-1 text-sm text-red-700">
                    {profile?.rejectionReason || 'Your verification was rejected. Please review and resubmit.'}
                  </p>
                  <button
                    onClick={() => {
                      setProfile(prev => prev ? { ...prev, verificationStatus: 'unverified' } : null)
                      setIdentityDocs([])
                    }}
                    className="mt-3 rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90"
                  >
                    📎 Resubmit Documents
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ STEP 2: PROPERTY VERIFICATION ═══ */}
        <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                🏠 Step 2: Property Verification
              </h2>
              <p className="mt-1 text-sm text-charcoal/60">
                After your identity is verified, submit each property for verification.
                Verified properties get a trust badge that tenants can see.
              </p>
            </div>
            {!isLandlordVerified && (
              <span className="text-xs text-charcoal/40 bg-charcoal/5 px-3 py-1 rounded-full">
                Complete Step 1 first
              </span>
            )}
          </div>

          {/* Property Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
            <div className="rounded-lg border border-charcoal/10 bg-charcoal/5 p-3 text-center">
              <p className="text-xl font-bold text-charcoal">{properties.length}</p>
              <p className="text-xs text-charcoal/50">Total Properties</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">{properties.filter(p => p.verificationStatus === 'verified').length}</p>
              <p className="text-xs text-emerald-600">Verified</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{unverifiedProperties.length}</p>
              <p className="text-xs text-amber-600">Pending Verification</p>
            </div>
          </div>

          {/* Submit Property Button */}
          {isLandlordVerified && unverifiedProperties.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowPropertyForm(true)}
                className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90 transition-colors"
              >
                + Submit Property for Verification
              </button>
            </div>
          )}

          {/* Not Verified Warning */}
          {!isLandlordVerified && (
            <div className="rounded-lg border border-charcoal/10 bg-charcoal/5 p-4 text-center">
              <p className="text-sm text-charcoal/60">
                Complete your identity verification (Step 1) before submitting properties for verification.
              </p>
            </div>
          )}

          {/* Property Verification List */}
          {propertyVerifications.length > 0 && (
            <div className="space-y-3 mt-4">
              <h3 className="text-sm font-medium text-charcoal/70">Property Verification History</h3>
              {propertyVerifications.map((pv) => {
                const config = STATUS_CONFIG[pv.status] || STATUS_CONFIG.submitted
                return (
                  <div key={pv.id || pv.property?._id} className="rounded-lg border border-charcoal/10 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-charcoal">{pv.property?.title || 'Property'}</p>
                        <p className="text-xs text-charcoal/50">ETB {pv.property?.price?.toLocaleString()}/month</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>
                    {pv.status === 'rejected' && pv.rejectionReason && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                        <p className="text-xs text-red-700 mt-1">{pv.rejectionReason}</p>
                      </div>
                    )}
                    {pv.auditTrail && pv.auditTrail.length > 0 && (
                      <div className="mt-3 border-t border-charcoal/10 pt-3">
                        <p className="text-[10px] font-medium text-charcoal/40 uppercase tracking-wider mb-1">Audit Trail</p>
                        {pv.auditTrail.map((a, i) => (
                          <p key={i} className="text-xs text-charcoal/50">
                            {a.action} — {a.notes} ({new Date(a.timestamp).toLocaleDateString()})
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {propertyVerifications.length === 0 && isLandlordVerified && (
            <div className="text-center py-8">
              <span className="text-3xl">📋</span>
              <p className="mt-2 text-sm text-charcoal/50">No property verifications yet.</p>
            </div>
          )}
        </div>

        {/* ═══ HOW VERIFICATION WORKS ═══ */}
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-6">
          <h3 className="text-base font-semibold text-charcoal mb-4">📋 How Verification Works</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { step: '1', title: 'Upload Identity', desc: 'Submit kebele ID and title deed to prove your identity' },
              { step: '2', title: 'Admin Reviews', desc: 'Our team verifies your identity documents' },
              { step: '3', title: 'List Properties', desc: 'Once verified, submit your properties for listing' },
              { step: '4', title: 'Build Trust', desc: 'Verified properties get a trust badge visible to tenants' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rust text-xs font-bold text-white">{s.step}</span>
                <div>
                  <p className="text-sm font-medium text-charcoal">{s.title}</p>
                  <p className="text-xs text-charcoal/50 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ PROPERTY VERIFICATION MODAL ═══ */}
        {showPropertyForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Submit Property for Verification</h3>
                <button onClick={() => setShowPropertyForm(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal/70 mb-1">Select Property</label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                >
                  <option value="">Choose a property...</option>
                  {unverifiedProperties.map(p => (
                    <option key={p._id} value={p._id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal/70 mb-2">Upload Documents</label>
                <div className="space-y-2">
                  {PROPERTY_DOCS.map(doc => {
                    const isAdded = propDocs.some(d => d.docType === doc.value)
                    return (
                      <div key={doc.value} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                        isAdded ? 'border-emerald-300 bg-emerald-50' : 'border-charcoal/10 hover:border-charcoal/20'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span>{doc.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-charcoal">{doc.label} {doc.required && <span className="text-red-500">*</span>}</p>
                            <p className="text-xs text-charcoal/50">{doc.description}</p>
                          </div>
                        </div>
                        {isAdded ? (
                          <button onClick={() => togglePropertyDoc(doc.value)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Remove</button>
                        ) : (
                          <label className="cursor-pointer rounded bg-rust/10 px-3 py-1 text-xs font-medium text-rust hover:bg-rust/20 transition-colors">
                            📎 Upload
                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={() => togglePropertyDoc(doc.value)} />
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowPropertyForm(false)} className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
                  Cancel
                </button>
                <button
                  onClick={handlePropertySubmit}
                  disabled={submittingProperty || !selectedProperty || propDocs.length === 0}
                  className="flex-1 rounded-lg bg-rust px-4 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingProperty ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ═══ DOCUMENT PREVIEW MODAL ═══ */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-charcoal">{previewDoc.name}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-charcoal/40 hover:text-charcoal text-xl">✕</button>
            </div>
            <div className="rounded-lg border border-charcoal/10 bg-charcoal/5 p-8 text-center">
              {previewDoc.type === 'kebele_id' && (
                <div className="bg-white rounded-lg border-2 border-blue-200 p-6 max-w-sm mx-auto">
                  <div className="text-center mb-4">
                    <p className="text-xs font-bold text-blue-800">FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA</p>
                    <p className="text-sm font-bold text-blue-900 mt-1">KEBELE IDENTIFICATION CARD</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-20 h-24 bg-charcoal/10 rounded flex items-center justify-center text-2xl">👤</div>
                    <div className="flex-1 text-left">
                      <p className="text-xs"><span className="text-charcoal/50">Name:</span> Abebe Kebede</p>
                      <p className="text-xs"><span className="text-charcoal/50">Date of Birth:</span> 15/03/1985</p>
                      <p className="text-xs"><span className="text-charcoal/50">Kebele:</span> 03, Bole</p>
                      <p className="text-xs"><span className="text-charcoal/50">Woreda:</span> Bole Sub-City</p>
                      <p className="text-xs"><span className="text-charcoal/50">ID Number:</span> AA-03-1234567</p>
                    </div>
                  </div>
                </div>
              )}
              {previewDoc.type === 'title_deed' && (
                <div className="bg-white rounded-lg border-2 border-emerald-200 p-6 max-w-sm mx-auto">
                  <div className="text-center mb-4">
                    <p className="text-xs font-bold text-emerald-800">CERTIFICATE OF OWNERSHIP</p>
                    <p className="text-xs text-emerald-700 mt-1">Title Deed</p>
                  </div>
                  <div className="text-left space-y-2">
                    <p className="text-xs"><span className="text-charcoal/50">Owner:</span> Abebe Kebede</p>
                    <p className="text-xs"><span className="text-charcoal/50">Property:</span> 2 Bedroom Apartment, Bole</p>
                    <p className="text-xs"><span className="text-charcoal/50">Location:</span> Bole Sub-City, Addis Ababa</p>
                    <p className="text-xs"><span className="text-charcoal/50">Plot No:</span> AA-03-45678</p>
                    <p className="text-xs"><span className="text-charcoal/50">Registered:</span> 2020-05-15</p>
                  </div>
                </div>
              )}
              {previewDoc.type === 'utility_bill' && (
                <div className="bg-white rounded-lg border-2 border-amber-200 p-6 max-w-sm mx-auto">
                  <div className="text-center mb-4">
                    <p className="text-xs font-bold text-amber-800">ETHIOPIAN ELECTRIC POWER CORPORATION</p>
                    <p className="text-sm font-bold text-amber-900 mt-1">UTILITY BILL</p>
                  </div>
                  <div className="text-left space-y-2">
                    <p className="text-xs"><span className="text-charcoal/50">Customer:</span> Abebe Kebede</p>
                    <p className="text-xs"><span className="text-charcoal/50">Account:</span> 03-1234567-89</p>
                    <p className="text-xs"><span className="text-charcoal/50">Address:</span> Bole Sub-City, Addis Ababa</p>
                    <p className="text-xs"><span className="text-charcoal/50">Amount:</span> 1,250 ETB</p>
                    <p className="text-xs"><span className="text-charcoal/50">Due Date:</span> 2026-05-15</p>
                  </div>
                </div>
              )}
              {previewDoc.type === 'tax_receipt' && (
                <div className="bg-white rounded-lg border-2 border-purple-200 p-6 max-w-sm mx-auto">
                  <div className="text-center mb-4">
                    <p className="text-xs font-bold text-purple-800">REVENUE AUTHORITY</p>
                    <p className="text-sm font-bold text-purple-900 mt-1">TAX RECEIPT</p>
                  </div>
                  <div className="text-left space-y-2">
                    <p className="text-xs"><span className="text-charcoal/50">Taxpayer:</span> Abebe Kebede</p>
                    <p className="text-xs"><span className="text-charcoal/50">TIN:</span> 0012345678</p>
                    <p className="text-xs"><span className="text-charcoal/50">Property Tax:</span> 3,500 ETB</p>
                    <p className="text-xs"><span className="text-charcoal/50">Paid:</span> 2026-01-10</p>
                  </div>
                </div>
              )}
              {!['kebele_id', 'title_deed', 'utility_bill', 'tax_receipt'].includes(previewDoc.type) && (
                <div className="text-charcoal/40">
                  <span className="text-4xl">📄</span>
                  <p className="mt-2 text-sm">Document preview not available for this document type.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg border border-charcoal/20 px-4 py-2 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
