'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface DocRecord {
  docType: string
  fileKey: string
  originalName?: string
  mimeType?: string
  uploadedAt: string
}

interface LandlordIdentity {
  _id: string
  accountId?: { email?: string; phone?: string }
  legalName: string
  phone?: string
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'suspended'
  submittedDocuments?: DocRecord[]
  rejectionReason?: string
  createdAt: string
  updatedAt?: string
  auditTrail?: { action: string; performedByName?: string; notes: string; timestamp: string }[]
}

interface PropertyVerification {
  _id: string
  propertyId?: { _id: string; title: string; address?: string; price?: number }
  landlordProfileId?: { _id: string; legalName: string; phone?: string }
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'more_info_needed' | 'suspended'
  submittedDocuments: DocRecord[]
  reviewNotes?: string
  rejectionReason?: string
  createdAt: string
  verifiedAt?: string
  auditTrail?: { action: string; performedByName?: string; notes: string; timestamp: string }[]
}

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  unverified: { label: 'Not Started', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  pending: { label: 'Pending', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  submitted: { label: 'Pending', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  under_review: { label: 'Under Review', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  verified: { label: 'Approved', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
  more_info_needed: { label: 'More Info', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  suspended: { label: 'Rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
}

const REJECTION_REASONS = [
  'Document image is blurry or unreadable',
  'Document appears to be edited or forged',
  'Name on document does not match account name',
  'Document is expired',
  'Ownership document does not match the listed property',
  'Incomplete document — part of the page is missing',
  'Possible duplicate or previously rejected submission',
]

/* ─── REAL DOCUMENT VIEWER ───────────────────────────────────────────────── */

function DocumentViewer({ doc, onClose }: { doc: DocRecord; onClose: () => void }) {
  const url = doc.fileKey.startsWith('http') ? doc.fileKey : `${API_URL}${doc.fileKey}`
  const isPdf = doc.mimeType === 'application/pdf' || doc.fileKey.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal">{doc.docType.replace(/_/g, ' ')}</p>
            <p className="truncate text-xs text-charcoal/50">
              {doc.originalName || doc.fileKey.split('/').pop()} · uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
            </p>
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

/* ─── AUDIT TRAIL BLOCK ──────────────────────────────────────────────────── */

function AuditTrail({ trail }: { trail: AuditEntry[] }) {
  if (!trail || trail.length === 0) return null
  return (
    <div className="mt-3 rounded-lg bg-charcoal/[0.03] p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Audit trail</p>
      <div className="space-y-1.5">
        {trail.map((a, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-charcoal/30" />
            <p className="text-charcoal/60">
              <span className="font-medium text-charcoal/80">{new Date(a.timestamp).toLocaleString()}</span>
              {' — '}
              {(a.action || '').replace(/_/g, ' ').toLowerCase()}
              {a.performedByName ? ` by ${a.performedByName}` : ''}
              {a.notes ? ` — ${a.notes}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface AuditEntry {
  action: string
  performedByName?: string
  notes: string
  timestamp: string
}

/* ─── REVIEW MODAL ───────────────────────────────────────────────────────── */

function ReviewModal({
  kind, item, onClose, onDone,
}: {
  kind: 'landlord' | 'property'
  item: LandlordIdentity | PropertyVerification
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [action, setAction] = useState<'verified' | 'rejected'>('verified')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const name = kind === 'landlord'
    ? (item as LandlordIdentity).legalName
    : (item as PropertyVerification).propertyId?.title || 'Property'

  const submit = async () => {
    if (action === 'rejected' && !reason) {
      setError('A rejection reason is required.')
      return
    }
    setProcessing(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const url = kind === 'landlord'
        ? `${API_URL}/api/v1/verification/landlord/${item._id}/review`
        : `${API_URL}/api/v1/verification/${item._id}/review`

      const body = action === 'rejected'
        ? { status: action, rejectionReason: reason, reviewNotes: notes || undefined }
        : { status: action, reviewNotes: notes || undefined }

      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        onDone(`${action === 'verified' ? 'Approved' : 'Rejected'}: ${name}`)
      } else {
        setError(json.message || `Request failed (${res.status})`)
      }
    } catch {
      setError('Could not reach the server.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-charcoal">
              {action === 'verified' ? 'Approve' : 'Reject'}
            </h3>
            <p className="mt-0.5 text-sm text-charcoal/60">{name}</p>
          </div>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal">✕</button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setAction('verified')}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              action === 'verified' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-charcoal/15 text-charcoal/60 hover:bg-charcoal/5'
            }`}
          >
            Approve
          </button>
          <button
            onClick={() => setAction('rejected')}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              action === 'rejected' ? 'border-red-500 bg-red-50 text-red-700' : 'border-charcoal/15 text-charcoal/60 hover:bg-charcoal/5'
            }`}
          >
            Reject
          </button>
        </div>

        {action === 'rejected' && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-charcoal/70">
              Rejection reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
            >
              <option value="">Select a reason…</option>
              {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-charcoal/70">Internal notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Visible only to admins in the audit trail"
            className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={processing}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              action === 'verified' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {processing ? 'Saving…' : `Confirm ${action === 'verified' ? 'Approval' : 'Rejection'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────── */

export default function VerificationWorkbench({ scope = 'all', title = 'Verification Queue' }: { scope?: 'all' | 'landlords' | 'properties'; title?: string }) {
  const [activeTab, setActiveTab] = useState<'landlords' | 'properties'>(scope === 'properties' ? 'properties' : 'landlords')
  const [landlords, setLandlords] = useState<LandlordIdentity[]>([])
  const [properties, setProperties] = useState<PropertyVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState('')

  const [landlordFilter, setLandlordFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'submitted' | 'verified' | 'rejected'>('all')

  const [reviewTarget, setReviewTarget] = useState<{ kind: 'landlord' | 'property'; item: LandlordIdentity | PropertyVerification } | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocRecord | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setBackendError('')
    try {
      const token = localStorage.getItem('hl_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }

      const res = await fetch(`${API_URL}/api/v1/verification/pending`, { headers })
      if (res.ok) {
        const json = await res.json()
        setLandlords(json.data?.landlords || [])
        setProperties(json.data?.properties || [])
      } else if (res.status === 401) {
        setBackendError('Please log in as an admin to view the verification queue.')
      } else {
        setBackendError(`Could not load verifications (${res.status}).`)
      }
    } catch {
      setBackendError('Cannot reach the server. Make sure the backend is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pendingLandlordCount = landlords.filter(l => l.verificationStatus === 'pending').length
  const pendingPropertyCount = properties.filter(p => ['submitted', 'under_review'].includes(p.status)).length

  const filteredLandlords = landlordFilter === 'all'
    ? landlords
    : landlords.filter(l => landlordFilter === 'rejected' ? l.verificationStatus === 'suspended' : l.verificationStatus === landlordFilter)

  const filteredProperties = propertyFilter === 'all'
    ? properties
    : properties.filter(p => propertyFilter === 'rejected' ? p.status === 'rejected' : p.status === propertyFilter)

  return (
    <>
      <TopBar title={title} />

      <div className="flex-1 px-6 py-8 sm:px-8">
        {backendError && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">{backendError}</p>
          </div>
        )}

        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
            message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <p className="flex-1 text-sm font-medium">{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Stats */}
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

        {/* Tabs — only on the combined queue; focused pages show their own scope */}
        {scope === 'all' && (<div
          className="mb-4 flex items-center gap-1 border-b border-charcoal/10"
        >
          <button
            onClick={() => setActiveTab('landlords')}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'landlords' ? 'border-rust text-rust' : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            Landlord Identity
            {pendingLandlordCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{pendingLandlordCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'properties' ? 'border-rust text-rust' : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            Property Verification
            {pendingPropertyCount > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{pendingPropertyCount}</span>}
          </button>
        </div>) }

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-charcoal/5" />)}
          </div>
        ) : (
          <>
            {/* ═══ LANDLORD IDENTITY TAB ═══ */}
            {activeTab === 'landlords' && (
              <>
                <div className="mb-3 flex items-center gap-2">
                  {(['all', 'pending', 'verified', 'rejected'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setLandlordFilter(f)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        landlordFilter === f ? 'bg-rust text-white' : 'border border-charcoal/10 bg-white text-charcoal/60 hover:bg-charcoal/5'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {filteredLandlords.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-charcoal/20 bg-white p-12 text-center">
                    <p className="text-lg font-medium text-charcoal">No landlord verifications</p>
                    <p className="mt-1 text-sm text-charcoal/50">Landlords who submit identity documents will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLandlords.map((l) => {
                      const cfg = STATUS_STYLE[l.verificationStatus] || STATUS_STYLE.pending
                      const docs = l.submittedDocuments || []
                      const isPending = l.verificationStatus === 'pending'
                      return (
                        <div key={l._id} className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-charcoal">{l.legalName}</p>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                              </div>
                              <p className="mt-1 text-xs text-charcoal/50">
                                {l.accountId?.email || 'no email'} {l.phone ? `· ${l.phone}` : ''}
                              </p>
                              <p className="mt-0.5 text-xs text-charcoal/40">
                                Submitted {new Date(l.updatedAt || l.createdAt).toLocaleString()}
                              </p>
                            </div>

                            {isPending && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setReviewTarget({ kind: 'landlord', item: l })}
                                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                                >
                                  Review
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Real document thumbnails */}
                          {docs.length > 0 ? (
                            <div className="mt-3">
                              <p className="mb-1.5 text-xs font-medium text-charcoal/50">Documents ({docs.length}) — click to view full size:</p>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {docs.map((d, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setPreviewDoc(d)}
                                    className="group overflow-hidden rounded-lg border border-charcoal/10 bg-white text-left transition-shadow hover:shadow-md"
                                  >
                                    {d.mimeType === 'application/pdf' || d.fileKey?.toLowerCase().endsWith('.pdf') ? (
                                      <div className="flex h-20 items-center justify-center bg-charcoal/5">
                                        <span className="text-xs font-bold text-red-600">PDF</span>
                                      </div>
                                    ) : (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={d.fileKey.startsWith('http') ? d.fileKey : `${API_URL}${d.fileKey}`} alt={d.docType} className="h-20 w-full object-cover" />
                                    )}
                                    <div className="p-1.5">
                                      <p className="truncate text-[10px] font-medium text-charcoal">{d.docType.replace(/_/g, ' ')}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs italic text-charcoal/40">No documents attached.</p>
                          )}

                          {l.verificationStatus === 'suspended' && l.rejectionReason && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                              <p className="text-xs font-medium text-red-800">Rejected — reason:</p>
                              <p className="mt-0.5 text-xs text-red-700">{l.rejectionReason}</p>
                            </div>
                          )}

                          <AuditTrail trail={l.auditTrail || []} />
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
                        propertyFilter === f ? 'bg-rust text-white' : 'border border-charcoal/10 bg-white text-charcoal/60 hover:bg-charcoal/5'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {filteredProperties.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-charcoal/20 bg-white p-12 text-center">
                    <p className="text-lg font-medium text-charcoal">No property verifications</p>
                    <p className="mt-1 text-sm text-charcoal/50">Property submissions from verified landlords will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProperties.map((pv) => {
                      const cfg = STATUS_STYLE[pv.status] || STATUS_STYLE.submitted
                      const docs = pv.submittedDocuments || []
                      const isPending = ['submitted', 'under_review', 'more_info_needed'].includes(pv.status)
                      return (
                        <div key={pv._id} className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-charcoal">{pv.propertyId?.title || 'Property'}</p>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                              </div>
                              <p className="mt-1 text-xs text-charcoal/50">
                                {pv.landlordProfileId?.legalName || 'Unknown landlord'}
                                {pv.propertyId?.address ? ` · ${pv.propertyId.address}` : ''}
                                {pv.propertyId?.price ? ` · ETB ${pv.propertyId.price.toLocaleString()}/month` : ''}
                              </p>
                              <p className="mt-0.5 text-xs text-charcoal/40">
                                Submitted {new Date(pv.createdAt).toLocaleString()}
                              </p>
                            </div>

                            {isPending && (
                              <button
                                onClick={() => setReviewTarget({ kind: 'property', item: pv })}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                              >
                                Review
                              </button>
                            )}
                          </div>

                          {/* Real document thumbnails */}
                          {docs.length > 0 && (
                            <div className="mt-3">
                              <p className="mb-1.5 text-xs font-medium text-charcoal/50">Documents ({docs.length}) — click to view full size:</p>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {docs.map((d, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setPreviewDoc(d)}
                                    className="group overflow-hidden rounded-lg border border-charcoal/10 bg-white text-left transition-shadow hover:shadow-md"
                                  >
                                    {d.mimeType === 'application/pdf' || d.fileKey?.toLowerCase().endsWith('.pdf') ? (
                                      <div className="flex h-20 items-center justify-center bg-charcoal/5">
                                        <span className="text-xs font-bold text-red-600">PDF</span>
                                      </div>
                                    ) : (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={d.fileKey.startsWith('http') ? d.fileKey : `${API_URL}${d.fileKey}`} alt={d.docType} className="h-20 w-full object-cover" />
                                    )}
                                    <div className="p-1.5">
                                      <p className="truncate text-[10px] font-medium text-charcoal">{d.docType.replace(/_/g, ' ')}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {pv.status === 'rejected' && pv.rejectionReason && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                              <p className="text-xs font-medium text-red-800">Rejected — reason:</p>
                              <p className="mt-0.5 text-xs text-red-700">{pv.rejectionReason}</p>
                            </div>
                          )}

                          <AuditTrail trail={pv.auditTrail || []} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          kind={reviewTarget.kind}
          item={reviewTarget.item}
          onClose={() => setReviewTarget(null)}
          onDone={(msg) => {
            setMessage({ type: 'success', text: msg })
            setReviewTarget(null)
            fetchData()
          }}
        />
      )}

      {/* Real document viewer */}
      {previewDoc && <DocumentViewer doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
