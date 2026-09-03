'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import { httpClient } from '@/lib/http-client'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface VerificationItem {
  id: string
  property: { _id: string; title: string; address?: string; price?: number }
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'more_info_needed' | 'suspended'
  submittedAt: string
  reviewedAt?: string
  rejectionReason?: string
}

interface LandlordProfile {
  _id: string
  legalName: string
  verificationStatus: string
}

/* ─── STATUS CONFIG ──────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '📨' },
  under_review: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '🔍' },
  verified: { label: 'Verified', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '❌' },
  more_info_needed: { label: 'More Info Needed', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '📋' },
  suspended: { label: 'Suspended', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '⛔' },
}

const DOCUMENT_TYPES = [
  { value: 'title_deed', label: 'Title Deed', description: 'Official property ownership document' },
  { value: 'kebele_id', label: 'Kebele ID', description: 'Government-issued identity document' },
  { value: 'utility_bill', label: 'Utility Bill', description: 'Recent electricity or water bill in your name' },
  { value: 'tax_receipt', label: 'Tax Receipt', description: 'Property tax payment receipt' },
  { value: 'power_of_attorney', label: 'Power of Attorney', description: 'If you are managing on behalf of the owner' },
  { value: 'agency_authorization', label: 'Agency Authorization', description: 'Authorization letter from property owner' },
  { value: 'property_photos', label: 'Property Photos', description: 'Photos of the actual property' },
]

/* ─── COMPONENT ──────────────────────────────────────────────────────────── */

export default function LandlordVerificationPage() {
  const [verifications, setVerifications] = useState<VerificationItem[]>([])
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState('')
  const [documents, setDocuments] = useState<{ docType: string; fileKey: string }[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [properties, setProperties] = useState<{ _id: string; title: string; verificationStatus: string }[]>([])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch verification status
      const statusRes = await httpClient.get('/api/v1/verification/status')
      if (statusRes.data) {
        setVerifications(statusRes.data.data || [])
      }

      // Fetch landlord properties for the submit form
      const propsRes = await httpClient.get('/api/v1/properties/my')
      if (propsRes.data) {
        const props = propsRes.data.data || propsRes.data.properties || []
        setProperties(props.map((p: any) => ({
          _id: p._id || p.id,
          title: p.title,
          verificationStatus: p.verificationStatus || 'unverified'
        })))
      }
    } catch (err) {
      console.error('Failed to fetch verification data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmitVerification = async () => {
    if (!selectedProperty || documents.length === 0) {
      setMessage({ type: 'error', text: 'Please select a property and upload at least one document.' })
      return
    }

    try {
      setSubmitting(true)
      setMessage(null)

      const res = await httpClient.post('/api/v1/verification/submit', {
        propertyId: selectedProperty,
        documents: documents,
      })

      if (res.data) {
        setMessage({ type: 'success', text: 'Verification submitted successfully! Admin will review your documents.' })
        setShowUploadForm(false)
        setSelectedProperty('')
        setDocuments([])
        fetchData()
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to submit verification' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit verification' })
    } finally {
      setSubmitting(false)
    }
  }

  const addDocument = (docType: string) => {
    if (!documents.find(d => d.docType === docType)) {
      setDocuments([...documents, { docType, fileKey: `${docType}_${Date.now()}` }])
    }
  }

  const removeDocument = (docType: string) => {
    setDocuments(documents.filter(d => d.docType !== docType))
  }

  // Count stats
  const pendingCount = verifications.filter(v => ['submitted', 'under_review'].includes(v.status)).length
  const verifiedCount = verifications.filter(v => v.status === 'verified').length
  const rejectedCount = verifications.filter(v => v.status === 'rejected').length
  const unverifiedProperties = properties.filter(p => p.verificationStatus === 'unverified' || p.verificationStatus === 'rejected')

  return (
    <>
      <TopBar title="Property Verification" />

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

        {/* Status Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-2xl font-bold text-blue-700">{pendingCount}</p>
                <p className="text-sm text-blue-600">Pending Review</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{verifiedCount}</p>
                <p className="text-sm text-emerald-600">Verified Properties</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <p className="text-2xl font-bold text-red-700">{rejectedCount}</p>
                <p className="text-sm text-red-600">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit New Verification Button */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-charcoal">Your Verification Requests</h2>
          {unverifiedProperties.length > 0 && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90 transition-colors"
            >
              + Submit New Verification
            </button>
          )}
        </div>

        {/* Upload Form Modal */}
        {showUploadForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Submit Property for Verification</h3>
                <button onClick={() => setShowUploadForm(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
              </div>

              {/* Select Property */}
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

              {/* Document Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal/70 mb-2">Required Documents</label>
                <div className="space-y-2">
                  {DOCUMENT_TYPES.map(doc => {
                    const isAdded = documents.some(d => d.docType === doc.value)
                    return (
                      <div key={doc.value} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                        isAdded ? 'border-emerald-300 bg-emerald-50' : 'border-charcoal/10 hover:border-charcoal/20'
                      }`}>
                        <div>
                          <p className="text-sm font-medium text-charcoal">{doc.label}</p>
                          <p className="text-xs text-charcoal/50">{doc.description}</p>
                        </div>
                        {isAdded ? (
                          <button
                            onClick={() => removeDocument(doc.value)}
                            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => addDocument(doc.value)}
                            className="rounded bg-rust/10 px-2 py-1 text-xs font-medium text-rust hover:bg-rust/20"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="mb-4 text-xs text-charcoal/50">
                📎 In production, you would upload actual file attachments here. For now, we record the document types you plan to submit.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUploadForm(false)}
                  className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitVerification}
                  disabled={submitting || !selectedProperty || documents.length === 0}
                  className="flex-1 rounded-lg bg-rust px-4 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verification List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-charcoal/5" />
            ))}
          </div>
        ) : verifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-charcoal/20 bg-white p-12 text-center">
            <span className="text-4xl">📋</span>
            <h3 className="mt-3 text-lg font-medium text-charcoal">No Verification Requests Yet</h3>
            <p className="mt-1 text-sm text-charcoal/50">
              Submit your properties for verification to build trust with tenants.
            </p>
            {unverifiedProperties.length > 0 && (
              <button
                onClick={() => setShowUploadForm(true)}
                className="mt-4 rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90"
              >
                Submit Your First Property
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {verifications.map((v) => {
              const config = STATUS_CONFIG[v.status] || STATUS_CONFIG.submitted
              return (
                <div key={v.id} className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-charcoal">
                          {v.property?.title || 'Property'}
                        </h3>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                      </div>
                      {v.property?.address && (
                        <p className="mt-1 text-sm text-charcoal/50">📍 {v.property.address}</p>
                      )}
                      {v.property?.price && (
                        <p className="mt-0.5 text-sm text-charcoal/50">💰 ETB {v.property.price.toLocaleString()}/month</p>
                      )}
                      <p className="mt-1 text-xs text-charcoal/40">
                        Submitted: {new Date(v.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {v.status === 'rejected' && v.rejectionReason && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500">⚠️</span>
                        <div>
                          <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                          <p className="mt-1 text-sm text-red-700">{v.rejectionReason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* More Info Needed */}
                  {v.status === 'more_info_needed' && (
                    <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500">📋</span>
                        <div>
                          <p className="text-sm font-medium text-orange-800">Additional Information Required</p>
                          <p className="mt-1 text-sm text-orange-700">
                            Admin has requested additional documents. Please update your submission.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {(v.status === 'rejected' || v.status === 'more_info_needed') && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedProperty(v.property?._id || '')
                          setShowUploadForm(true)
                        }}
                        className="rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90"
                      >
                        📎 Resubmit Documents
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* How Verification Works */}
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-6">
          <h3 className="text-base font-semibold text-charcoal mb-4">📋 How Verification Works</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { step: '1', title: 'Submit Documents', desc: 'Upload title deed, kebele ID, utility bills, and property photos' },
              { step: '2', title: 'Admin Review', desc: 'Our team reviews your documents for authenticity' },
              { step: '3', title: 'Verification', desc: 'Get a verified badge on your properties' },
              { step: '4', title: 'Build Trust', desc: 'Tenants prefer verified landlords — increase your bookings' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rust text-xs font-bold text-white">
                  {s.step}
                </span>
                <div>
                  <p className="text-sm font-medium text-charcoal">{s.title}</p>
                  <p className="text-xs text-charcoal/50 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
