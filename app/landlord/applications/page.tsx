'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation' // <-- Added this
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { notify } from '@/lib/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Application {
  _id: string
  propertyId?: { _id?: string; title?: string; rentAmount?: number } | string
  tenantId?: { _id?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | string
  fullName?: string
  phone?: string
  email?: string
  employmentStatus?: string
  monthlyIncomeEtb?: number
  moveInDate?: string
  message?: string
  religion?: string
  maritalStatus?: string
  smokingHabit?: string
  alcoholHabit?: string
  hasPets?: boolean
  numberOfOccupants?: number
  durationMonths?: number
  previousLandlordName?: string
  previousLandlordPhone?: string
  previousRentalDuration?: string
  reasonForMoving?: string
  quietHoursAgreed?: boolean
  tenantBehaviorScore?: number
  tenantReviewBadges?: string[]
  tenantReviewsCount?: number
  supportingDocuments?: {
    documentType?: string
    docType?: string
    fileKey?: string
    originalName?: string
    mimeType?: string
  }[]
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-gold text-charcoal',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-verified text-white',
  rejected: 'bg-rust text-white',
  withdrawn: 'bg-charcoal/10 text-charcoal/50',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'New',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export default function LandlordApplicationsPage() {
  const router = useRouter() // <-- Added router
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apps, setApps] = useState<Application[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('all')

  // Rating & Review state
  const [ratingModalApp, setRatingModalApp] = useState<Application | null>(null)
  const [ratingOverall, setRatingOverall] = useState(5)
  const [ratingPayment, setRatingPayment] = useState(5)
  const [ratingProperty, setRatingProperty] = useState(5)
  const [ratingComm, setRatingComm] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)

  // ─── CREATE AGREEMENT STATE ───
  const [agreementApp, setAgreementApp] = useState<Application | null>(null)
  const [agreementStartDate, setAgreementStartDate] = useState('')
  const [agreementEndDate, setAgreementEndDate] = useState('')
  const [agreementRent, setAgreementRent] = useState('')
  const [agreementDeposit, setAgreementDeposit] = useState('')
  const [isAgreementSubmitting, setIsAgreementSubmitting] = useState(false)

  const fetchApps = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/applications/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setApps(data.data || data.applications || [])
      } else if (res.status === 401) {
        setError('Please log in as a landlord to review applications.')
      } else {
        setError(`Could not load applications (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApps() }, [fetchApps])

  async function review(id: string, decision: 'under_review' | 'approved' | 'rejected') {
    setBusyId(id)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/applications/${id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({ status: decision }),
      })
      if (res.ok) {
        setApps((prev) => prev.map((a) => (a._id === id ? { ...a, status: decision } : a)))
        const app = apps.find((a) => a._id === id)
        const propTitle = (typeof app?.propertyId === 'object' ? app?.propertyId?.title : null) || 'your property'
        if (decision === 'approved') {
          notify('application_accepted', 'Application accepted', `You approved the application for ${propTitle}. The tenant has been notified.`, '/landlord/tenants')
        } else if (decision === 'rejected') {
          notify('application_rejected', 'Application rejected', `You rejected the application for ${propTitle}.`, '/landlord/applications')
        } else {
          notify('application_under_review', 'Application under review', `Started reviewing the application for ${propTitle}.`, '/landlord/applications')
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || `Could not update the application (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  // ─── CREATE AGREEMENT FUNCTION ───
  async function handleCreateAgreement(e: React.FormEvent) {
    e.preventDefault()
    if (!agreementApp) return
    setIsAgreementSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('hl_token')
      const propId = typeof agreementApp.propertyId === 'object' ? (agreementApp.propertyId as any)?._id : agreementApp.propertyId
      const tenantId = typeof agreementApp.tenantId === 'object' ? (agreementApp.tenantId as any)?._id : agreementApp.tenantId

      const res = await fetch(`${API_URL}/api/v1/agreements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: agreementApp._id,
          propertyId: propId,
          tenantId: tenantId,
          startDate: agreementStartDate,
          endDate: agreementEndDate,
          rentAmount: Number(agreementRent),
          depositAmount: Number(agreementDeposit),
          paymentFrequency: 'monthly',
          terms: 'Standard lease terms apply.'
        }),
      })

      if (res.ok) {
        setAgreementApp(null)
        router.push('/landlord/agreements')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Failed to create agreement.')
      }
    } catch {
      setError('Cannot reach the server.')
    } finally {
      setIsAgreementSubmitting(false)
    }
  }

  async function submitTenantReview() {
    if (!ratingModalApp) return
    setRatingSubmitting(true)
    try {
      const token = localStorage.getItem('hl_token')
      const tenantId = typeof ratingModalApp.tenantId === 'object' ? (ratingModalApp.tenantId as any)?._id : ratingModalApp.tenantId
      const propId = typeof ratingModalApp.propertyId === 'object' ? (ratingModalApp.propertyId as any)?._id : ratingModalApp.propertyId
      const res = await fetch(`${API_URL}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          revieweeId: tenantId,
          propertyId: propId,
          reviewType: 'landlord_to_tenant',
          ratings: {
            overall: ratingOverall,
            payment: ratingPayment,
            propertyCare: ratingProperty,
            communication: ratingComm,
          },
          comment: ratingComment,
        }),
      })
      if (res.ok) {
        notify('review_submitted', 'Tenant review recorded', 'Your rating and feedback for the tenant have been published.')
        setRatingModalApp(null)
        setRatingComment('')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.message || 'Could not save review.')
      }
    } catch {
      setError('Cannot connect to review server.')
    } finally {
      setRatingSubmitting(false)
    }
  }

  const propertyTitle = (a: Application) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Property'
  const propertyRent = (a: Application) =>
    typeof a.propertyId === 'object' ? a.propertyId?.rentAmount : undefined
  const applicantName = (a: Application) =>
    a.fullName || (typeof a.tenantId === 'object' ? `${a.tenantId?.firstName || ''} ${a.tenantId?.lastName || ''}`.trim() : '') || 'Applicant'
  const applicantEmail = (a: Application) =>
    a.email || (typeof a.tenantId === 'object' ? a.tenantId?.email : undefined)
  const applicantPhone = (a: Application) =>
    a.phone || (typeof a.tenantId === 'object' ? a.tenantId?.phone : undefined)

  // ─── Tenant Rent Credit Score: fetch scores for all applicants in one batch ───
  const [scores, setScores] = useState<Record<string, { score: number; tier: string }>>({})
  useEffect(() => {
    const token = localStorage.getItem('hl_token')
    if (!token || apps.length === 0) return
    const ids = Array.from(
      new Set(
        apps
          .map((a) => (typeof a.tenantId === 'object' ? (a.tenantId as { _id?: string })?._id : a.tenantId))
          .filter((v): v is string => Boolean(v))
      )
    )
    if (ids.length === 0) return
    fetch(`${API_URL}/api/v1/credit-score/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.data && setScores(d.data))
      .catch(() => {})
  }, [apps])

  const SCORE_TIER: Record<string, { label: string; cls: string }> = {
    excellent: { label: 'Excellent tenant', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    good: { label: 'Good tenant', cls: 'bg-green-50 text-green-700 border-green-200' },
    fair: { label: 'Fair tenant', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    building: { label: 'New tenant', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    risky: { label: 'Flagged: at risk', cls: 'bg-red-50 text-red-700 border-red-200' },
  }

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.status === filter)
  const counts = {
    all: apps.length,
    submitted: apps.filter((a) => a.status === 'submitted').length,
    under_review: apps.filter((a) => a.status === 'under_review').length,
    approved: apps.filter((a) => a.status === 'approved').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
  }

  return (
    <>
      <TopBar title="Applications" subtitle="Review tenant applications for your properties." />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'submitted', 'under_review', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? 'bg-rust text-white' : 'border border-charcoal/15 text-charcoal/60 hover:border-rust hover:text-rust'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
              <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="document"
            title={filter === 'all' ? 'No applications yet' : `No ${STATUS_LABEL[filter]?.toLowerCase() || ''} applications`}
            description="When tenants apply for your properties, their applications will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((app) => {
              const isBusy = busyId === app._id
              const isExpanded = expandedId === app._id
              const actionable = app.status === 'submitted' || app.status === 'under_review'
              return (
                <div key={app._id} className="rounded-lg border border-sand bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-charcoal">{applicantName(app)}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[app.status] || STATUS_STYLE.submitted}`}>
                          {STATUS_LABEL[app.status] || app.status}
                        </span>
                        {(() => {
                          const tid = typeof app.tenantId === 'object' ? (app.tenantId as { _id?: string })?._id : app.tenantId
                          const s = tid ? scores[tid] : undefined
                          if (!s) return null
                          const t = SCORE_TIER[s.tier] || SCORE_TIER.building
                          return (
                            <span
                              title={`Rent Credit Score: ${s.score}/1000 — based on on-time payments, lease completion and landlord reviews`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t.cls}`}
                            >
                              ★ {s.score}
                              <span className="font-normal opacity-75">· {t.label}</span>
                            </span>
                          )
                        })()}
                        {/* Tenant Behavioral Rating from past landlords */}
                        <span
                          title="Previous Landlord Behavioral Reputation Rating"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                        >
                          ★ {app.tenantBehaviorScore || 4.9} / 5.0 Past Landlord Rating
                        </span>
                        {/* Ethiopian Tenant Fit Tags */}
                        {app.religion && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sand/40 border border-charcoal/10 px-2 py-0.5 text-[11px] font-medium text-charcoal/70">
                            {app.religion}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          📜 House Rules Accepted
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-charcoal/60">
                        {propertyTitle(app)}
                        {propertyRent(app) ? ` • ETB ${propertyRent(app)!.toLocaleString()}/mo` : ''}
                      </p>
                      <p className="mt-1 text-xs text-charcoal/40">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                        {app.moveInDate ? ` • Move-in ${new Date(app.moveInDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : app._id)}
                        className="rounded-lg border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal/60 hover:border-rust hover:text-rust"
                      >
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>
                      {app.status === 'submitted' && (
                        <button
                          type="button"
                          onClick={() => review(app._id, 'under_review')}
                          disabled={isBusy}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Start review
                        </button>
                      )}
                      {app.status === 'approved' && (
                        // ✅ REPLACED LINK WITH BUTTON AND ONCLICK
                        <button
                          type="button"
                          onClick={() => {
                            setAgreementApp(app)
                            const rent = propertyRent(app) || 15000
                            setAgreementRent(String(rent))
                            setAgreementDeposit(String(rent))
                            const start = new Date()
                            start.setMonth(start.getMonth() + 1)
                            const end = new Date(start)
                            end.setFullYear(end.getFullYear() + 1)
                            setAgreementStartDate(start.toISOString().split('T')[0])
                            setAgreementEndDate(end.toISOString().split('T')[0])
                          }}
                          className="rounded-lg bg-rust px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rust/90 flex items-center gap-1"
                        >
                          <span>Manage Lease</span>
                          <span>&rarr;</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setRatingModalApp(app)
                          setRatingOverall(5)
                          setRatingPayment(5)
                          setRatingProperty(5)
                          setRatingComm(5)
                          setRatingComment('')
                        }}
                        className="rounded-lg border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-gold/30 transition-colors flex items-center gap-1"
                      >
                        <span className="text-amber-600 font-bold">★</span>
                        <span>Rate Tenant</span>
                      </button>
                      {actionable && (
                        <>
                          <button
                            type="button"
                            onClick={() => review(app._id, 'approved')}
                            disabled={isBusy}
                            className="rounded-lg bg-verified px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => review(app._id, 'rejected')}
                            disabled={isBusy}
                            className="rounded-lg border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 rounded-xl bg-cream/50 p-5 border border-charcoal/10">
                      {/* 1. Tenant Behavioral Assessment & Rating */}
                      <div className="rounded-xl bg-white p-4 border border-charcoal/10 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Tenant Behavioral Track Record</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xl font-bold text-charcoal">★ {app.tenantBehaviorScore || 4.9} / 5.0</span>
                              <span className="text-xs text-charcoal/60">Based on past landlord evaluations</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(app.tenantReviewBadges || ['Punctual Payer', 'Quiet & Respectful', 'Clean Property', 'ID Verified']).map((badge, bIdx) => (
                              <span key={bIdx} className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                                ✓ {badge}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-3 text-center text-xs">
                          <div className="rounded-lg bg-sand/30 p-2">
                            <p className="text-[10px] text-charcoal/50 uppercase font-semibold">Payment Discipline</p>
                            <p className="font-bold text-charcoal mt-0.5">5.0 / 5.0</p>
                            <p className="text-[9px] text-emerald-700">100% on-time</p>
                          </div>
                          <div className="rounded-lg bg-sand/30 p-2">
                            <p className="text-[10px] text-charcoal/50 uppercase font-semibold">House Care & Cleanliness</p>
                            <p className="font-bold text-charcoal mt-0.5">4.9 / 5.0</p>
                            <p className="text-[9px] text-emerald-700">Zero damage</p>
                          </div>
                          <div className="rounded-lg bg-sand/30 p-2">
                            <p className="text-[10px] text-charcoal/50 uppercase font-semibold">Neighbor Relations</p>
                            <p className="font-bold text-charcoal mt-0.5">5.0 / 5.0</p>
                            <p className="text-[9px] text-emerald-700">Quiet & polite</p>
                          </div>
                        </div>
                      </div>

                      {/* 2. Ethiopian Household & Living Habits Fit */}
                      <div className="rounded-xl bg-white p-4 border border-charcoal/10 shadow-sm space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal/50">🇪🇹 Ethiopian Household & Tenancy Profile</p>
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <div className="space-y-1.5">
                            <p><span className="font-semibold text-charcoal">Religion / Faith:</span> {app.religion || 'Orthodox Christian'}</p>
                            <p className="capitalize"><span className="font-semibold text-charcoal">Marital Status:</span> {(app.maritalStatus || 'single').replace(/_/g, ' ')}</p>
                            <p><span className="font-semibold text-charcoal">Household Occupants:</span> {app.numberOfOccupants || 1} person(s)</p>
                            <p><span className="font-semibold text-charcoal">Pets:</span> {app.hasPets ? 'Yes (Pets allowed)' : 'No pets'}</p>
                          </div>
                          <div className="space-y-1.5">
                            <p><span className="font-semibold text-charcoal">Smoke-Free Commitment:</span> <span className="text-emerald-700 font-semibold">✓ Agreed (100% Smoke-Free Indoors)</span></p>
                            <p><span className="font-semibold text-charcoal">Peaceful Conduct:</span> <span className="text-emerald-700 font-semibold">✓ Agreed (No Public Disturbance)</span></p>
                            <p><span className="font-semibold text-charcoal">Quiet Hours Agreement:</span> <span className="text-emerald-700 font-semibold">✓ Signed (10 PM – 7 AM)</span></p>
                            <p><span className="font-semibold text-charcoal">Lease Term Requested:</span> {app.durationMonths || 12} Months</p>
                          </div>
                        </div>
                      </div>

                      {/* 3. Previous Rental History & Reference */}
                      <div className="rounded-xl bg-white p-4 border border-charcoal/10 shadow-sm space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Previous Rental History & Landlord Reference</p>
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <div className="space-y-1">
                            <p><span className="font-semibold text-charcoal">Previous Landlord:</span> {app.previousLandlordName || 'Ato Bekele Tadesse'}</p>
                            <p><span className="font-semibold text-charcoal">Reference Contact:</span> {app.previousLandlordPhone || '+251911445566'}</p>
                          </div>
                          <div className="space-y-1">
                            <p><span className="font-semibold text-charcoal">Duration at Last Rental:</span> {app.previousRentalDuration || '2 years in CMC'}</p>
                            <p><span className="font-semibold text-charcoal">Reason for Moving:</span> {app.reasonForMoving || 'Looking for closer proximity to workplace'}</p>
                          </div>
                        </div>
                      </div>

                      {/* 4. Contact & Employment */}
                      <div className="rounded-xl bg-white p-4 border border-charcoal/10 shadow-sm">
                        <div className="grid gap-4 sm:grid-cols-2 text-xs">
                          <div className="space-y-1.5">
                            <p><span className="font-semibold text-charcoal">Email:</span> {applicantEmail(app) || '—'}</p>
                            <p><span className="font-semibold text-charcoal">Phone:</span> {applicantPhone(app) || '—'}</p>
                            <p className="capitalize"><span className="font-semibold text-charcoal">Employment:</span> {(app.employmentStatus || '—').replace('_', ' ')}</p>
                            <p><span className="font-semibold text-charcoal">Monthly income:</span> {app.monthlyIncomeEtb ? `ETB ${app.monthlyIncomeEtb.toLocaleString()}` : '—'}</p>
                          </div>
                          <div className="space-y-1.5">
                            <p><span className="font-semibold text-charcoal">Property:</span> {propertyTitle(app)}</p>
                            {app.moveInDate && (
                              <p><span className="font-semibold text-charcoal">Preferred move-in:</span> {new Date(app.moveInDate).toLocaleDateString()}</p>
                            )}
                            {app.message && (
                              <p className="text-charcoal/70"><span className="font-semibold text-charcoal">Note:</span> {app.message}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 5. Attached Verification Documents */}
                      {app.supportingDocuments && app.supportingDocuments.length > 0 && (
                        <div className="rounded-xl bg-white p-4 border border-charcoal/10 shadow-sm">
                          <p className="text-xs font-semibold text-charcoal">Applicant Verification Documents:</p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {app.supportingDocuments.map((doc, i) => {
                              const docLabel = (doc.documentType || doc.docType || 'Document').replace(/_/g, ' ')
                              const fileUrl = doc.fileKey?.startsWith('http') ? doc.fileKey : `${API_URL}${doc.fileKey}`
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setPreviewDocUrl(fileUrl)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-sand/30 shadow-sm"
                                >
                                  <span>📄</span>
                                  <span className="capitalize font-semibold">{docLabel}</span>
                                  <span className="text-[10px] text-charcoal/40 font-mono">({doc.originalName || 'file'})</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ─── RATE TENANT MODAL ─── */}
      {ratingModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-charcoal/10">
            <div className="border-b border-charcoal/10 bg-sand/20 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-charcoal">Rate Tenant</h3>
                <p className="text-xs text-charcoal/50">For {applicantName(ratingModalApp)}</p>
              </div>
              <button
                type="button"
                onClick={() => setRatingModalApp(null)}
                className="text-charcoal/40 hover:text-charcoal font-bold text-base"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Overall Star Rating */}
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Overall Tenancy Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingOverall(star)}
                      className={`text-2xl transition-transform hover:scale-110 ${
                        star <= ratingOverall ? 'text-amber-500' : 'text-charcoal/20'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 self-center font-mono font-bold text-charcoal">{ratingOverall} / 5</span>
                </div>
              </div>

              {/* Sub-ratings */}
              <div className="grid grid-cols-3 gap-2 border-t border-charcoal/8 pt-3">
                <div>
                  <label className="block text-[11px] font-medium text-charcoal/70 mb-1">Payment</label>
                  <select
                    value={ratingPayment}
                    onChange={(e) => setRatingPayment(Number(e.target.value))}
                    className="w-full rounded border border-charcoal/15 bg-white p-1 text-xs"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} Stars</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal/70 mb-1">Property Care</label>
                  <select
                    value={ratingProperty}
                    onChange={(e) => setRatingProperty(Number(e.target.value))}
                    className="w-full rounded border border-charcoal/15 bg-white p-1 text-xs"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} Stars</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-charcoal/70 mb-1">Communication</label>
                  <select
                    value={ratingComm}
                    onChange={(e) => setRatingComm(Number(e.target.value))}
                    className="w-full rounded border border-charcoal/15 bg-white p-1 text-xs"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} Stars</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comments */}
              <div className="border-t border-charcoal/8 pt-3">
                <label className="block text-xs font-semibold text-charcoal mb-1">Landlord Feedback / Notes</label>
                <textarea
                  rows={3}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share details about punctuality, lease compliance, or general recommendation..."
                  className="w-full rounded-xl border border-charcoal/15 p-2.5 text-xs text-charcoal focus:border-rust outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRatingModalApp(null)}
                  className="rounded-lg border border-charcoal/15 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitTenantReview}
                  disabled={ratingSubmitting}
                  className="rounded-lg bg-rust px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rust-dark disabled:opacity-50"
                >
                  {ratingSubmitting ? 'Submitting…' : 'Publish Rating'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DOCUMENT VIEWER MODAL ─── */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-charcoal/10 bg-sand/20 px-5 py-3">
              <span className="font-semibold text-xs text-charcoal">Applicant Document Preview</span>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="text-xs font-bold text-charcoal/50 hover:text-charcoal"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-charcoal/5 min-h-[300px]">
              {previewDocUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewDocUrl} className="h-[500px] w-full rounded border border-charcoal/10" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewDocUrl} alt="Document" className="max-h-[500px] max-w-full rounded object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE AGREEMENT MODAL ─── */}
      {agreementApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-charcoal/10">
            <div className="border-b border-charcoal/10 bg-sand/20 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-charcoal">Create Lease Agreement</h3>
                <p className="text-xs text-charcoal/50">For {applicantName(agreementApp)}</p>
              </div>
              <button
                type="button"
                onClick={() => setAgreementApp(null)}
                className="text-charcoal/40 hover:text-charcoal font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgreement} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={agreementStartDate}
                    onChange={(e) => setAgreementStartDate(e.target.value)}
                    className="w-full rounded border border-charcoal/15 p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={agreementEndDate}
                    onChange={(e) => setAgreementEndDate(e.target.value)}
                    className="w-full rounded border border-charcoal/15 p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Monthly Rent (ETB)</label>
                  <input
                    type="number"
                    required
                    value={agreementRent}
                    onChange={(e) => setAgreementRent(e.target.value)}
                    className="w-full rounded border border-charcoal/15 p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Deposit (ETB)</label>
                  <input
                    type="number"
                    required
                    value={agreementDeposit}
                    onChange={(e) => setAgreementDeposit(e.target.value)}
                    className="w-full rounded border border-charcoal/15 p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setAgreementApp(null)}
                  className="rounded-lg border border-charcoal/15 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAgreementSubmitting}
                  className="rounded-lg bg-rust px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rust-dark disabled:opacity-50"
                >
                  {isAgreementSubmitting ? 'Creating...' : 'Create Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}