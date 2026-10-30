'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface SupportingDocument {
  documentType?: string
  docType?: string
  fileKey?: string
  originalName?: string
  url?: string
}

interface Application {
  _id: string
  propertyId?: {
    _id?: string
    title?: string
    location?: { city?: string; subCity?: string; neighborhood?: string }
    rentAmount?: number
  } | string
  tenantId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  } | string
  landlordId?: {
    _id?: string
    firstName?: string
    lastName?: string
    email?: string
  } | string
  fullName?: string
  phone?: string
  email?: string
  employmentStatus?: string
  monthlyIncome?: number
  monthlyIncomeEtb?: number
  religion?: string
  maritalStatus?: string
  smokingHabit?: string
  alcoholHabit?: string
  numberOfOccupants?: number
  durationMonths?: number
  hasPets?: boolean
  quietHoursAgreed?: boolean
  previousLandlordName?: string
  previousLandlordPhone?: string
  previousRentalDuration?: string
  reasonForMoving?: string
  tenantBehaviorScore?: number
  tenantReviewBadges?: string[]
  supportingDocuments?: SupportingDocument[]
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  createdAt?: string
}

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  withdrawn: 'bg-stone-100 text-stone-600 border-stone-200',
}

const FILTERS = ['all', 'submitted', 'under_review', 'approved', 'rejected'] as const

function fmtEtb(n?: number) {
  return n !== undefined && !isNaN(n) ? `ETB ${n.toLocaleString('en-US')}` : '0 ETB'
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [search, setSearch] = useState('')
  const [inspectApp, setInspectApp] = useState<Application | null>(null)

  const getToken = () => localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/admin/applications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Could not fetch applications')
      const json = await res.json()
      setApplications(json.data || [])
    } catch {
      setError('Could not load tenant applications. Ensure backend is running and you are signed in as administrator.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getApplicantName = (app: Application) => {
    if (app.fullName) return app.fullName
    if (typeof app.tenantId === 'object' && app.tenantId) {
      return `${app.tenantId.firstName || ''} ${app.tenantId.lastName || ''}`.trim() || app.tenantId.email || 'Applicant'
    }
    return 'Applicant'
  }

  const getPropTitle = (app: Application) => {
    if (typeof app.propertyId === 'object' && app.propertyId?.title) return app.propertyId.title
    return 'Rental Home'
  }

  const filtered = applications
    .filter((a) => filter === 'all' || a.status === filter)
    .filter((a) => {
      if (!search.trim()) return true
      const s = search.toLowerCase()
      const name = getApplicantName(a).toLowerCase()
      const prop = getPropTitle(a).toLowerCase()
      const emp = (a.employmentStatus || '').toLowerCase()
      return name.includes(s) || prop.includes(s) || emp.includes(s)
    })

  const submittedCount = applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length
  const approvedCount = applications.filter((a) => a.status === 'approved').length
  const totalIncome = applications.reduce((acc, a) => acc + (a.monthlyIncome || a.monthlyIncomeEtb || 0), 0)
  const avgIncome = applications.length > 0 ? Math.round(totalIncome / applications.length) : 0

  return (
    <>
      <TopBar title="Tenant Applications & Vetting Desk" />
      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-charcoal">Tenant Applications & Vetting</h1>
          <p className="text-sm text-charcoal/60">
            Monitor applicant vetting standards, verified income, Kebele IDs, and landlord decision timelines across Addis Ababa.
          </p>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-charcoal/50">Total Applications</p>
            <p className="mt-1 font-display text-2xl font-bold text-charcoal">{applications.length}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-blue-800">In Review / Submitted</p>
            <p className="mt-1 font-display text-2xl font-bold text-blue-700">{submittedCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-800">Approved Leases</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{approvedCount}</p>
          </div>
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-charcoal/50">Avg Applicant Income</p>
            <p className="mt-1 font-display text-2xl font-bold text-charcoal">{fmtEtb(avgIncome)}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-rust text-white shadow-sm'
                    : 'border border-charcoal/10 bg-white text-charcoal/70 hover:bg-sand'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant, property, employment…"
            className="w-full rounded-lg border border-charcoal/10 bg-white py-2 px-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none sm:w-72"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</p>}

        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No applications found"
            description="No applications match your selected filter or search."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <div className="divide-y divide-charcoal/10">
              {filtered.map((app) => {
                const applicantName = getApplicantName(app)
                const propTitle = getPropTitle(app)
                const income = app.monthlyIncome || app.monthlyIncomeEtb || 0
                const docsCount = app.supportingDocuments?.length || 0

                return (
                  <div key={app._id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-sand/15">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-charcoal">{applicantName}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[app.status] || STATUS_STYLES.withdrawn}`}>
                          {app.status.replace('_', ' ')}
                        </span>
                        {app.tenantBehaviorScore && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            ★ {app.tenantBehaviorScore}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal/60">
                        Applying for: <strong className="text-charcoal">{propTitle}</strong> · Submitted: {fmtDate(app.createdAt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal/70">
                        <span>💼 <strong>Employment:</strong> {app.employmentStatus || 'Employed'}</span>
                        <span>💵 <strong>Income:</strong> {fmtEtb(income)} /mo</span>
                        <span>👥 <strong>Occupants:</strong> {app.numberOfOccupants || 1}</span>
                        <span>📎 <strong>Docs:</strong> {docsCount} attached</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setInspectApp(app)}
                        className="rounded-lg border border-charcoal/15 bg-white px-3.5 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
                      >
                        Inspect Vetting File
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Detailed Application Modal */}
        {inspectApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-charcoal">Tenant Vetting Dossier</h2>
                  <p className="text-xs text-charcoal/50">Applicant: {getApplicantName(inspectApp)} · App ID: {inspectApp._id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectApp(null)}
                  className="rounded-lg p-1.5 text-charcoal/50 hover:bg-sand hover:text-charcoal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Financial overview */}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-sand/30 p-4">
                  <div>
                    <p className="text-charcoal/50">Property Applied</p>
                    <p className="font-semibold text-charcoal">{getPropTitle(inspectApp)}</p>
                    <p className="text-[11px] text-charcoal/60">Duration: {inspectApp.durationMonths || 12} Months</p>
                  </div>
                  <div>
                    <p className="text-charcoal/50">Monthly Income & Status</p>
                    <p className="font-bold text-rust">{fmtEtb(inspectApp.monthlyIncome || inspectApp.monthlyIncomeEtb)} / month</p>
                    <p className="text-[11px] text-charcoal/60 capitalize">{inspectApp.employmentStatus || 'Employed'}</p>
                  </div>
                </div>

                {/* Badges */}
                {inspectApp.tenantReviewBadges && inspectApp.tenantReviewBadges.length > 0 && (
                  <div>
                    <p className="font-semibold text-charcoal">Verified Tenant Badges:</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {inspectApp.tenantReviewBadges.map((b, i) => (
                        <span key={i} className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                          ✓ {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Living profile */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-charcoal/10 p-4">
                  <div>
                    <p className="font-semibold text-charcoal">Living Preferences</p>
                    <p className="mt-1 text-charcoal/70">Family: {inspectApp.maritalStatus || 'Single'}</p>
                    <p className="text-charcoal/70">Occupants: {inspectApp.numberOfOccupants || 1}</p>
                    <p className="text-charcoal/70">Smoking: {inspectApp.smokingHabit || 'Non-smoker'}</p>
                    <p className="text-charcoal/70">Quiet Hours: {inspectApp.quietHoursAgreed ? 'Agreed' : 'Pending'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-charcoal">Prior Landlord Reference</p>
                    <p className="mt-1 text-charcoal/70">Name: {inspectApp.previousLandlordName || 'Provided upon request'}</p>
                    <p className="text-charcoal/70">Phone: {inspectApp.previousLandlordPhone || '—'}</p>
                    <p className="text-charcoal/70">Duration: {inspectApp.previousRentalDuration || '—'}</p>
                    <p className="text-charcoal/70">Reason: {inspectApp.reasonForMoving || 'Closer to work'}</p>
                  </div>
                </div>

                {/* Uploaded Documents */}
                <div>
                  <p className="font-semibold text-charcoal">Submitted Verification Documents:</p>
                  {inspectApp.supportingDocuments && inspectApp.supportingDocuments.length > 0 ? (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {inspectApp.supportingDocuments.map((doc, i) => {
                        const fileHref = doc.url || (doc.fileKey ? `${API_URL}${doc.fileKey}` : '#')
                        return (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white p-2.5">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-charcoal">{doc.originalName || doc.docType || 'Document'}</p>
                              <p className="text-[10px] uppercase text-charcoal/50">{doc.documentType || doc.docType || 'Attachment'}</p>
                            </div>
                            <a
                              href={fileHref}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 rounded bg-rust/10 px-2.5 py-1 text-[11px] font-semibold text-rust hover:bg-rust hover:text-white transition-colors"
                            >
                              View
                            </a>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 italic text-charcoal/50">No files uploaded with this submission.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-charcoal/10 pt-4">
                <button
                  type="button"
                  onClick={() => setInspectApp(null)}
                  className="rounded-lg bg-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal/90"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

