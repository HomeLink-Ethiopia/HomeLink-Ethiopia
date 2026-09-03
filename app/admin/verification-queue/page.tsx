'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import { httpClient } from '@/lib/http-client'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface VerificationRequest {
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
  submittedDocuments: {
    docType: string
    fileKey: string
    uploadedAt: string
  }[]
  reviewNotes?: string
  rejectionReason?: string
  createdAt: string
  verifiedAt?: string
  auditTrail?: {
    action: string
    performedBy: string
    notes: string
    timestamp: string
  }[]
}

/* ─── STATUS CONFIG ──────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  submitted: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '⏳' },
  under_review: { label: 'Under Review', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '🔍' },
  verified: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '❌' },
  more_info_needed: { label: 'More Info', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '📋' },
  suspended: { label: 'Suspended', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '⛔' },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  title_deed: '📄 Title Deed',
  kebele_id: '🪪 Kebele ID',
  utility_bill: '💡 Utility Bill',
  tax_receipt: '🧾 Tax Receipt',
  power_of_attorney: '⚖️ Power of Attorney',
  agency_authorization: '📝 Agency Authorization',
  property_photos: '📸 Property Photos',
}

/* ─── COMPONENT ──────────────────────────────────────────────────────────── */

export default function VerificationQueuePage() {
  const [verifications, setVerifications] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'verified' | 'rejected'>('all')
  const [selectedItem, setSelectedItem] = useState<VerificationRequest | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewAction, setReviewAction] = useState<'verified' | 'rejected'>('verified')
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await httpClient.get('/api/v1/verification/pending')
      if (res.data) {
        setVerifications(res.data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch verifications:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVerifications() }, [fetchVerifications])

  const handleReview = async () => {
    if (!selectedItem) return

    try {
      setProcessing(true)
      setMessage(null)

      const body: any = {
        status: reviewAction,
        reviewNotes: reviewNotes || undefined,
      }
      if (reviewAction === 'rejected' && rejectionReason) {
        body.rejectionReason = rejectionReason
      }

      const res = await httpClient.put(`/api/v1/verification/${selectedItem._id}/review`, body)

      if (res.data) {
        setMessage({
          type: 'success',
          text: reviewAction === 'verified'
            ? `✅ Verification approved for "${selectedItem.propertyId?.title}"`
            : `❌ Verification rejected for "${selectedItem.propertyId?.title}"`
        })
        setShowReviewModal(false)
        setSelectedItem(null)
        setReviewNotes('')
        setRejectionReason('')
        fetchVerifications()
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to process review' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to process review' })
    } finally {
      setProcessing(false)
    }
  }

  const filtered = filter === 'all'
    ? verifications
    : verifications.filter(v => v.status === filter)

  const pendingCount = verifications.filter(v => ['submitted', 'under_review'].includes(v.status)).length

  return (
    <>
      <TopBar title="Verification Queue" />

      <div className="flex-1 px-6 py-8 sm:px-8">
        {/* Message Banner */}
        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <p className="flex-1 text-sm font-medium">{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-charcoal/10 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-charcoal">{verifications.length}</p>
            <p className="text-xs text-charcoal/50">Total Requests</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">
              {verifications.filter(v => v.status === 'verified').length}
            </p>
            <p className="text-xs text-emerald-600">Approved</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">
              {verifications.filter(v => v.status === 'rejected').length}
            </p>
            <p className="text-xs text-red-600">Rejected</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-4 flex items-center gap-2">
          {(['all', 'submitted', 'under_review', 'verified', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-rust text-white'
                  : 'bg-white text-charcoal/60 border border-charcoal/10 hover:bg-charcoal/5'
              }`}
            >
              {f === 'all' ? 'All' : f === 'under_review' ? 'Under Review' : f}
            </button>
          ))}
        </div>

        {/* Verification List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-charcoal/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-charcoal/20 bg-white p-12 text-center">
            <span className="text-4xl">📋</span>
            <h3 className="mt-3 text-lg font-medium text-charcoal">No Verification Requests</h3>
            <p className="mt-1 text-sm text-charcoal/50">
              {filter === 'all' ? 'No landlords have submitted verification requests yet.' : `No ${filter} requests found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.submitted
              return (
                <div
                  key={item._id}
                  className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-charcoal truncate">
                          {item.propertyId?.title || 'Unknown Property'}
                        </h3>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3 text-sm text-charcoal/60">
                        <p>👤 {item.landlordProfileId?.legalName || 'Unknown Landlord'}</p>
                        <p>📞 {item.landlordProfileId?.phone || 'N/A'}</p>
                        <p>💰 ETB {item.propertyId?.price?.toLocaleString() || 'N/A'}/month</p>
                      </div>

                      {item.submittedDocuments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.submittedDocuments.map((doc, i) => (
                            <span key={i} className="inline-block rounded-full bg-charcoal/5 px-2 py-0.5 text-xs text-charcoal/60">
                              {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-2 text-xs text-charcoal/40">
                        Submitted: {new Date(item.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {['submitted', 'under_review'].includes(item.status) && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedItem(item)
                            setReviewAction('verified')
                            setReviewNotes('')
                            setRejectionReason('')
                            setShowReviewModal(true)
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item)
                            setReviewAction('rejected')
                            setReviewNotes('')
                            setRejectionReason('')
                            setShowReviewModal(true)
                          }}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Review Modal */}
        {showReviewModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">
                  {reviewAction === 'verified' ? '✅ Approve Verification' : '❌ Reject Verification'}
                </h3>
                <button onClick={() => setShowReviewModal(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
              </div>

              <div className="mb-4 rounded-lg bg-charcoal/5 p-4">
                <p className="text-sm font-medium text-charcoal">{selectedItem.propertyId?.title}</p>
                <p className="text-xs text-charcoal/50">Landlord: {selectedItem.landlordProfileId?.legalName}</p>
                <p className="text-xs text-charcoal/50">
                  Documents: {selectedItem.submittedDocuments?.length || 0} file(s)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal/70 mb-1">Review Notes (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your review decision..."
                  className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
                  rows={3}
                />
              </div>

              {reviewAction === 'rejected' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-red-700 mb-1">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this verification was rejected (shown to landlord)..."
                    className="w-full rounded-lg border border-red-200 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-charcoal/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={processing || (reviewAction === 'rejected' && !rejectionReason)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    reviewAction === 'verified'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? 'Processing...' : reviewAction === 'verified' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
