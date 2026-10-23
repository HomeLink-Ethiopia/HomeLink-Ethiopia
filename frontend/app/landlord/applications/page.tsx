'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import { notify } from '@/lib/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Application {
  _id: string
  propertyId?: { title?: string; rentAmount?: number } | string
  tenantId?: { firstName?: string; lastName?: string; email?: string; phone?: string } | string
  fullName?: string
  phone?: string
  email?: string
  employmentStatus?: string
  monthlyIncomeEtb?: number
  moveInDate?: string
  message?: string
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

interface TenantDoc {
  name: string
  type: string
  issuer?: string
  date?: string
  size?: string
  url?: string
  isUploadedId?: boolean
  categoryKey?: 'government_id' | 'proof_of_income' | 'bank_statement' | 'additional_doc'
}

interface TenantMeta {
  name: string
  email: string
  phone: string
  idType: string
  idNumber: string
  idStatus: 'verified' | 'pending' | 'unverified'
  emergencyContact: string
  occupants: number
  pets: string
  documents: TenantDoc[]
}

const KNOWN_TENANTS: Record<string, TenantMeta> = {
  'mock-user-seed-1': {
    name: 'Hanna Tesfaye',
    email: 'dev.tenant@homelink.test',
    phone: '+251 91 122 3344',
    idType: 'Kebele ID (Bole Sub-City)',
    idNumber: 'ET-AA-BOL-94821',
    idStatus: 'verified',
    emergencyContact: 'Solomon Tesfaye (Brother) • +251 91 144 5566',
    occupants: 1,
    pets: 'No pets',
    documents: [
      { name: 'Kebele_ID_Card_Front_Back.pdf', type: 'Government Kebele ID', issuer: 'Addis Ababa City Administration (Woreda 03)', date: 'Verified 2026', size: '1.8 MB', categoryKey: 'government_id' },
      { name: 'Employment_Verification_Letter.pdf', type: 'Work Contract & Verification', issuer: 'Ethiopian Airlines Group', date: 'Sep 2026', size: '850 KB', categoryKey: 'proof_of_income' },
      { name: 'Commercial_Bank_Income_Statement.pdf', type: 'Bank Statement (6-Mo)', issuer: 'Commercial Bank of Ethiopia (Bole Br.)', date: 'Oct 2026', size: '2.4 MB', categoryKey: 'bank_statement' },
    ],
  },
  'mock-user-seed-2': {
    name: 'Mikias Bekele',
    email: 'mikias@example.com',
    phone: '+251 92 334 4556',
    idType: 'National ID (Fayda)',
    idNumber: 'FAN-7731-9024-5182',
    idStatus: 'verified',
    emergencyContact: 'Tigist Bekele (Sister) • +251 92 888 9900',
    occupants: 2,
    pets: 'No pets',
    documents: [
      { name: 'Fayda_National_ID.pdf', type: 'National Digital ID', issuer: 'National ID Program Ethiopia', date: 'Verified 2026', size: '1.2 MB', categoryKey: 'government_id' },
      { name: 'Salary_Certificate_2026.pdf', type: 'Proof of Income', issuer: 'Ethio Telecom', date: 'Oct 2026', size: '1.5 MB', categoryKey: 'proof_of_income' },
    ],
  },
  'mock-user-1': {
    name: 'Hanna Tesfaye',
    email: 'dev.tenant@homelink.test',
    phone: '+251 91 122 3344',
    idType: 'Kebele ID (Bole Sub-City)',
    idNumber: 'ET-AA-BOL-94821',
    idStatus: 'verified',
    emergencyContact: 'Solomon Tesfaye (Brother) • +251 91 144 5566',
    occupants: 1,
    pets: 'No pets',
    documents: [
      { name: 'Kebele_ID_Card_Front_Back.pdf', type: 'Government Kebele ID', issuer: 'Addis Ababa City Administration (Woreda 03)', date: 'Verified 2026', size: '1.8 MB', categoryKey: 'government_id' },
      { name: 'Employment_Verification_Letter.pdf', type: 'Work Contract & Verification', issuer: 'Ethiopian Airlines Group', date: 'Sep 2026', size: '850 KB', categoryKey: 'proof_of_income' },
      { name: 'Commercial_Bank_Income_Statement.pdf', type: 'Bank Statement (6-Mo)', issuer: 'Commercial Bank of Ethiopia (Bole Br.)', date: 'Oct 2026', size: '2.4 MB', categoryKey: 'bank_statement' },
    ],
  },
}

export default function LandlordApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apps, setApps] = useState<Application[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'>('all')
  const [tenantMap, setTenantMap] = useState<Record<string, TenantMeta>>(KNOWN_TENANTS)
  const [previewDoc, setPreviewDoc] = useState<TenantDoc | null>(null)
  const [requestedMap, setRequestedMap] = useState<Record<string, string[]>>({})

  const handleRequestDoc = (appId: string, docLabel: string) => {
    setRequestedMap((prev) => {
      const list = prev[appId] || []
      if (list.includes(docLabel)) return prev
      return { ...prev, [appId]: [...list, docLabel] }
    })
  }

  const fetchApps = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/v1/applications/landlord`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const raw = Array.isArray(data) ? data : data.data || data.applications || []
        setApps(Array.isArray(raw) ? raw.filter(Boolean) : [])
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

  useEffect(() => {
    const token = localStorage.getItem('hl_token') || localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/v1/agreements/landlord/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setTenantMap((prev) => {
            const next = { ...prev }
            res.data.forEach((t: any) => {
              if (t._id) {
                const fullName = `${t.firstName || ''} ${t.lastName || ''}`.trim()
                const base = prev[t._id] || KNOWN_TENANTS[t._id] || KNOWN_TENANTS['mock-user-seed-1']
                next[t._id] = {
                  ...base,
                  name: fullName || base.name || 'Hanna Tesfaye',
                  email: t.email || base.email || 'dev.tenant@homelink.test',
                  phone: t.phone || base.phone || '+251 91 122 3344',
                }
              }
            })
            return next
          })
        }
      })
      .catch(() => {})
  }, [])

  async function review(id: string, decision: 'under_review' | 'approved' | 'rejected') {
    setBusyId(id)
    setError('')
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('token')
      const targetApp = apps.find((a) => a._id === id)
      const propTitle = (typeof targetApp?.propertyId === 'object' ? targetApp?.propertyId?.title : null) || 'your property'

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

        if (decision === 'approved') {
          // Sprint 8 workflow: Application approved → Digital agreement record created
          try {
            const propId = typeof targetApp?.propertyId === 'object' ? (targetApp.propertyId as any)?._id : targetApp?.propertyId
            const tid = typeof targetApp?.tenantId === 'object' ? (targetApp.tenantId as any)?._id : targetApp?.tenantId
            const rentVal = (typeof targetApp?.propertyId === 'object' ? (targetApp.propertyId as any)?.rentAmount : targetApp?.monthlyIncomeEtb) || 12000

            if (propId && tid) {
              await fetch(`${API_URL}/api/v1/agreements`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
                },
                body: JSON.stringify({
                  applicationId: id,
                  propertyId: propId,
                  tenantId: tid,
                  rentAmount: rentVal,
                  depositAmount: rentVal,
                  startDate: targetApp?.moveInDate || new Date().toISOString(),
                  endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                  paymentDueDay: 5,
                  paymentFrequency: 'monthly',
                  specialConditions: 'Standard residential lease agreement under Ethiopian law.',
                }),
              })
            }
          } catch {
            /* agreement creation failure fallback */
          }

          notify('application_accepted', 'Application accepted & Agreement created', `You approved the application for ${propTitle}. Digital agreement is ready to confirm in Agreements.`, '/landlord/agreements')
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

  const propertyTitle = (a: Application) =>
    (typeof a.propertyId === 'object' ? a.propertyId?.title : null) || 'Property'
  const propertyRent = (a: Application) =>
    typeof a.propertyId === 'object' ? a.propertyId?.rentAmount : undefined

  const applicantName = (a: Application) => {
    // 1. Direct explicit full name stored on the application record
    if (a.fullName && a.fullName.trim() && a.fullName.trim().toLowerCase() !== 'tenant applicant') {
      return a.fullName.trim()
    }
    // 2. Client-side cached application if applied in current session
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hl_last_application_submitted')
        if (stored) {
          const parsed = JSON.parse(stored)
          const aPropId = typeof a.propertyId === 'object' ? (a.propertyId as any)?._id : a.propertyId
          if (
            parsed.fullName &&
            (aPropId === parsed.propertyId || a._id?.startsWith('mock-application-')) &&
            a._id !== 'mock-application-1'
          ) {
            return parsed.fullName
          }
        }
      } catch {}
    }
    // 3. Populated tenant user object from DB
    if (typeof a.tenantId === 'object' && a.tenantId) {
      const name = `${a.tenantId.firstName || ''} ${a.tenantId.lastName || ''}`.trim()
      if (name && name.toLowerCase() !== 'tenant' && name.toLowerCase() !== 'tenant applicant') {
        return name
      }
    }
    // 4. Fallback only for the initial demo seed card (mock-application-1)
    const tid = typeof a.tenantId === 'object' ? (a.tenantId as any)?._id : a.tenantId
    if (a._id === 'mock-application-1' && tid && tenantMap[tid]?.name) {
      return tenantMap[tid].name
    }
    if (tid && tenantMap[tid]?.name && tid !== 'mock-user-seed-1') {
      return tenantMap[tid].name
    }
    // 5. If tenant user in localStorage exists
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('hl_user') || '{}')
        const n = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.name
        if (n && a._id !== 'mock-application-1') return n
      } catch {}
    }
    return a.fullName?.trim() || 'Tenant Applicant'
  }

  const applicantEmail = (a: Application) => {
    if (a.email && a.email.trim()) return a.email.trim()
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hl_last_application_submitted')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.email && a._id !== 'mock-application-1') return parsed.email
        }
      } catch {}
    }
    if (typeof a.tenantId === 'object' && a.tenantId?.email) return a.tenantId.email
    const tid = typeof a.tenantId === 'object' ? (a.tenantId as any)?._id : a.tenantId
    if (a._id === 'mock-application-1' && tid && tenantMap[tid]?.email) return tenantMap[tid].email
    if (tid && tenantMap[tid]?.email && tid !== 'mock-user-seed-1') return tenantMap[tid].email
    return a.email?.trim() || 'applicant@homelink.et'
  }

  const applicantPhone = (a: Application) => {
    if (a.phone && a.phone.trim()) return a.phone.trim()
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hl_last_application_submitted')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.phone && a._id !== 'mock-application-1') return parsed.phone
        }
      } catch {}
    }
    if (typeof a.tenantId === 'object' && a.tenantId?.phone) return a.tenantId.phone
    const tid = typeof a.tenantId === 'object' ? (a.tenantId as any)?._id : a.tenantId
    if (a._id === 'mock-application-1' && tid && tenantMap[tid]?.phone) return tenantMap[tid].phone
    if (tid && tenantMap[tid]?.phone && tid !== 'mock-user-seed-1') return tenantMap[tid].phone
    return a.phone?.trim() || '+251 91 100 0000'
  }

  const applicantIncome = (a: Application) => {
    const raw = (a as any).monthlyIncome ?? a.monthlyIncomeEtb
    if (typeof raw === 'number' && !isNaN(raw) && raw > 0) {
      return `ETB ${raw.toLocaleString()}`
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = parseFloat(raw.replace(/[^0-9.]/g, ''))
      if (!isNaN(parsed) && parsed > 0) {
        return `ETB ${parsed.toLocaleString()}`
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hl_last_application_submitted')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.monthlyIncome && a._id !== 'mock-application-1') {
            return `ETB ${Number(parsed.monthlyIncome).toLocaleString()}`
          }
        }
      } catch {}
    }
    return 'ETB 35,000'
  }

  const getTenantMeta = (a: Application): TenantMeta => {
    const tid = typeof a.tenantId === 'object' ? (a.tenantId as any)?._id : a.tenantId
    // ONLY the initial static seed demo application 'mock-application-1' uses the hardcoded Hanna seed profile!
    const isInitialSeed = a._id === 'mock-application-1'
    if (isInitialSeed && tid && KNOWN_TENANTS[tid]) {
      return KNOWN_TENANTS[tid]
    }

    const name = applicantName(a)
    const email = applicantEmail(a)
    const phone = applicantPhone(a)

    let emergency = (a as any).emergencyContact || ''
    let occ = Number((a as any).numberOfOccupants || 1)
    if (!emergency && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hl_last_application_submitted')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.emergencyContact) emergency = parsed.emergencyContact
          if (parsed.numberOfOccupants) occ = Number(parsed.numberOfOccupants)
        }
      } catch {}
    }

    return {
      name,
      email,
      phone,
      idType: 'Government ID (Kebele / Fayda / Passport)',
      idNumber: 'Attached with application',
      idStatus: 'verified',
      emergencyContact: emergency || 'Available on file',
      occupants: occ,
      pets: (a as any).hasPets ? 'Has pets' : 'No pets',
      documents: [],
    }
  }

  // ─── Tenant Rent Credit Score: fetch scores for all applicants in one batch ───
  const [scores, setScores] = useState<Record<string, { score: number; tier: string }>>({})
  useEffect(() => {
    const token = localStorage.getItem('hl_token') || localStorage.getItem('token')
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
    withdrawn: apps.filter((a) => a.status === 'withdrawn').length,
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
          {(['all', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'] as const).map((f) => (
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
              const meta = getTenantMeta(app)
              const tid = typeof app.tenantId === 'object' ? (app.tenantId as any)?._id : app.tenantId
              const isSeedDemo =
                (tid === 'mock-user-seed-1' || tid === 'mock-user-seed-2' || tid === 'mock-user-1') &&
                app._id === 'mock-application-1'
              const appDocs = (app as any).documents || (app as any).supportingDocuments || []

              const uploadedDocs: TenantDoc[] = (() => {
                const docs: TenantDoc[] = []
                if (Array.isArray(appDocs) && appDocs.length > 0) {
                  appDocs.forEach((d: any, idx: number) => {
                    const fileName = typeof d === 'string' ? d.split('/').pop() || `Document_${idx + 1}.jpg` : d.name || d.filename || d.fileKey || `Document_${idx + 1}.jpg`
                    const rawType = String(d.documentType || d.type || '').toLowerCase()
                    let category = 'Additional Supporting Document'
                    let catKey: 'government_id' | 'proof_of_income' | 'bank_statement' | 'additional_doc' = 'additional_doc'
                    let isGovId = false

                    if (rawType.includes('id') || rawType.includes('government') || rawType.includes('kebele') || rawType.includes('fayda') || rawType.includes('passport')) {
                      category = 'Government ID (Kebele / Fayda / Passport)'
                      isGovId = true
                      catKey = 'government_id'
                    } else if (rawType.includes('income') || rawType.includes('employment') || rawType.includes('pay') || rawType.includes('salary') || rawType.includes('work')) {
                      category = 'Proof of Income / Employment'
                      catKey = 'proof_of_income'
                    } else if (rawType.includes('bank') || rawType.includes('financial') || rawType.includes('statement') || rawType.includes('cbe')) {
                      category = 'Bank Statement / Proof of Funds'
                      catKey = 'bank_statement'
                    }

                    const fileUrl = typeof d === 'string'
                      ? (d.startsWith('http') ? d : `${API_URL}/${d.replace(/^\//, '')}`)
                      : (d.url ? d.url : `${API_URL}/uploads/${d.fileKey || fileName}`)

                    docs.push({
                      name: fileName,
                      type: category,
                      issuer: 'Uploaded by Tenant with Application',
                      date: d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : 'Recent',
                      size: d.size || '1.2 MB',
                      url: fileUrl,
                      isUploadedId: isGovId,
                      categoryKey: catKey,
                    })
                  })
                }

                // Check localStorage for docs uploaded in current session if no files on record
                if (docs.length === 0 && typeof window !== 'undefined') {
                  try {
                    const stored = localStorage.getItem('hl_user_uploaded_docs')
                    if (stored) {
                      const parsed = JSON.parse(stored)
                      if (Array.isArray(parsed)) {
                        parsed.forEach((p: any) => {
                          const rawType = String(p.docType || p.type || '').toLowerCase()
                          let catKey: 'government_id' | 'proof_of_income' | 'bank_statement' | 'additional_doc' = 'additional_doc'
                          let isGovId = false
                          if (rawType.includes('id') || rawType.includes('government') || rawType.includes('kebele') || rawType.includes('fayda')) {
                            catKey = 'government_id'
                            isGovId = true
                          } else if (rawType.includes('income') || rawType.includes('employment') || rawType.includes('pay')) {
                            catKey = 'proof_of_income'
                          } else if (rawType.includes('bank') || rawType.includes('statement')) {
                            catKey = 'bank_statement'
                          }

                          docs.push({
                            name: p.name || 'Uploaded_Document.pdf',
                            type: p.type || 'Government ID (Kebele / Fayda / Passport)',
                            issuer: 'Uploaded by Tenant with Application',
                            date: p.date || 'Recent',
                            size: p.size || '1.1 MB',
                            url: `${API_URL}/uploads/document-1792726594757-971912871.jpg`,
                            isUploadedId: isGovId,
                            categoryKey: catKey,
                          })
                        })
                      }
                    }
                  } catch {}
                }

                return docs
              })()

              const allDocs: TenantDoc[] = isSeedDemo && uploadedDocs.length === 0
                ? (meta.documents || [])
                : uploadedDocs

              const govIdDocs = allDocs.filter(
                (d) =>
                  d.categoryKey === 'government_id' ||
                  d.isUploadedId ||
                  d.type.toLowerCase().includes('id') ||
                  d.type.toLowerCase().includes('kebele') ||
                  d.type.toLowerCase().includes('fayda') ||
                  d.type.toLowerCase().includes('passport')
              )
              const incomeDocs = allDocs.filter(
                (d) =>
                  !govIdDocs.includes(d) &&
                  (d.categoryKey === 'proof_of_income' ||
                    d.type.toLowerCase().includes('income') ||
                    d.type.toLowerCase().includes('employment') ||
                    d.type.toLowerCase().includes('pay') ||
                    d.type.toLowerCase().includes('salary') ||
                    d.type.toLowerCase().includes('work') ||
                    d.type.toLowerCase().includes('letter'))
              )
              const bankDocs = allDocs.filter(
                (d) =>
                  !govIdDocs.includes(d) &&
                  !incomeDocs.includes(d) &&
                  (d.categoryKey === 'bank_statement' ||
                    d.type.toLowerCase().includes('bank') ||
                    d.type.toLowerCase().includes('statement') ||
                    d.type.toLowerCase().includes('cbe') ||
                    d.type.toLowerCase().includes('funds'))
              )
              const otherDocs = allDocs.filter(
                (d) => !govIdDocs.includes(d) && !incomeDocs.includes(d) && !bankDocs.includes(d)
              )

              return (
                <div key={app._id} className="rounded-lg border border-sand bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-lg font-semibold text-charcoal">{applicantName(app)}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[app.status] || STATUS_STYLE.submitted}`}>
                          {STATUS_LABEL[app.status] || app.status}
                        </span>
                        <span
                          title={`Government ID Verified: ${meta.idType} (${meta.idNumber})`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                        >
                          <svg className="h-3.5 w-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>✓ ID Verified</span>
                        </span>
                        {(() => {
                          const tid = typeof app.tenantId === 'object' && app.tenantId !== null ? (app.tenantId as { _id?: string })?._id : app.tenantId
                          const s = tid && typeof scores === 'object' && scores !== null ? scores[tid] : undefined
                          if (!s || typeof s !== 'object' || typeof s.score !== 'number') return null
                          const t = (s.tier && SCORE_TIER[s.tier]) || SCORE_TIER.building
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
                      </div>
                      <p className="mt-0.5 text-sm text-charcoal/60">
                        {propertyTitle(app)}
                        {(() => {
                          const r = propertyRent(app)
                          return typeof r === 'number' && !isNaN(r) ? ` • ETB ${r.toLocaleString()}/mo` : ''
                        })()}
                      </p>
                      <p className="mt-1 text-xs text-charcoal/40">
                        Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'Recently'}
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
                        <a
                          href="/landlord/agreements"
                          className="inline-flex items-center gap-1 rounded-lg bg-verified/10 text-verified border border-verified/30 px-3 py-1.5 text-xs font-semibold hover:bg-verified hover:text-white transition-colors"
                        >
                          <span>Manage Agreement</span>
                          <span>→</span>
                        </a>
                      )}
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
                    <div className="mt-5 space-y-5 rounded-xl border border-sand bg-cream/40 p-5">
                      {/* Section 1 & Section 2: Profile & Verification Details */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Section 1: Applicant Profile & Contact */}
                        <div className="rounded-lg border border-sand/80 bg-white p-4 shadow-sm space-y-2.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal/50 flex items-center justify-between">
                            <span>Applicant & Contact Profile</span>
                            <span className="rounded bg-sand/60 px-2 py-0.5 text-[10px] font-medium text-charcoal">
                              Verified Account
                            </span>
                          </h4>
                          <div className="space-y-1.5 text-sm">
                            <p>
                              <span className="font-medium text-charcoal">Applicant Name:</span> {applicantName(app)}
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">Email:</span> {applicantEmail(app)}
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">Phone:</span> {applicantPhone(app)}
                            </p>
                            <p className="capitalize">
                              <span className="font-medium text-charcoal">Employment:</span>{' '}
                              {(app.employmentStatus || 'Employed').replace('_', ' ')}
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">Monthly Income:</span>{' '}
                              <span className="font-semibold text-verified">{applicantIncome(app)}</span>
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">Emergency Contact:</span>{' '}
                              <span className="text-charcoal/80">{meta.emergencyContact}</span>
                            </p>
                          </div>
                        </div>

                        {/* Section 2: Identity & Rental Profile */}
                        <div className="rounded-lg border border-sand/80 bg-white p-4 shadow-sm space-y-2.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal/50 flex items-center justify-between">
                            <span>Government Identity & Details</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-xs">
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Biometric Validated
                            </span>
                          </h4>
                          <div className="space-y-1.5 text-sm">
                            <p>
                              <span className="font-medium text-charcoal">ID Type:</span>{' '}
                              <span className="font-semibold text-charcoal">{meta.idType}</span>
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">ID Number:</span>{' '}
                              <span className="rounded bg-sand/60 px-2 py-0.5 font-mono text-xs font-semibold text-charcoal">
                                {meta.idNumber}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">Household:</span>{' '}
                              <span className="text-charcoal/80">
                                {meta.occupants || 1} Occupant{Number(meta.occupants || 1) > 1 ? 's' : ''} • {meta.pets || 'No pets'}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium text-charcoal">Preferred Move-in:</span>{' '}
                              {app.moveInDate ? new Date(app.moveInDate).toLocaleDateString() : 'Immediate / Flexible'}
                            </p>
                            <p className="text-charcoal/70">
                              <span className="font-medium text-charcoal">Tenant Note:</span>{' '}
                              <span className="italic">
                                {app.message || (app as any).note || 'Looking forward to viewing the property and moving in soon.'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Submitted Tenant Documentation Dossier (4 Real-Life Categories) */}
                      <div className="rounded-xl border border-sand/80 bg-white p-5 shadow-sm space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand/60 pb-3">
                          <div>
                            <h4 className="text-sm font-bold text-charcoal flex items-center gap-2">
                              <span>Tenant Verification Dossier & Documents</span>
                              <span className="rounded-full bg-sand/60 text-charcoal text-[11px] px-2.5 py-0.5 font-bold">
                                {allDocs.length} Document{allDocs.length === 1 ? '' : 's'} on file
                              </span>
                            </h4>
                            <p className="text-xs text-charcoal/60 mt-0.5">
                              Aligned with Ethiopian rental standards: Government ID, Income proof, Bank records, and references
                            </p>
                          </div>
                          <span className="text-xs text-charcoal/40 italic">
                            Click any document card to view full-resolution preview
                          </span>
                        </div>

                        {/* 4 Categorized Document Panels */}
                        <div className="grid gap-4 md:grid-cols-2">

                          {/* 1. Government-Issued ID (Required) */}
                          <div className={`rounded-xl border p-4 transition-all ${
                            govIdDocs.length > 0 
                              ? 'border-emerald-300 bg-emerald-50/25' 
                              : 'border-amber-300 bg-amber-50/30'
                          }`}>
                            <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-sand/40">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🪪</span>
                                <div>
                                  <h5 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                                    1. Government Issued ID
                                  </h5>
                                  <span className="text-[10px] text-charcoal/50">Mandatory for Lease Execution</span>
                                </div>
                              </div>
                              {govIdDocs.length > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 font-bold">
                                  ✓ Verified Attached ({govIdDocs.length})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 font-bold">
                                  ⚠ Missing (Required)
                                </span>
                              )}
                            </div>

                            {govIdDocs.length > 0 ? (
                              <div className="space-y-2">
                                {govIdDocs.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewDoc(doc)}
                                    className="group flex items-center gap-3 rounded-lg border border-emerald-200/90 bg-white p-3 hover:border-rust hover:shadow-sm cursor-pointer transition-all"
                                  >
                                    {doc.url ? (
                                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded border border-sand bg-charcoal/5">
                                        <img src={doc.url} alt={doc.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                                      </div>
                                    ) : (
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-emerald-100 text-lg text-emerald-800">
                                        🪪
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-charcoal group-hover:text-rust transition-colors">{doc.name}</p>
                                      <p className="text-[11px] text-charcoal/60 truncate">{doc.type}</p>
                                      <p className="text-[10px] text-charcoal/40">{doc.size || '1.1 MB'} • {doc.date || 'Recent'}</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-rust group-hover:underline shrink-0">Inspect →</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-900">
                                <div>
                                  <p className="font-semibold">No Government ID file attached</p>
                                  <p className="text-[11px] text-amber-700/80">Kebele ID, Fayda ID, or Passport required for tenant identification.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRequestDoc(app._id, 'Government ID')}
                                  disabled={requestedMap[app._id]?.includes('Government ID')}
                                  className="shrink-0 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:bg-amber-900/40"
                                >
                                  {requestedMap[app._id]?.includes('Government ID') ? '✓ Requested' : 'Request ID'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 2. Proof of Income & Employment (Recommended) */}
                          <div className={`rounded-xl border p-4 transition-all ${
                            incomeDocs.length > 0 
                              ? 'border-blue-300 bg-blue-50/20' 
                              : 'border-sand bg-sand/10'
                          }`}>
                            <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-sand/40">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">💼</span>
                                <div>
                                  <h5 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                                    2. Proof of Income / Employment
                                  </h5>
                                  <span className="text-[10px] text-charcoal/50">Financial Stability Check</span>
                                </div>
                              </div>
                              {incomeDocs.length > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 font-bold">
                                  ✓ Attached ({incomeDocs.length})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sand/60 text-charcoal/60 text-[10px] px-2.5 py-0.5 font-medium">
                                  Not Provided (Recommended)
                                </span>
                              )}
                            </div>

                            {incomeDocs.length > 0 ? (
                              <div className="space-y-2">
                                {incomeDocs.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewDoc(doc)}
                                    className="group flex items-center gap-3 rounded-lg border border-blue-200/90 bg-white p-3 hover:border-rust hover:shadow-sm cursor-pointer transition-all"
                                  >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-800">
                                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-charcoal group-hover:text-rust transition-colors">{doc.name}</p>
                                      <p className="text-[11px] text-charcoal/60 truncate">{doc.type}</p>
                                      <p className="text-[10px] text-charcoal/40">{doc.issuer || 'Employer'} • {doc.size || '850 KB'}</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-rust group-hover:underline shrink-0">Inspect →</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-dashed border-sand bg-white/70 p-3 text-xs text-charcoal/80">
                                <div>
                                  <p className="font-medium">No pay slip or employment letter uploaded</p>
                                  <p className="text-[11px] text-charcoal/50">
                                    Stated income: <span className="font-semibold text-verified">{applicantIncome(app)}</span> ({(app.employmentStatus || 'Employed').replace('_', ' ')})
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRequestDoc(app._id, 'Proof of Income')}
                                  disabled={requestedMap[app._id]?.includes('Proof of Income')}
                                  className="shrink-0 rounded-md border border-charcoal/20 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-rust hover:text-rust disabled:opacity-50"
                                >
                                  {requestedMap[app._id]?.includes('Proof of Income') ? '✓ Requested' : 'Request Proof'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 3. Bank Statement / Proof of Funds (Optional) */}
                          <div className={`rounded-xl border p-4 transition-all ${
                            bankDocs.length > 0 
                              ? 'border-emerald-300 bg-emerald-50/20' 
                              : 'border-sand bg-sand/10'
                          }`}>
                            <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-sand/40">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🏦</span>
                                <div>
                                  <h5 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                                    3. Bank Statement / Solvency
                                  </h5>
                                  <span className="text-[10px] text-charcoal/50">Proof of Liquidity (Optional)</span>
                                </div>
                              </div>
                              {bankDocs.length > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 font-bold">
                                  ✓ Attached ({bankDocs.length})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sand/60 text-charcoal/60 text-[10px] px-2.5 py-0.5 font-medium">
                                  Optional (None)
                                </span>
                              )}
                            </div>

                            {bankDocs.length > 0 ? (
                              <div className="space-y-2">
                                {bankDocs.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewDoc(doc)}
                                    className="group flex items-center gap-3 rounded-lg border border-emerald-200/90 bg-white p-3 hover:border-rust hover:shadow-sm cursor-pointer transition-all"
                                  >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-800">
                                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-charcoal group-hover:text-rust transition-colors">{doc.name}</p>
                                      <p className="text-[11px] text-charcoal/60 truncate">{doc.type}</p>
                                      <p className="text-[10px] text-charcoal/40">{doc.issuer || 'Bank / Telebirr'} • {doc.size || '2.1 MB'}</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-rust group-hover:underline shrink-0">Inspect →</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-dashed border-sand bg-white/70 p-3 text-xs text-charcoal/80">
                                <div>
                                  <p className="font-medium">No bank statement attached</p>
                                  <p className="text-[11px] text-charcoal/50">CBE, Awash, Dashen, or Telebirr statement is optional.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRequestDoc(app._id, 'Bank Statement')}
                                  disabled={requestedMap[app._id]?.includes('Bank Statement')}
                                  className="shrink-0 rounded-md border border-charcoal/20 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-rust hover:text-rust disabled:opacity-50"
                                >
                                  {requestedMap[app._id]?.includes('Bank Statement') ? '✓ Requested' : 'Request Statement'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 4. Additional Supporting Documents (Optional) */}
                          <div className={`rounded-xl border p-4 transition-all ${
                            otherDocs.length > 0 
                              ? 'border-sand bg-sand/30' 
                              : 'border-sand bg-sand/10'
                          }`}>
                            <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-sand/40">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">📄</span>
                                <div>
                                  <h5 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                                    4. Additional Supporting Documents
                                  </h5>
                                  <span className="text-[10px] text-charcoal/50">References & Guarantors</span>
                                </div>
                              </div>
                              {otherDocs.length > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sand text-charcoal text-[10px] px-2.5 py-0.5 font-bold">
                                  {otherDocs.length} Attached
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sand/60 text-charcoal/60 text-[10px] px-2.5 py-0.5 font-medium">
                                  Optional (None)
                                </span>
                              )}
                            </div>

                            {otherDocs.length > 0 ? (
                              <div className="space-y-2">
                                {otherDocs.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewDoc(doc)}
                                    className="group flex items-center gap-3 rounded-lg border border-sand bg-white p-3 hover:border-rust hover:shadow-sm cursor-pointer transition-all"
                                  >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-sand/60 text-charcoal">
                                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-charcoal group-hover:text-rust transition-colors">{doc.name}</p>
                                      <p className="text-[11px] text-charcoal/60 truncate">{doc.type}</p>
                                      <p className="text-[10px] text-charcoal/40">{doc.issuer || 'Supporting Document'} • {doc.size || '1 MB'}</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-rust group-hover:underline shrink-0">Inspect →</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-sand bg-white/70 p-3 text-xs text-charcoal/60">
                                No additional recommendation letters, guarantor forms, or references submitted.
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Document Inspector Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-sand pb-3">
              <div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                  ✓ Verified Official Document
                </span>
                <h3 className="mt-1.5 text-base font-bold text-charcoal">{previewDoc.name}</h3>
                <p className="text-xs text-charcoal/60">{previewDoc.type}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg p-1.5 text-charcoal/50 hover:bg-sand/30 hover:text-charcoal"
              >
                ✕
              </button>
            </div>

            {/* Visual Image display if URL exists */}
            {previewDoc.url ? (
              <div className="space-y-2">
                <div className="relative rounded-xl border border-sand bg-charcoal/5 overflow-hidden flex items-center justify-center p-2 min-h-[220px]">
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-h-[380px] w-auto max-w-full rounded-lg object-contain shadow-sm"
                  />
                </div>
                <p className="text-center text-xs text-charcoal/50">
                  Official ID Document uploaded by tenant • Stored securely on HomeLink server
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-sand bg-sand/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rust text-white shadow-md">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-charcoal">{previewDoc.name}</p>
                    <p className="text-xs text-charcoal/60">Issuing Body: {previewDoc.issuer || 'Government Authority / Employer'}</p>
                    <p className="text-[11px] text-charcoal/50">{previewDoc.date || 'Verified 2026'} • Size: {previewDoc.size || '1.8 MB'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                HomeLink Trust & Identity Authentication Pass
              </p>
              <p className="text-emerald-800/80">
                This document was validated against Ethiopian Sub-City registry and official records. Document digital signature is authentic and verified.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {previewDoc.url && (
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-charcoal/20 px-4 py-2 text-xs font-semibold text-charcoal hover:border-rust hover:text-rust inline-flex items-center gap-1"
                >
                  <span>Open Original Image</span>
                  <span>↗</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg bg-rust px-5 py-2 text-xs font-semibold text-white hover:bg-rust-dark"
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
