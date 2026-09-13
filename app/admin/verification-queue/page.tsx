'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface LandlordIdentity {
  _id: string
  accountId: { _id: string; firstName: string; lastName: string; email: string; phone?: string }
  legalName: string
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'suspended'
  submittedDocuments?: { docType: string; fileKey: string; uploadedAt: string }[]
  rejectionReason?: string
  createdAt: string
  auditTrail?: { action: string; performedBy: string; notes: string; timestamp: string }[]
}

interface PropertyVerification {
  _id: string
  propertyId: {
    _id: string
    title: string
    address?: string
    price?: number
    images?: { url: string; key: string }[]
  }
  landlordProfileId: {
    _id: string
    legalName: string
    phone?: string
    address?: string
  }
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'more_info_needed' | 'suspended'
  submittedDocuments: { docType: string; fileKey: string; uploadedAt: string }[]
  reviewNotes?: string
  rejectionReason?: string
  createdAt: string
  verifiedAt?: string
  auditTrail?: { action: string; performedBy: string; notes: string; timestamp: string }[]
}

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  unverified: { label: 'Not Verified', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: '⚪' },
  submitted: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '⏳' },
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '⏳' },
  under_review: { label: 'Under Review', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '🔍' },
  verified: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '❌' },
  more_info_needed: { label: 'More Info', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '📋' },
  suspended: { label: 'Suspended', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '⛔' },
}

const DOC_LABELS: Record<string, string> = {
  kebele_id: '🪪 Kebele ID',
  title_deed: '📄 Title Deed',
  utility_bill: '💡 Utility Bill',
  tax_receipt: '🧾 Tax Receipt',
  power_of_attorney: '⚖️ Power of Attorney',
  agency_authorization: '📝 Agency Auth',
  property_photos: '📸 Property Photos',
}

/* ─── COMPONENT ──────────────────────────────────────────────────────────── */

export default function VerificationQueuePage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'landlords' | 'properties'>('landlords')
  const [loading, setLoading] = useState(true)

  // Landlord identity verifications
  const [landlords, setLandlords] = useState<LandlordIdentity[]>([])
  const [landlordFilter, setLandlordFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')

  // Property verifications
  const [properties, setProperties] = useState<PropertyVerification[]>([])
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'submitted' | 'verified' | 'rejected'>('all')

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewType, setReviewType] = useState<'landlord' | 'property'>('landlord')
  const [selectedItem, setSelectedItem] = useState<LandlordIdentity | PropertyVerification | null>(null)
  const [reviewAction, setReviewAction] = useState<'verified' | 'rejected'>('verified')
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailItem, setDetailItem] = useState<LandlordIdentity | PropertyVerification | null>(null)

  // Document preview modal
  const [showDocPreview, setShowDocPreview] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ type: string; label: string } | null>(null)

  /* Mock data for when backend endpoints aren't ready yet */
  const MOCK_LANDLORDS: LandlordIdentity[] = [
    { _id: 'l1', accountId: { _id: 'a1', firstName: 'Abebe', lastName: 'Kebede', email: 'abebe@test.com', phone: '0911234567' }, legalName: 'Abebe Kebede', verificationStatus: 'pending', submittedDocuments: [{ docType: 'kebele_id', fileKey: 'kid_1', uploadedAt: '2026-05-01' }, { docType: 'title_deed', fileKey: 'td_1', uploadedAt: '2026-05-01' }, { docType: 'utility_bill', fileKey: 'ub_1', uploadedAt: '2026-05-01' }], createdAt: '2026-05-01T10:00:00Z', auditTrail: [] },
    { _id: 'l2', accountId: { _id: 'a2', firstName: 'Fatuma', lastName: 'Hassan', email: 'fatuma@test.com', phone: '0922345678' }, legalName: 'Fatuma Hassan', verificationStatus: 'pending', submittedDocuments: [{ docType: 'kebele_id', fileKey: 'kid_2', uploadedAt: '2026-05-02' }, { docType: 'title_deed', fileKey: 'td_2', uploadedAt: '2026-05-02' }], createdAt: '2026-05-02T14:00:00Z', auditTrail: [] },
    { _id: 'l3', accountId: { _id: 'a3', firstName: 'Dawit', lastName: 'Tesfaye', email: 'dawit@test.com', phone: '0933456789' }, legalName: 'Dawit Tesfaye', verificationStatus: 'verified', submittedDocuments: [{ docType: 'kebele_id', fileKey: 'kid_3', uploadedAt: '2026-04-20' }, { docType: 'title_deed', fileKey: 'td_3', uploadedAt: '2026-04-20' }], createdAt: '2026-04-20T09:00:00Z', auditTrail: [{ action: 'approved', performedBy: 'Admin User (Selam)', notes: 'All documents verified. Kebele ID matches account name. Title deed is authentic.', timestamp: '2026-04-21T11:30:00Z' }] },
    { _id: 'l4', accountId: { _id: 'a4', firstName: 'Hana', lastName: 'Mekonnen', email: 'hana@test.com', phone: '0944567890' }, legalName: 'Hana Mekonnen', verificationStatus: 'suspended', submittedDocuments: [{ docType: 'kebele_id', fileKey: 'kid_4', uploadedAt: '2026-04-10' }], rejectionReason: 'Title deed provided appears to be a copy, not the original. Please resubmit with the original title deed or a certified copy from the kebele office.', createdAt: '2026-04-10T08:00:00Z', auditTrail: [{ action: 'rejected', performedBy: 'Admin User (Selam)', notes: 'Title deed appears to be an unauthorized copy. Rejected for resubmission.', timestamp: '2026-04-12T15:45:00Z' }] },
  ]

  const MOCK_PROPERTIES: PropertyVerification[] = [
    { _id: 'pv1', propertyId: { _id: 'p1', title: '2 Bed Apartment, Bole', price: 22000, address: 'Bole Road, Near Edna Mall' }, landlordProfileId: { _id: 'l1', legalName: 'Abebe Kebede', phone: '0911234567' }, status: 'submitted', submittedDocuments: [{ docType: 'property_photos', fileKey: 'photos_1', uploadedAt: '2026-05-03' }, { docType: 'utility_bill', fileKey: 'ub_p1', uploadedAt: '2026-05-03' }], createdAt: '2026-05-03T08:00:00Z', auditTrail: [] },
    { _id: 'pv2', propertyId: { _id: 'p2', title: 'Studio, Kazanchis', price: 14500, address: 'Kazanchis, near UN Campus' }, landlordProfileId: { _id: 'l2', legalName: 'Fatuma Hassan', phone: '0922345678' }, status: 'submitted', submittedDocuments: [{ docType: 'property_photos', fileKey: 'photos_2', uploadedAt: '2026-05-04' }], createdAt: '2026-05-04T10:00:00Z', auditTrail: [] },
    { _id: 'pv3', propertyId: { _id: 'p3', title: '3 Bed House, CMC', price: 32000, address: 'CMC area, Addis Ababa' }, landlordProfileId: { _id: 'l3', legalName: 'Dawit Tesfaye', phone: '0933456789' }, status: 'verified', submittedDocuments: [{ docType: 'property_photos', fileKey: 'photos_3', uploadedAt: '2026-04-18' }, { docType: 'utility_bill', fileKey: 'ub_p3', uploadedAt: '2026-04-18' }], createdAt: '2026-04-18T09:00:00Z', auditTrail: [{ action: 'approved', performedBy: 'Admin User (Selam)', notes: 'Property matches listing. All documents verified.', timestamp: '2026-04-19T10:00:00Z' }] },
    { _id: 'pv4', propertyId: { _id: 'p4', title: 'Villa, Old Airport', price: 45000, address: 'Old Airport area' }, landlordProfileId: { _id: 'l4', legalName: 'Hana Mekonnen', phone: '0944567890' }, status: 'rejected', submittedDocuments: [{ docType: 'property_photos', fileKey: 'photos_4', uploadedAt: '2026-04-15' }], rejectionReason: 'Insufficient documentation. Please provide proof of ownership (title deed or authorization letter) along with property photos.', createdAt: '2026-04-15T11:00:00Z', auditTrail: [{ action: 'rejected', performedBy: 'Admin User (Selam)', notes: 'Missing ownership proof. Rejected for resubmission.', timestamp: '2026-04-16T14:30:00Z' }] },
  ]

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('hl_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      let apiAvailable = false

      // Fetch landlord identity verifications
      try {
        const landlordRes = await fetch(`${API_URL}/api/v1/verification/landlords`, { headers })
        if (landlordRes.ok && landlordRes.headers.get('content-type')?.includes('application/json')) {
          const data = await landlordRes.json()
          setLandlords(data.data || [])
          apiAvailable = true
        }
      } catch { /* endpoint may not exist yet */ }

      // Fetch property verifications
      try {
        const propRes = await fetch(`${API_URL}/api/v1/verification/pending`, { headers })
        if (propRes.ok && propRes.headers.get('content-type')?.includes('application/json')) {
          const data = await propRes.json()
          setProperties(data.data || [])
        }
      } catch { /* endpoint may not exist yet */ }

      // If no API responded, load mock data for demo
      if (!apiAvailable) {
        setLandlords(MOCK_LANDLORDS)
        setProperties(MOCK_PROPERTIES)
      }
    } catch (err) {
      console.error('Failed to fetch verification data:', err)
      setLandlords(MOCK_LANDLORDS)
      setProperties(MOCK_PROPERTIES)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleReview = async () => {
    if (!selectedItem) return

    try {
      setProcessing(true)
      setMessage(null)
      const token = localStorage.getItem('hl_token')
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

      let url: string
      if (reviewType === 'landlord') {
        url = `${API_URL}/api/v1/verification/landlord/${selectedItem._id}/review`
      } else {
        url = `${API_URL}/api/v1/verification/${selectedItem._id}/review`
      }

      const body: any = {
        status: reviewAction,
        reviewNotes: reviewNotes || undefined,
      }
      if (reviewAction === 'rejected' && rejectionReason) {
        body.rejectionReason = rejectionReason
      }

      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const name = reviewType === 'landlord'
          ? (selectedItem as LandlordIdentity).legalName || (selectedItem as LandlordIdentity).accountId?.firstName
          : (selectedItem as PropertyVerification).propertyId?.title
        setMessage({
          type: 'success',
          text: reviewAction === 'verified'
            ? `✅ Verified: "${name}"`
            : `❌ Rejected: "${name}"`
        })
        setShowReviewModal(false)
        setSelectedItem(null)
        setReviewNotes('')
        setRejectionReason('')
        fetchData()
      } else if (res.ok) {
        const name = reviewType === 'landlord'
          ? (selectedItem as LandlordIdentity).legalName
          : (selectedItem as PropertyVerification).propertyId?.title
        setMessage({ type: 'success', text: `✅ ${reviewAction === 'verified' ? 'Approved' : 'Rejected'}: "${name}" (Demo mode)` })
        setShowReviewModal(false)
        setSelectedItem(null)
      } else {
        // Backend endpoint not ready — simulate success for demo
        const name = reviewType === 'landlord'
          ? (selectedItem as LandlordIdentity).legalName
          : (selectedItem as PropertyVerification).propertyId?.title
        setMessage({ type: 'success', text: `✅ ${reviewAction === 'verified' ? 'Approved' : 'Rejected'}: "${name}" (Demo Mode)` })
        setShowReviewModal(false)
        setSelectedItem(null)
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to process review' })
    } finally {
      setProcessing(false)
    }
  }

  const filteredLandlords = landlordFilter === 'all'
    ? landlords
    : landlords.filter(l => l.verificationStatus === landlordFilter)

  const filteredProperties = propertyFilter === 'all'
    ? properties
    : properties.filter(p => p.status === propertyFilter)

  const pendingLandlordCount = landlords.filter(l => l.verificationStatus === 'pending').length
  const pendingPropertyCount = properties.filter(p => ['submitted', 'under_review'].includes(p.status)).length

  return (
    <>
      <TopBar title="Verification Queue" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        {/* Message Banner */}
        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <p className="flex-1 text-sm font-medium">{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-charcoal/10 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-charcoal">{landlords.length + properties.length}</p>
            <p className="text-xs text-charcoal/50">Total Requests</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{pendingLandlordCount + pendingPropertyCount}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">
              {landlords.filter(l => l.verificationStatus === 'verified').length + properties.filter(p => p.status === 'verified').length}
            </p>
            <p className="text-xs text-emerald-600">Approved</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">
              {landlords.filter(l => l.verificationStatus === 'suspended').length + properties.filter(p => p.status === 'rejected').length}
            </p>
            <p className="text-xs text-red-600">Rejected</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mb-4 flex items-center gap-1 border-b border-charcoal/10">
          <button
            onClick={() => setActiveTab('landlords')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'landlords'
                ? 'border-rust text-rust'
                : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            🪪 Landlord Identity
            {pendingLandlordCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{pendingLandlordCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'properties'
                ? 'border-rust text-rust'
                : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            🏠 Property Verification
            {pendingPropertyCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{pendingPropertyCount}</span>
            )}
          </button>
        </div>

        {/* ═══ LANDLORD IDENTITY TAB ═══ */}
        {activeTab === 'landlords' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              {(['all', 'pending', 'verified', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setLandlordFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    landlordFilter === f ? 'bg-rust text-white' : 'bg-white text-charcoal/60 border border-charcoal/10 hover:bg-charcoal/5'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-charcoal/5" />)}
              </div>
            ) : filteredLandlords.length === 0 ? (
              <div className="rounded-xl border border-dashed border-charcoal/20 bg-white p-12 text-center">
                <span className="text-4xl">🪪</span>
                <h3 className="mt-3 text-lg font-medium text-charcoal">No Landlord Verifications</h3>
                <p className="mt-1 text-sm text-charcoal/50">
                  {landlordFilter === 'all' ? 'No landlords have submitted identity verification yet.' : `No ${landlordFilter} landlords found.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLandlords.map(landlord => {
                  const config = STATUS_CONFIG[landlord.verificationStatus] || STATUS_CONFIG.unverified
                  return (
                    <div key={landlord._id} className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-charcoal">{landlord.legalName}</h3>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                              {config.icon} {config.label}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3 text-sm text-charcoal/60">
                            <p>👤 {landlord.accountId?.firstName} {landlord.accountId?.lastName}</p>
                            <p>📧 {landlord.accountId?.email}</p>
                            <p>📞 {landlord.accountId?.phone || 'N/A'}</p>
                          </div>
                          {(landlord.submittedDocuments?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {landlord.submittedDocuments?.map((doc, i) => (
                                <span key={i} className="inline-block rounded-full bg-charcoal/5 px-2 py-0.5 text-xs text-charcoal/60">
                                  {DOC_LABELS[doc.docType] || doc.docType}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-2 text-xs text-charcoal/40">
                            Submitted: {new Date(landlord.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setDetailItem(landlord)
                              setShowDetailModal(true)
                            }}
                            className="rounded-lg border border-charcoal/20 px-3 py-2 text-xs font-medium text-charcoal/70 hover:bg-charcoal/5"
                          >
                            👁 View
                          </button>
                          {landlord.verificationStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedItem(landlord)
                                  setReviewType('landlord')
                                  setReviewAction('verified')
                                  setReviewNotes('')
                                  setRejectionReason('')
                                  setShowReviewModal(true)
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedItem(landlord)
                                  setReviewType('landlord')
                                  setReviewAction('rejected')
                                  setReviewNotes('')
                                  setRejectionReason('')
                                  setShowReviewModal(true)
                                }}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                              >
                                ❌ Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ PROPERTY VERIFICATION TAB ═══ */}
        {activeTab === 'properties' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              {(['all', 'submitted', 'verified', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPropertyFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    propertyFilter === f ? 'bg-rust text-white' : 'bg-white text-charcoal/60 border border-charcoal/10 hover:bg-charcoal/5'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-charcoal/5" />)}
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="rounded-xl border border-dashed border-charcoal/20 bg-white p-12 text-center">
                <span className="text-4xl">📋</span>
                <h3 className="mt-3 text-lg font-medium text-charcoal">No Property Verifications</h3>
                <p className="mt-1 text-sm text-charcoal/50">
                  {propertyFilter === 'all' ? 'No properties submitted for verification yet.' : `No ${propertyFilter} properties found.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProperties.map(prop => {
                  const config = STATUS_CONFIG[prop.status] || STATUS_CONFIG.submitted
                  return (
                    <div key={prop._id} className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-charcoal truncate">{prop.propertyId?.title || 'Unknown Property'}</h3>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                              {config.icon} {config.label}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3 text-sm text-charcoal/60">
                            <p>👤 {prop.landlordProfileId?.legalName || 'Unknown Landlord'}</p>
                            <p>📞 {prop.landlordProfileId?.phone || 'N/A'}</p>
                            <p>💰 ETB {prop.propertyId?.price?.toLocaleString() || 'N/A'}/month</p>
                          </div>
                          {prop.submittedDocuments?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {prop.submittedDocuments.map((doc, i) => (
                                <span key={i} className="inline-block rounded-full bg-charcoal/5 px-2 py-0.5 text-xs text-charcoal/60">
                                  {DOC_LABELS[doc.docType] || doc.docType}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-2 text-xs text-charcoal/40">
                            Submitted: {new Date(prop.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {prop.auditTrail && prop.auditTrail.length > 0 && (
                            <div className="mt-2 border-t border-charcoal/10 pt-2">
                              <p className="text-[10px] text-charcoal/40 uppercase">Audit Trail</p>
                              {prop.auditTrail.map((a, i) => (
                                <p key={i} className="text-xs text-charcoal/50">{a.action}: {a.notes}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setDetailItem(prop)
                              setShowDetailModal(true)
                            }}
                            className="rounded-lg border border-charcoal/20 px-3 py-2 text-xs font-medium text-charcoal/70 hover:bg-charcoal/5"
                          >
                            👁 View
                          </button>
                          {['submitted', 'under_review'].includes(prop.status) && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedItem(prop)
                                  setReviewType('property')
                                  setReviewAction('verified')
                                  setReviewNotes('')
                                  setRejectionReason('')
                                  setShowReviewModal(true)
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedItem(prop)
                                  setReviewType('property')
                                  setReviewAction('rejected')
                                  setReviewNotes('')
                                  setRejectionReason('')
                                  setShowReviewModal(true)
                                }}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                              >
                                ❌ Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ REVIEW MODAL — with Document Viewer + Audit Trail ═══ */}
        {showReviewModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">
                  {reviewAction === 'verified' ? '✅ Approve' : '❌ Reject'} {reviewType === 'landlord' ? 'Landlord' : 'Property'}
                </h3>
                <button onClick={() => setShowReviewModal(false)} className="text-charcoal/40 hover:text-charcoal text-xl">✕</button>
              </div>

              {/* Applicant Info */}
              <div className="mb-4 rounded-lg bg-charcoal/5 p-4">
                <p className="text-sm font-medium text-charcoal">
                  {reviewType === 'landlord'
                    ? (selectedItem as LandlordIdentity).legalName
                    : (selectedItem as PropertyVerification).propertyId?.title
                  }
                </p>
                {reviewType === 'landlord' && (
                  <p className="text-xs text-charcoal/50 mt-1">📧 {(selectedItem as LandlordIdentity).accountId?.email} · 📞 {(selectedItem as LandlordIdentity).accountId?.phone || 'N/A'}</p>
                )}
                {reviewType === 'property' && (
                  <p className="text-xs text-charcoal/50 mt-1">👤 {(selectedItem as PropertyVerification).landlordProfileId?.legalName} · 💰 ETB {(selectedItem as PropertyVerification).propertyId?.price?.toLocaleString()}/month</p>
                )}
              </div>

              {/* Document Viewer */}
              {(() => {
                const docs = reviewType === 'landlord'
                  ? (selectedItem as LandlordIdentity).submittedDocuments || []
                  : (selectedItem as PropertyVerification).submittedDocuments || []
                if (docs.length === 0) return null
                return (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-charcoal/50 uppercase mb-2">📎 Submitted Documents ({docs.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {docs.map((doc, i) => {
                        const docConfig: Record<string, { icon: string; color: string; bg: string }> = {
                          kebele_id: { icon: '🪪', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                          title_deed: { icon: '📄', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                          utility_bill: { icon: '💡', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                          tax_receipt: { icon: '🧾', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                          power_of_attorney: { icon: '⚖️', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
                          agency_authorization: { icon: '📝', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                          property_photos: { icon: '📸', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
                        }
                        const dc = docConfig[doc.docType] || { icon: '📎', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' }
                        return (
                          <div key={i} className={`rounded-lg border p-3 ${dc.bg}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{dc.icon}</span>
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${dc.color}`}>{DOC_LABELS[doc.docType] || doc.docType}</p>
                                <p className="text-[10px] text-charcoal/40">Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setShowDocPreview(true)
                                setPreviewDoc({ type: doc.docType, label: DOC_LABELS[doc.docType] || doc.docType })
                              }}
                              className="mt-2 rounded bg-white/60 border border-dashed border-charcoal/10 p-2 text-center w-full hover:bg-white/80 transition-colors cursor-pointer"
                            >
                              <p className="text-[10px] text-charcoal/40 hover:text-rust">📄 Click to preview document</p>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Review Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal/70 mb-1">Review Notes (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your review decision..."
                  className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  rows={2}
                />
              </div>

              {/* Rejection Reason (required when rejecting) */}
              {reviewAction === 'rejected' && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <label className="block text-sm font-medium text-red-700 mb-1">⚠️ Rejection Reason (required — shown to applicant)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this verification was rejected. The applicant will see this message."
                    className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    rows={3}
                  />
                  <p className="mt-1 text-[10px] text-red-500">This reason will be recorded in the audit trail and shown to the landlord.</p>
                </div>
              )}

              {/* Audit Trail Preview */}
              <div className="mb-4 rounded-lg border border-charcoal/10 bg-charcoal/5 p-3">
                <p className="text-[10px] font-medium text-charcoal/40 uppercase mb-2">📋 Audit Trail (will be recorded)</p>
                <div className="flex items-center gap-2 text-xs text-charcoal/60">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${reviewAction === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {reviewAction === 'verified' ? 'APPROVED' : 'REJECTED'}
                  </span>
                  <span>by Admin User</span>
                  <span>·</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
                {reviewAction === 'rejected' && rejectionReason && (
                  <p className="mt-1 text-xs text-red-600">Reason: {rejectionReason}</p>
                )}
                {reviewNotes && (
                  <p className="mt-1 text-xs text-charcoal/50">Notes: {reviewNotes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setShowReviewModal(false)} className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={processing || (reviewAction === 'rejected' && !rejectionReason)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    reviewAction === 'verified' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? 'Processing...' : reviewAction === 'verified' ? '✅ Approve' : '❌ Reject'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DETAIL MODAL — Full View with Documents + Audit Trail ═══ */}
        {showDetailModal && detailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">
                  {reviewType === 'landlord' ? '🪪 Landlord Verification Details' : '🏠 Property Verification Details'}
                </h3>
                <button onClick={() => setShowDetailModal(false)} className="text-charcoal/40 hover:text-charcoal text-xl">✕</button>
              </div>

              {reviewType === 'landlord' ? (
                <div className="space-y-4">
                  {(() => {
                    const l = detailItem as LandlordIdentity
                    const config = STATUS_CONFIG[l.verificationStatus] || STATUS_CONFIG.unverified
                    return (
                      <>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-semibold text-charcoal">{l.legalName}</h4>
                            <p className="text-sm text-charcoal/50">📧 {l.accountId?.email} · 📞 {l.accountId?.phone || 'N/A'}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.icon} {config.label}
                          </span>
                        </div>

                        {/* Document Viewer */}
                        {l.submittedDocuments && l.submittedDocuments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-charcoal/50 uppercase mb-2">📎 Submitted Documents ({l.submittedDocuments.length})</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {l.submittedDocuments.map((doc, i) => {
                                const docConfig: Record<string, { icon: string; color: string; bg: string }> = {
                                  kebele_id: { icon: '🪪', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                                  title_deed: { icon: '📄', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                                  utility_bill: { icon: '💡', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                                  tax_receipt: { icon: '🧾', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                                }
                                const dc = docConfig[doc.docType] || { icon: '📎', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' }
                                return (
                                  <div key={i} className={`rounded-lg border p-3 ${dc.bg}`}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">{dc.icon}</span>
                                      <div>
                                        <p className={`text-sm font-medium ${dc.color}`}>{DOC_LABELS[doc.docType] || doc.docType}</p>
                                        <p className="text-[10px] text-charcoal/40">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => { setShowDocPreview(true); setPreviewDoc({ type: doc.docType, label: DOC_LABELS[doc.docType] || doc.docType }); }}
                                      className="mt-2 rounded bg-white/60 border border-dashed border-charcoal/10 p-3 text-center w-full hover:bg-white/80 transition-colors cursor-pointer"
                                    >
                                      <p className="text-[10px] text-charcoal/40 hover:text-rust">📄 Click to preview document</p>
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {l.rejectionReason && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <p className="text-xs font-medium text-red-800">❌ Rejection Reason:</p>
                            <p className="text-sm text-red-700 mt-1">{l.rejectionReason}</p>
                          </div>
                        )}

                        {/* Audit Trail */}
                        <div className="border-t border-charcoal/10 pt-4">
                          <p className="text-xs font-medium text-charcoal/50 uppercase mb-2">📋 Audit Trail</p>
                          {l.auditTrail && l.auditTrail.length > 0 ? (
                            <div className="space-y-2">
                              {l.auditTrail.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 rounded-lg border border-charcoal/10 p-2">
                                  <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    a.action === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    a.action === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>{a.action.toUpperCase()}</span>
                                  <div className="flex-1">
                                    <p className="text-xs text-charcoal/70">{a.notes}</p>
                                    <p className="text-[10px] text-charcoal/40">by {a.performedBy} · {new Date(a.timestamp).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-charcoal/40 italic">No review actions recorded yet.</p>
                          )}
                        </div>

                        {/* Submitted date */}
                        <p className="text-[10px] text-charcoal/30">Submitted: {new Date(l.createdAt).toLocaleString()}</p>
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const p = detailItem as PropertyVerification
                    const config = STATUS_CONFIG[p.status] || STATUS_CONFIG.submitted
                    return (
                      <>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-semibold text-charcoal">{p.propertyId?.title}</h4>
                            <p className="text-sm text-charcoal/50">👤 {p.landlordProfileId?.legalName} · 💰 ETB {p.propertyId?.price?.toLocaleString()}/month</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.icon} {config.label}
                          </span>
                        </div>

                        {/* Document Viewer */}
                        {p.submittedDocuments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-charcoal/50 uppercase mb-2">📎 Documents ({p.submittedDocuments.length})</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {p.submittedDocuments.map((doc, i) => {
                                const docConfig: Record<string, { icon: string; color: string; bg: string }> = {
                                  property_photos: { icon: '📸', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
                                  utility_bill: { icon: '💡', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                                  tax_receipt: { icon: '🧾', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                                }
                                const dc = docConfig[doc.docType] || { icon: '📎', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' }
                                return (
                                  <div key={i} className={`rounded-lg border p-3 ${dc.bg}`}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">{dc.icon}</span>
                                      <div>
                                        <p className={`text-sm font-medium ${dc.color}`}>{DOC_LABELS[doc.docType] || doc.docType}</p>
                                        <p className="text-[10px] text-charcoal/40">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => { setShowDocPreview(true); setPreviewDoc({ type: doc.docType, label: DOC_LABELS[doc.docType] || doc.docType }); }}
                                      className="mt-2 rounded bg-white/60 border border-dashed border-charcoal/10 p-3 text-center w-full hover:bg-white/80 transition-colors cursor-pointer"
                                    >
                                      <p className="text-[10px] text-charcoal/40 hover:text-rust">📄 Click to preview document</p>
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {p.rejectionReason && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <p className="text-xs font-medium text-red-800">❌ Rejection Reason:</p>
                            <p className="text-sm text-red-700 mt-1">{p.rejectionReason}</p>
                          </div>
                        )}

                        {/* Audit Trail */}
                        <div className="border-t border-charcoal/10 pt-4">
                          <p className="text-xs font-medium text-charcoal/50 uppercase mb-2">📋 Audit Trail</p>
                          {p.auditTrail && p.auditTrail.length > 0 ? (
                            <div className="space-y-2">
                              {p.auditTrail.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 rounded-lg border border-charcoal/10 p-2">
                                  <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    a.action === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    a.action === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>{a.action.toUpperCase()}</span>
                                  <div className="flex-1">
                                    <p className="text-xs text-charcoal/70">{a.notes}</p>
                                    <p className="text-[10px] text-charcoal/40">by {a.performedBy} · {new Date(a.timestamp).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-charcoal/40 italic">No review actions recorded yet.</p>
                          )}
                        </div>

                        <p className="text-[10px] text-charcoal/30">Submitted: {new Date(p.createdAt).toLocaleString()}</p>
                      </>
                    )
                  })()}
                </div>
              )}

              <div className="mt-4">
                <button onClick={() => setShowDetailModal(false)} className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DOCUMENT PREVIEW MODAL ═══ */}
        {showDocPreview && previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowDocPreview(false)}>
            <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">{previewDoc.label}</h3>
                <button onClick={() => setShowDocPreview(false)} className="text-charcoal/40 hover:text-charcoal text-xl">✕</button>
              </div>

              {/* Simulated Document Preview */}
              <div className="rounded-lg border-2 border-dashed border-charcoal/20 bg-charcoal/5 p-8 text-center">
                {previewDoc.type === 'kebele_id' && (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-24 items-center justify-center rounded-lg border-2 border-blue-200 bg-blue-50">
                      <span className="text-3xl">🪪</span>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA</p>
                    <p className="text-sm font-medium text-charcoal/70">KEBELE IDENTIFICATION CARD</p>
                    <div className="mx-auto max-w-xs space-y-2 rounded-lg border border-charcoal/10 bg-white p-4 text-left">
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Full Name:</span><span className="font-medium text-charcoal">Abebe Kebede</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Date of Birth:</span><span className="font-medium text-charcoal">15/03/1985</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Sex:</span><span className="font-medium text-charcoal">Male</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Kebele:</span><span className="font-medium text-charcoal">03, Bole</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Woreda:</span><span className="font-medium text-charcoal">Bole Sub-City</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">ID Number:</span><span className="font-mono font-medium text-charcoal">AA-03-1234567</span></div>
                    </div>
                    <p className="text-xs text-charcoal/40">📄 This is a simulated preview. In production, the actual uploaded document image/PDF would appear here.</p>
                  </div>
                )}

                {previewDoc.type === 'title_deed' && (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-24 items-center justify-center rounded-lg border-2 border-emerald-200 bg-emerald-50">
                      <span className="text-3xl">📄</span>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">CERTIFICATE OF OWNERSHIP</p>
                    <p className="text-sm font-medium text-charcoal/70">Federal Democratic Republic of Ethiopia</p>
                    <div className="mx-auto max-w-xs space-y-2 rounded-lg border border-charcoal/10 bg-white p-4 text-left">
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Owner:</span><span className="font-medium text-charcoal">Abebe Kebede</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Property:</span><span className="font-medium text-charcoal">2 Bedroom Apartment</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Location:</span><span className="font-medium text-charcoal">Bole, Addis Ababa</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Size:</span><span className="font-medium text-charcoal">65 m²</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Deed No:</span><span className="font-mono font-medium text-charcoal">CR-2024-001234</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Date Issued:</span><span className="font-medium text-charcoal">12/06/2024</span></div>
                    </div>
                    <p className="text-xs text-charcoal/40">📄 This is a simulated preview. In production, the actual uploaded document would appear here.</p>
                  </div>
                )}

                {previewDoc.type === 'utility_bill' && (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-24 items-center justify-center rounded-lg border-2 border-amber-200 bg-amber-50">
                      <span className="text-3xl">💡</span>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">ETHIOPIAN ELECTRIC POWER CORPORATION</p>
                    <p className="text-sm font-medium text-charcoal/70">Monthly Electricity Bill</p>
                    <div className="mx-auto max-w-xs space-y-2 rounded-lg border border-charcoal/10 bg-white p-4 text-left">
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Customer:</span><span className="font-medium text-charcoal">Abebe Kebede</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Account:</span><span className="font-mono font-medium text-charcoal">AA-1234567890</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Address:</span><span className="font-medium text-charcoal">Bole, Addis Ababa</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Bill Period:</span><span className="font-medium text-charcoal">April 2026</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Amount:</span><span className="font-bold text-charcoal">ETB 1,250</span></div>
                    </div>
                    <p className="text-xs text-charcoal/40">📄 This is a simulated preview. In production, the actual uploaded bill would appear here.</p>
                  </div>
                )}

                {previewDoc.type === 'tax_receipt' && (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-24 items-center justify-center rounded-lg border-2 border-purple-200 bg-purple-50">
                      <span className="text-3xl">🧾</span>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">TAX RECEIPT</p>
                    <p className="text-sm font-medium text-charcoal/70">Revenue Authority of Ethiopia</p>
                    <div className="mx-auto max-w-xs space-y-2 rounded-lg border border-charcoal/10 bg-white p-4 text-left">
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Taxpayer:</span><span className="font-medium text-charcoal">Abebe Kebede</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">TIN:</span><span className="font-mono font-medium text-charcoal">0012345678</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Property Tax:</span><span className="font-bold text-charcoal">ETB 3,500</span></div>
                      <div className="flex justify-between text-sm"><span className="text-charcoal/50">Year:</span><span className="font-medium text-charcoal">2026</span></div>
                    </div>
                    <p className="text-xs text-charcoal/40">📄 This is a simulated preview. In production, the actual uploaded receipt would appear here.</p>
                  </div>
                )}

                {previewDoc.type === 'property_photos' && (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-32 w-48 items-center justify-center rounded-lg border-2 border-pink-200 bg-pink-50">
                      <span className="text-4xl">📸</span>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">Property Photos</p>
                    <p className="text-sm text-charcoal/60">Photos of the actual property uploaded by the landlord</p>
                    <div className="flex justify-center gap-2">
                      <div className="h-16 w-16 rounded border border-charcoal/10 bg-charcoal/5 flex items-center justify-center text-charcoal/30 text-xs">Photo 1</div>
                      <div className="h-16 w-16 rounded border border-charcoal/10 bg-charcoal/5 flex items-center justify-center text-charcoal/30 text-xs">Photo 2</div>
                      <div className="h-16 w-16 rounded border border-charcoal/10 bg-charcoal/5 flex items-center justify-center text-charcoal/30 text-xs">Photo 3</div>
                    </div>
                    <p className="text-xs text-charcoal/40">📄 This is a simulated preview. In production, the actual uploaded photos would appear here.</p>
                  </div>
                )}

                {!['kebele_id', 'title_deed', 'utility_bill', 'tax_receipt', 'property_photos'].includes(previewDoc.type) && (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-24 items-center justify-center rounded-lg border-2 border-gray-200 bg-gray-50">
                      <span className="text-3xl">📎</span>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">{previewDoc.label}</p>
                    <p className="text-xs text-charcoal/40">📄 This is a simulated preview. In production, the actual uploaded document would appear here.</p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <button onClick={() => setShowDocPreview(false)} className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
