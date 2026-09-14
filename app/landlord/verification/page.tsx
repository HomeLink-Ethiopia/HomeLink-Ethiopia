'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '@/components/landlord/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface DocRecord {
  docType: string
  fileKey: string
  originalName?: string
  mimeType?: string
  uploadedAt: string
}

interface LandlordProfile {
  _id: string
  legalName: string
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'suspended'
  submittedDocuments?: DocRecord[]
  rejectionReason?: string
  auditTrail?: { action: string; performedByName?: string; notes: string; timestamp: string }[]
}

interface PropertyVerification {
  id?: string
  _id?: string
  property?: { _id: string; title: string; address?: string; price?: number }
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'more_info_needed'
  submittedDocuments?: DocRecord[]
  submittedAt: string
  rejectionReason?: string
  auditTrail?: { action: string; performedByName?: string; notes: string; timestamp: string }[]
}

interface Property {
  _id: string
  title: string
  verificationStatus: string
}

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */

const IDENTITY_DOCS = [
  { value: 'kebele_id', label: 'Kebele ID', description: 'Clear photo or scan of your government-issued ID', required: true },
  { value: 'title_deed', label: 'Title Deed', description: 'Ownership document for the property you manage', required: true },
  { value: 'utility_bill', label: 'Utility Bill', description: 'Recent electricity or water bill in your name (optional)', required: false },
  { value: 'tax_receipt', label: 'Tax Receipt', description: 'Property tax payment receipt (optional)', required: false },
]

const PROPERTY_DOCS = [
  { value: 'property_photos', label: 'Property Photos', description: 'Recent photos of the actual property', required: true },
  { value: 'title_deed', label: 'Ownership Document', description: 'Title deed or authorization letter', required: false },
  { value: 'utility_bill', label: 'Utility Bill', description: 'Bill showing the property address', required: false },
  { value: 'power_of_attorney', label: 'Power of Attorney', description: 'If you manage the property for someone else', required: false },
]

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  unverified: { label: 'Not Started', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  pending: { label: 'Under Review', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  verified: { label: 'Verified', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  suspended: { label: 'Rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
  submitted: { label: 'Submitted', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  under_review: { label: 'Under Review', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
  more_info_needed: { label: 'More Info Needed', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
}

const MAX_FILE_MB = 5

/* ─── FILE PICKER ROW ────────────────────────────────────────────────────── */

function DocumentUploadRow({
  doc, file, onPick, onRemove,
}: {
  doc: (typeof IDENTITY_DOCS)[number]
  file: File | null
  onPick: (f: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_FILE_MB}MB`)
      return
    }
    const okType = f.type.startsWith('image/') || f.type === 'application/pdf'
    if (!okType) {
      setError('Only images (JPG, PNG) or PDF files are accepted')
      return
    }
    setError('')
    onPick(f)
  }

  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      file ? 'border-emerald-300 bg-emerald-50/50' : 'border-charcoal/15 hover:border-charcoal/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-charcoal">
            {doc.label} {doc.required && <span className="text-red-500">*</span>}
          </p>
          <p className="mt-0.5 text-xs text-charcoal/50">{doc.description}</p>

          {file ? (
            <div className="mt-2 flex items-center gap-2">
              {file.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(file)} alt={file.name} className="h-10 w-10 rounded border border-charcoal/10 object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded border border-charcoal/10 bg-white text-[10px] font-bold text-red-600">PDF</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-charcoal">{file.name}</p>
                <p className="text-[10px] text-charcoal/50">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
          ) : null}

          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        {file ? (
          <button
            type="button"
            onClick={() => { onRemove(); if (inputRef.current) inputRef.current.value = '' }}
            className="shrink-0 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 rounded-lg border border-rust/30 bg-rust/5 px-4 py-2 text-xs font-medium text-rust hover:bg-rust/10"
            >
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </>
        )}
      </div>
    </div>
  )
}

/* ─── DOCUMENT VIEWER (real file) ────────────────────────────────────────── */

function DocumentViewer({ doc, onClose }: { doc: DocRecord; onClose: () => void }) {
  const url = doc.fileKey.startsWith('http') ? doc.fileKey : `${API_URL}${doc.fileKey}`
  const isPdf = doc.mimeType === 'application/pdf' || doc.fileKey.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal">{doc.docType.replace(/_/g, ' ')}</p>
            <p className="truncate text-xs text-charcoal/50">{doc.originalName || doc.fileKey.split('/').pop()}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:bg-charcoal/5">
              Open in new tab
            </a>
            <button onClick={onClose} className="rounded p-1 text-charcoal/40 hover:text-charcoal" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-charcoal/5 p-4">
          {isPdf ? (
            <iframe src={url} className="h-[65vh] w-full rounded-lg border border-charcoal/10 bg-white" title={doc.docType} />
          ) : (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={doc.docType} className="max-h-[65vh] max-w-full rounded-lg border border-charcoal/10 object-contain" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────── */

export default function LandlordVerificationPage() {
  const [activeTab, setActiveTab] = useState<'identity' | 'properties'>('identity')
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [propertyVerifications, setPropertyVerifications] = useState<PropertyVerification[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState('')

  // Identity upload form
  const [identityFiles, setIdentityFiles] = useState<Record<string, File>>({})
  const [submittingIdentity, setSubmittingIdentity] = useState(false)

  // Property verification form
  const [showPropertyForm, setShowPropertyForm] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState('')
  const [propFiles, setPropFiles] = useState<Record<string, File>>({})
  const [submittingProperty, setSubmittingProperty] = useState(false)

  // Document preview
  const [previewDoc, setPreviewDoc] = useState<DocRecord | null>(null)

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('hl_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  /* ── fetch everything from the real API ── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setBackendError('')
    try {
      const headers = authHeaders()

      /* Landlord identity status + property verifications */
      const statusRes = await fetch(`${API_URL}/api/v1/verification/status`, { headers })
      if (statusRes.ok) {
        const json = await statusRes.json()
        if (json.data?.profile) {
          setProfile(json.data.profile)
          setPropertyVerifications(json.data.verifications || [])
        }
      } else if (statusRes.status === 401) {
        setBackendError('Please log in as a landlord to use the verification system.')
      } else if (statusRes.status === 404) {
        setBackendError('No landlord profile found for this account. Your profile may not be set up yet.')
      }

      /* My properties (for property verification form) */
      const propsRes = await fetch(`${API_URL}/api/v1/properties/my`, { headers })
      if (propsRes.ok) {
        const json = await propsRes.json()
        const ps = json.data?.properties || json.data || []
        if (Array.isArray(ps)) setProperties(ps)
      }
    } catch {
      setBackendError('Cannot reach the server. Make sure the backend is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── submit identity documents (real files) ── */
  const handleIdentitySubmit = async () => {
    const missing = IDENTITY_DOCS.filter(d => d.required && !identityFiles[d.value])
    if (missing.length > 0) {
      setMessage({ type: 'error', text: `Please attach: ${missing.map(d => d.label).join(', ')}` })
      return
    }

    setSubmittingIdentity(true)
    setMessage(null)
    try {
      const fd = new FormData()
      const docTypes: string[] = []
      Object.entries(identityFiles).forEach(([type, file]) => {
        fd.append('files', file)
        docTypes.push(type)
      })
      fd.append('docTypes', JSON.stringify(docTypes))

      const res = await fetch(`${API_URL}/api/v1/verification/submit-identity`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage({ type: 'success', text: json.message || 'Documents submitted for review.' })
        setIdentityFiles({})
        fetchData()
      } else {
        setMessage({ type: 'error', text: json.message || `Upload failed (${res.status})` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed — check your connection and try again.' })
    } finally {
      setSubmittingIdentity(false)
    }
  }

  /* ── submit property for verification (real files) ── */
  const handlePropertySubmit = async () => {
    if (!selectedProperty) {
      setMessage({ type: 'error', text: 'Select a property first.' })
      return
    }
    const files = Object.values(propFiles)
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Attach at least one document (property photos are required).' })
      return
    }

    setSubmittingProperty(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('propertyId', selectedProperty)
      const docTypes: string[] = []
      Object.entries(propFiles).forEach(([type, file]) => {
        fd.append('files', file)
        docTypes.push(type)
      })
      fd.append('docTypes', JSON.stringify(docTypes))

      const res = await fetch(`${API_URL}/api/v1/verification/submit`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage({ type: 'success', text: json.message || 'Property submitted for verification.' })
        setShowPropertyForm(false)
        setSelectedProperty('')
        setPropFiles({})
        fetchData()
      } else {
        setMessage({ type: 'error', text: json.message || `Submission failed (${res.status})` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Submission failed — check your connection and try again.' })
    } finally {
      setSubmittingProperty(false)
    }
  }

  /* Resubmit after rejection clears local form state */
  const startResubmit = () => {
    setIdentityFiles({})
    setProfile(prev => prev ? { ...prev, verificationStatus: 'unverified', rejectionReason: undefined } : prev)
  }

  const status = profile?.verificationStatus || 'unverified'
  const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.unverified
  const isVerified = status === 'verified'
  const isPending = status === 'pending'
  const isRejected = status === 'suspended'
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
        {/* Backend error notice */}
        {backendError && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">{backendError}</p>
          </div>
        )}

        {/* Message banner */}
        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <p className="flex-1 text-sm font-medium">{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ═══ STEP 1: IDENTITY VERIFICATION ═══ */}
        <div className="mb-8 rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-charcoal">Step 1: Identity Verification</h2>
              <p className="mt-1 text-sm text-charcoal/60">
                Upload real documents to prove your identity. Tenants trust verified landlords.
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusStyle.cls}`}>
              {statusStyle.label}
            </span>
          </div>

          {/* ── NOT STARTED / RESUBMITTING: upload form ── */}
          {(!profile || status === 'unverified') && (
            <div>
              <p className="mb-3 text-sm font-medium text-charcoal/70">
                Attach your documents (JPG, PNG, or PDF — max {MAX_FILE_MB}MB each):
              </p>
              <div className="space-y-3">
                {IDENTITY_DOCS.map(doc => (
                  <DocumentUploadRow
                    key={doc.value}
                    doc={doc}
                    file={identityFiles[doc.value] || null}
                    onPick={(f) => setIdentityFiles(prev => ({ ...prev, [doc.value]: f }))}
                    onRemove={() => setIdentityFiles(prev => {
                      const next = { ...prev }
                      delete next[doc.value]
                      return next
                    })}
                  />
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleIdentitySubmit}
                  disabled={submittingIdentity}
                  className="rounded-lg bg-rust px-6 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingIdentity ? 'Uploading…' : 'Submit Documents for Verification'}
                </button>
              </div>
            </div>
          )}

          {/* ── PENDING: show submitted real documents ── */}
          {isPending && (
            <div>
              <p className="mb-2 text-sm font-medium text-charcoal/70">Submitted documents (click to view):</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(profile?.submittedDocuments || []).map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewDoc(d)}
                    className="group overflow-hidden rounded-lg border border-charcoal/10 bg-white text-left transition-shadow hover:shadow-md"
                  >
                    {d.mimeType === 'application/pdf' || d.fileKey?.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex h-24 items-center justify-center bg-charcoal/5">
                        <span className="text-xs font-bold text-red-600">PDF</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.fileKey.startsWith('http') ? d.fileKey : `${API_URL}${d.fileKey}`} alt={d.docType} className="h-24 w-full object-cover" />
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-charcoal">{d.docType.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-charcoal/50">
                        {d.originalName || 'file'} · {new Date(d.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">Under review</p>
                <p className="mt-1 text-sm text-amber-700">
                  An admin is reviewing your documents. You will see the decision here and be notified.
                </p>
              </div>
            </div>
          )}

          {/* ── VERIFIED ── */}
          {isVerified && (
            <div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800">Identity verified</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Your documents were approved. You can now list properties and submit them for verification.
                </p>
              </div>
              {(profile?.submittedDocuments || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile!.submittedDocuments!.map((d, i) => (
                    <button key={i} onClick={() => setPreviewDoc(d)} className="rounded border border-charcoal/10 bg-charcoal/5 px-3 py-1.5 text-xs text-charcoal/70 hover:bg-charcoal/10">
                      View {d.docType.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── REJECTED: reason + resubmit ── */}
          {isRejected && (
            <div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Verification rejected</p>
                <p className="mt-1 text-sm text-red-700">
                  {profile?.rejectionReason || 'Your documents were not accepted. Please review the admin notes and resubmit.'}
                </p>
              </div>
              {(profile?.submittedDocuments || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile!.submittedDocuments!.map((d, i) => (
                    <button key={i} onClick={() => setPreviewDoc(d)} className="rounded border border-charcoal/10 bg-charcoal/5 px-3 py-1.5 text-xs text-charcoal/70 hover:bg-charcoal/10">
                      View {d.docType.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={startResubmit}
                className="mt-4 rounded-lg bg-rust px-6 py-2.5 text-sm font-medium text-white hover:bg-rust/90"
              >
                Resubmit Documents
              </button>
            </div>
          )}
        </div>

        {/* ═══ STEP 2: PROPERTY VERIFICATION ═══ */}
        <div className="rounded-xl border border-charcoal/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-charcoal">Step 2: Property Verification</h2>
              <p className="mt-1 text-sm text-charcoal/60">
                Submit each property with real photos and ownership documents. Verified properties earn a trust badge.
              </p>
            </div>
            {!isVerified && (
              <span className="rounded-full bg-charcoal/5 px-3 py-1 text-xs text-charcoal/40">
                Complete Step 1 first
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
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
              <p className="text-xs text-amber-600">Awaiting Verification</p>
            </div>
          </div>

          {isVerified && unverifiedProperties.length > 0 && (
            <button
              onClick={() => setShowPropertyForm(true)}
              className="mb-4 rounded-lg bg-rust px-4 py-2 text-sm font-medium text-white hover:bg-rust/90"
            >
              Submit a Property for Verification
            </button>
          )}

          {!isVerified && (
            <div className="rounded-lg border border-charcoal/10 bg-charcoal/5 p-4 text-center">
              <p className="text-sm text-charcoal/60">
                Your identity must be verified before you can submit properties.
              </p>
            </div>
          )}

          {/* Property verification history */}
          {propertyVerifications.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-medium text-charcoal/70">Property verification history</h3>
              {propertyVerifications.map((pv) => {
                const cfg = STATUS_STYLE[pv.status] || STATUS_STYLE.submitted
                const docs = pv.submittedDocuments || []
                return (
                  <div key={pv.id || pv._id} className="rounded-lg border border-charcoal/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-charcoal">{pv.property?.title || 'Property'}</p>
                        {pv.property?.price && <p className="text-xs text-charcoal/50">ETB {pv.property.price.toLocaleString()}/month</p>}
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    </div>

                    {docs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {docs.map((d, i) => (
                          <button key={i} onClick={() => setPreviewDoc(d)} className="rounded border border-charcoal/10 bg-charcoal/5 px-2.5 py-1 text-xs text-charcoal/70 hover:bg-charcoal/10">
                            {d.docType.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    )}

                    {pv.status === 'rejected' && pv.rejectionReason && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-xs font-medium text-red-800">Rejected — reason:</p>
                        <p className="mt-0.5 text-xs text-red-700">{pv.rejectionReason}</p>
                      </div>
                    )}

                    {pv.auditTrail && pv.auditTrail.length > 0 && (
                      <div className="mt-3 border-t border-charcoal/10 pt-3">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-charcoal/40">History</p>
                        {pv.auditTrail.map((a, i) => (
                          <p key={i} className="text-xs text-charcoal/50">
                            {new Date(a.timestamp).toLocaleString()} — {a.action.replace(/_/g, ' ').toLowerCase()}
                            {a.performedByName ? ` by ${a.performedByName}` : ''}
                            {a.notes ? `: ${a.notes}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ═══ PROPERTY VERIFICATION MODAL (real files) ═══ */}
        {showPropertyForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPropertyForm(false)}>
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-charcoal">Submit Property for Verification</h3>
                <button onClick={() => setShowPropertyForm(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-charcoal/70">Select Property</label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                >
                  <option value="">Choose a property…</option>
                  {unverifiedProperties.map(p => (
                    <option key={p._id} value={p._id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4 space-y-3">
                <label className="block text-sm font-medium text-charcoal/70">Documents (JPG, PNG, or PDF)</label>
                {PROPERTY_DOCS.map(doc => (
                  <DocumentUploadRow
                    key={doc.value}
                    doc={doc}
                    file={propFiles[doc.value] || null}
                    onPick={(f) => setPropFiles(prev => ({ ...prev, [doc.value]: f }))}
                    onRemove={() => setPropFiles(prev => {
                      const next = { ...prev }
                      delete next[doc.value]
                      return next
                    })}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowPropertyForm(false)} className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
                  Cancel
                </button>
                <button
                  onClick={handlePropertySubmit}
                  disabled={submittingProperty || !selectedProperty || Object.keys(propFiles).length === 0}
                  className="flex-1 rounded-lg bg-rust px-4 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingProperty ? 'Uploading…' : 'Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ REAL DOCUMENT VIEWER ═══ */}
      {previewDoc && <DocumentViewer doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
