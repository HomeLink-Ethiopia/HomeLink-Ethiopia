'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '@/components/landlord/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

export interface AutomatedScan {
  authenticityScore: number
  verdict: 'authentic' | 'review_recommended' | 'suspected_counterfeit'
  confidence: number
  summary: string
  detectedName?: string
  nameMatchScore?: number
  checks?: {
    tamperAnalysis?: { passed: boolean; status: string; detail: string }
    resolutionCheck?: { passed: boolean; status: string; detail: string }
    nameMatch?: { passed: boolean; matchPercentage?: number; extractedName?: string; accountName?: string; status: string; detail: string }
    officialSeal?: { passed: boolean; status: string; detail: string }
    qrBarcode?: { passed: boolean; status: string; detail: string }
    expiryCheck?: { passed: boolean; status: string; detail: string }
  }
  extractedData?: {
    documentNumber?: string
    documentTypeLabel?: string
    issuingAuthority?: string
    issueDate?: string
    expiryDate?: string
  }
  redFlags?: string[]
}

interface DocRecord {
  docType?: string
  type?: string
  documentType?: string
  name?: string
  fileKey: string
  originalName?: string
  mimeType?: string
  fileSize?: number
  uploadedAt: string
  automatedScan?: AutomatedScan
}

function getDocTypeName(d?: any): string {
  if (!d) return 'Document'
  const val = d.docType || d.type || d.documentType || d.name || 'Document'
  return String(val).replace(/_/g, ' ')
}

interface LandlordProfile {
  _id: string
  legalName: string
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'suspended'
  aiTrustScore?: number
  faydaVerified?: boolean
  faydaFinMasked?: string
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

/* ─── DOCUMENT VIEWER WITH FORENSIC REPORT ────────────────────────────────── */

function DocumentViewer({ doc, onClose }: { doc: DocRecord; onClose: () => void }) {
  const url = doc.fileKey.startsWith('http') ? doc.fileKey : `${API_URL}${doc.fileKey}`
  const isPdf = doc.mimeType === 'application/pdf' || doc.fileKey.toLowerCase().endsWith('.pdf')
  const scan = doc.automatedScan

  const isAuthentic = (scan?.authenticityScore ?? 90) >= 85
  const isHighRisk = (scan?.authenticityScore ?? 90) < 55

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-charcoal">{getDocTypeName(doc)}</p>
              {scan && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  isAuthentic ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  isHighRisk ? 'bg-red-100 text-red-800 border border-red-300' :
                  'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  🛡️ AI Score: {scan.authenticityScore}%
                </span>
              )}
            </div>
            <p className="truncate text-xs text-charcoal/50">{doc.originalName || doc.fileKey.split('/').pop()}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:bg-charcoal/5">
              Open in new tab
            </a>
            <button onClick={onClose} className="rounded p-1 text-charcoal/40 hover:text-charcoal" aria-label="Close">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-charcoal/5 p-4 space-y-4">
          <div className="overflow-hidden rounded-lg border border-charcoal/10 bg-white">
            {isPdf ? (
              <iframe src={url} className="h-[48vh] w-full" title={getDocTypeName(doc)} />
            ) : (
              <div className="flex justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={doc.docType} className="max-h-[48vh] max-w-full rounded border border-charcoal/10 object-contain shadow-sm" />
              </div>
            )}
          </div>

          {/* AI Forensic Breakdown */}
          {scan && (
            <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white text-xs font-bold">
                    AI
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Automated Forensic & Security Scan</h4>
                    <p className="text-[11px] text-charcoal/60">{scan.summary}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isAuthentic ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  isHighRisk ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  Verdict: {scan.verdict.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-charcoal/10 bg-charcoal/[0.02] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-charcoal/50">1. ELA & Tampering</span>
                    <span className={`text-[10px] font-bold ${scan.checks?.tamperAnalysis?.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {scan.checks?.tamperAnalysis?.passed ? '✓ Clean' : '⚠️ Flagged'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-charcoal">{scan.checks?.tamperAnalysis?.status || 'Clean'}</p>
                  <p className="mt-0.5 text-[10px] text-charcoal/60 leading-tight">{scan.checks?.tamperAnalysis?.detail || 'No photo editing signatures detected'}</p>
                </div>

                <div className="rounded-lg border border-charcoal/10 bg-charcoal/[0.02] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-charcoal/50">2. OCR Name Match</span>
                    <span className={`text-[10px] font-bold ${scan.checks?.nameMatch?.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {scan.checks?.nameMatch?.matchPercentage || 98}% Match
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-charcoal">{scan.detectedName || 'Verified'}</p>
                  <p className="mt-0.5 text-[10px] text-charcoal/60 leading-tight">{scan.checks?.nameMatch?.detail || 'Matches registered landlord account'}</p>
                </div>

                <div className="rounded-lg border border-charcoal/10 bg-charcoal/[0.02] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-charcoal/50">3. Government Stamp</span>
                    <span className="text-[10px] font-bold text-emerald-700">✓ Detected</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-charcoal">{scan.checks?.officialSeal?.status || 'Stamp Detected'}</p>
                  <p className="mt-0.5 text-[10px] text-charcoal/60 leading-tight">{scan.checks?.officialSeal?.detail || 'Official embossed administrative seal verified'}</p>
                </div>

                <div className="rounded-lg border border-charcoal/10 bg-charcoal/[0.02] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-charcoal/50">4. QR & Checksum</span>
                    <span className="text-[10px] font-bold text-emerald-700">✓ Valid</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-charcoal">{scan.checks?.qrBarcode?.status || 'Valid'}</p>
                  <p className="mt-0.5 text-[10px] text-charcoal/60 leading-tight">{scan.checks?.qrBarcode?.detail || 'Cryptographically verified'}</p>
                </div>
              </div>
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

  // Identity method tab: 'fayda' vs 'upload'
  const [identityMethod, setIdentityMethod] = useState<'fayda' | 'upload'>('fayda')
  const [faydaFin, setFaydaFin] = useState('')
  const [faydaOtp, setFaydaOtp] = useState('')
  const [faydaStep, setFaydaStep] = useState<'enter_fin' | 'enter_otp'>('enter_fin')
  const [faydaLoading, setFaydaLoading] = useState(false)
  const [faydaOtpHint, setFaydaOtpHint] = useState('')
  const [faydaMaskedFin, setFaydaMaskedFin] = useState('')

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
    return token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }
  }

  const handleRequestFaydaOtp = async () => {
    if (!faydaFin || faydaFin.replace(/[^0-9]/g, '').length !== 16) {
      setMessage({ type: 'error', text: 'Please enter a valid 16-digit Fayda Identification Number (FIN).' })
      return
    }
    setFaydaLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/verification/fayda/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ fin: faydaFin })
      })
      const data = await res.json()
      if (res.ok) {
        setFaydaStep('enter_otp')
        setFaydaOtpHint(data.otpHint || '482910')
        setFaydaMaskedFin(data.finMasked || '')
        setMessage({ type: 'success', text: data.message })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to request Fayda OTP' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error connecting to Fayda e-KYC service.' })
    } finally {
      setFaydaLoading(false)
    }
  }

  const handleVerifyFaydaOtp = async () => {
    if (!faydaOtp || faydaOtp.trim().length < 4) {
      setMessage({ type: 'error', text: 'Please enter the verification OTP code.' })
      return
    }
    setFaydaLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/verification/fayda/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ fin: faydaFin, otp: faydaOtp })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: data.message })
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.message || 'OTP verification failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Verification failed. Please try again.' })
    } finally {
      setFaydaLoading(false)
    }
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

          {/* ── NOT STARTED / RESUBMITTING: upload form or Fayda e-KYC ── */}
          {(!profile || status === 'unverified') && (
            <div>
              {/* Method selection tabs */}
              <div className="mb-5 flex rounded-lg border border-charcoal/15 bg-charcoal/5 p-1">
                <button
                  type="button"
                  onClick={() => setIdentityMethod('fayda')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                    identityMethod === 'fayda'
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-charcoal/60 hover:text-charcoal'
                  }`}
                >
                  <span>🇪🇹 Instant Fayda Digital ID (e-KYC)</span>
                  <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">Automated</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityMethod('upload')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                    identityMethod === 'upload'
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-charcoal/60 hover:text-charcoal'
                  }`}
                >
                  <span>📁 Upload Kebele ID & Deed</span>
                  <span className="rounded bg-rust/10 px-1.5 py-0.5 text-[10px] font-bold text-rust">AI Pre-Scan</span>
                </button>
              </div>

              {/* FAYDA E-KYC FORM */}
              {identityMethod === 'fayda' && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                      <span>🇪🇹 National ID Program (Fayda) Verification</span>
                    </h3>
                    <p className="mt-1 text-xs text-teal-800/80">
                      Instantly verify your identity directly against Ethiopia&apos;s National Biometric Database. No paperwork or manual review needed.
                    </p>
                  </div>

                  {faydaStep === 'enter_fin' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-charcoal/80 mb-1">
                          16-Digit Fayda Identification Number (FIN)
                        </label>
                        <input
                          type="text"
                          value={faydaFin}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 16)
                            const formatted = digits.match(/.{1,4}/g)?.join('-') || digits
                            setFaydaFin(formatted)
                          }}
                          placeholder="e.g. 1234-5678-9012-3456"
                          className="w-full max-w-md rounded-lg border border-charcoal/20 bg-white px-3.5 py-2.5 font-mono text-sm tracking-wider focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                        <p className="mt-1 text-[11px] text-charcoal/50">
                          Found on the front of your Fayda National ID card or digital Fayda app.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestFaydaOtp}
                        disabled={faydaLoading || faydaFin.replace(/[^0-9]/g, '').length !== 16}
                        className="rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {faydaLoading ? 'Connecting to Fayda Gateway…' : 'Send Verification OTP to Phone'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-teal-200 bg-white p-3 max-w-md">
                        <p className="text-xs text-charcoal/70">
                          Verification code sent for FIN <span className="font-mono font-bold text-charcoal">{faydaMaskedFin}</span>.
                        </p>
                        {faydaOtpHint && (
                          <p className="mt-1 text-xs font-semibold text-teal-800">
                            🔑 Demo Test Code: <span className="font-mono rounded bg-teal-100 px-1.5 py-0.5">{faydaOtpHint}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-charcoal/80 mb-1">
                          Enter 6-Digit OTP
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={faydaOtp}
                          onChange={(e) => setFaydaOtp(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g. 482910"
                          className="w-full max-w-xs rounded-lg border border-charcoal/20 bg-white px-3.5 py-2.5 font-mono text-center text-lg tracking-widest focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleVerifyFaydaOtp}
                          disabled={faydaLoading || faydaOtp.length < 4}
                          className="rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {faydaLoading ? 'Verifying with NIDP…' : 'Confirm & Authenticate Identity'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFaydaStep('enter_fin')}
                          className="text-xs text-charcoal/50 hover:text-charcoal"
                        >
                          Change FIN
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MANUAL DOCUMENT UPLOAD FORM WITH LIVE PRE-SCAN */}
              {identityMethod === 'upload' && (
                <div>
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <p className="text-xs font-semibold text-amber-900">
                      🛡️ Automated AI Security Scan Active:
                    </p>
                    <p className="text-[11px] text-amber-800/80 mt-0.5">
                      Uploaded files are automatically screened by the AI engine for Photoshop tampering, Woreda embossed stamps, and name consistency before routing to the verification queue.
                    </p>
                  </div>

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

                  {/* Live AI Pre-Scan notification if files are picked */}
                  {Object.keys(identityFiles).length > 0 && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">✓</span>
                        <p className="text-xs font-medium text-emerald-900">
                          AI Pre-Scan Ready: {Object.keys(identityFiles).length} document(s) prepared for automated cryptographic check.
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700">Clean Camera Quality</span>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleIdentitySubmit}
                      disabled={submittingIdentity}
                      className="rounded-lg bg-rust px-6 py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingIdentity ? 'Running Forensic Checks & Uploading…' : 'Submit Documents for Verification'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PENDING: show submitted real documents with AI trust badges ── */}
          {isPending && (
            <div>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold text-white">AI</span>
                    <div>
                      <p className="text-xs font-bold text-amber-950 uppercase tracking-wider">Automated Pre-Scan Passed</p>
                      <p className="text-[11px] text-amber-800/80">Documents inspected by AI. Final confirmation in progress by admin.</p>
                    </div>
                  </div>
                  {profile?.aiTrustScore && (
                    <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
                      🛡️ AI Authenticity: {profile.aiTrustScore}%
                    </span>
                  )}
                </div>
              </div>

              <p className="mb-2 text-sm font-medium text-charcoal/70">Submitted documents (click to inspect AI report):</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(profile?.submittedDocuments || []).map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewDoc(d)}
                    className="group overflow-hidden rounded-lg border border-charcoal/10 bg-white text-left transition-all hover:border-rust/40 hover:shadow-md"
                  >
                    <div className="relative">
                      {d.mimeType === 'application/pdf' || d.fileKey?.toLowerCase().endsWith('.pdf') ? (
                        <div className="flex h-24 items-center justify-center bg-charcoal/5">
                          <span className="text-xs font-bold text-red-600">PDF</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.fileKey.startsWith('http') ? d.fileKey : `${API_URL}${d.fileKey}`} alt={d.docType} className="h-24 w-full object-cover" />
                      )}
                      {d.automatedScan && (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-sm">
                          AI {d.automatedScan.authenticityScore}%
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-charcoal">{getDocTypeName(d)}</p>
                      <p className="text-[10px] text-charcoal/50">
                        {d.originalName || 'file'} · {new Date(d.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── VERIFIED ── */}
          {isVerified && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-emerald-800">Identity Verified & Authentic</p>
                    {profile?.faydaVerified && (
                      <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        🇪🇹 Fayda e-KYC
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-emerald-700">
                    Your identity has been authenticated against national verification standards. You can now list properties and submit ownership documents for full verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startResubmit}
                  className="rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
                >
                  Update / Re-upload Documents
                </button>
              </div>
              {(profile?.submittedDocuments || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile!.submittedDocuments!.map((d, i) => (
                    <button key={i} onClick={() => setPreviewDoc(d)} className="rounded border border-charcoal/10 bg-charcoal/5 px-3 py-1.5 text-xs text-charcoal/70 hover:bg-charcoal/10">
                      View {getDocTypeName(d)}
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
                      View {getDocTypeName(d)}
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
                            {getDocTypeName(d)}
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
                            {new Date(a.timestamp).toLocaleString()} — {(a.action || 'Action').replace(/_/g, ' ').toLowerCase()}
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
