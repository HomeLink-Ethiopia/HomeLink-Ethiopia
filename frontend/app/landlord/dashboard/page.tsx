'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import TopBar from '@/components/landlord/TopBar'
import InitialsAvatar from '@/components/shared/InitialsAvatar'
import { useAuth } from '@/lib/auth-context'
import { resolveImageUrl } from '@/lib/image-url'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
interface PropertyLocation {
  city?: string
  subCity?: string
  neighborhood?: string
  address?: string
}

interface PropertyItem {
  _id: string
  title: string
  location?: string | PropertyLocation
  address?: string
  rentAmount?: number
  price?: number
  images?: Array<string | { url?: string; key?: string; isPrimary?: boolean }>
  verificationStatus?: string
  listingStatus?: string
  currentTenantId?: unknown
}

function formatLocation(loc: unknown, address?: unknown, fallback = 'Addis Ababa'): string {
  if (typeof loc === 'string' && loc.trim()) return loc
  if (loc && typeof loc === 'object') {
    const l = loc as PropertyLocation
    const parts = [l.neighborhood, l.subCity, l.city].filter(Boolean)
    if (parts.length > 0) return parts.join(', ')
    if (l.address && typeof l.address === 'string') return l.address
  }
  if (typeof address === 'string' && address.trim()) return address
  return fallback
}

interface PaymentItem {
  _id: string
  amount?: number
  amountDue?: number
  amountPaid?: number
  dueDate?: string
  paidAt?: string
  paidDate?: string
  status: string
  periodMonth?: string
  tenantId?: { firstName?: string; lastName?: string; email?: string } | string
  propertyId?: { title?: string; _id?: string } | string
}

interface AgreementItem {
  _id: string
  status: string
  rentAmount?: number
  monthlyRentEtb?: number
  propertyId?: { _id?: string; title?: string } | string
  tenantId?: { _id?: string; firstName?: string; lastName?: string } | string
}

interface TicketItem {
  _id: string
  issue?: string
  title?: string
  priority?: string
  status?: string
  createdAt?: string
}

interface ApplicationItem {
  _id: string
  fullName?: string
  employmentStatus?: string
  monthlyIncomeEtb?: number
  monthlyIncome?: number
  status: string
  createdAt: string
  tenantId?: { firstName?: string; lastName?: string; email?: string } | string
  propertyId?: { title?: string; _id?: string } | string
}

interface LandlordProfile {
  _id?: string
  legalName?: string
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'suspended' | 'rejected'
  submittedDocuments?: unknown[]
}

/* ─── ICON HELPER ────────────────────────────────────────────────────────── */
function SummaryIcon({ type }: { type: string }) {
  if (type === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <path d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'money') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'check') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-verified">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-gold">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  )
}

/* ─── SECTION WRAPPER ────────────────────────────────────────────────────── */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, delay }}>
      {children}
    </motion.div>
  )
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */
export default function LandlordDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] || 'there'

  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [agreements, setAgreements] = useState<AgreementItem[]>([])
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [applications, setApplications] = useState<ApplicationItem[]>([])
  const [profile, setProfile] = useState<LandlordProfile | null>(null)

  const authHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('hl_token') || localStorage.getItem('token')) : null
    return token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }
  }, [])

  /* ── Fetch Real Data for the Logged-in Landlord ── */
  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      setLoading(true)
      const headers = authHeaders()

      try {
        const [propsRes, payRes, agrRes, maintRes, appRes, verRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/properties/my`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/payments/landlord`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/agreements/landlord`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/maintenance/landlord`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/applications/landlord`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/verification/status?format=details`, { headers }).catch(() => null),
        ])

        if (!isMounted) return

        if (propsRes && propsRes.ok) {
          const d = await propsRes.json()
          setProperties(d.data || d.properties || (Array.isArray(d) ? d : []))
        }

        if (payRes && payRes.ok) {
          const d = await payRes.json()
          setPayments(d.data || d.payments || (Array.isArray(d) ? d : []))
        }

        if (agrRes && agrRes.ok) {
          const d = await agrRes.json()
          setAgreements(d.data || d.agreements || (Array.isArray(d) ? d : []))
        }

        if (maintRes && maintRes.ok) {
          const d = await maintRes.json()
          setTickets(d.data || d.requests || (Array.isArray(d) ? d : []))
        }

        if (appRes && appRes.ok) {
          const d = await appRes.json()
          setApplications(d.data || d.applications || (Array.isArray(d) ? d : []))
        }

        if (verRes && verRes.ok) {
          const d = await verRes.json()
          const p = d.data?.profile || d.profile
          if (p) setProfile(p)
        }
      } catch (err) {
        console.error('Failed to load landlord dashboard data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDashboardData()
    return () => { isMounted = false }
  }, [authHeaders])

  /* ── Calculations based on Real Data ── */
  const totalProperties = properties.length
  const pendingVerificationProps = properties.filter(
    (p) => p.verificationStatus === 'pending' || p.verificationStatus === 'unverified'
  ).length

  // Agreements active
  const activeAgreements = agreements.filter((a) => a.status === 'active')

  // Current Month String (e.g. 2026-10)
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Payments for current period or all unpaid
  const currentMonthPayments = payments.filter((p) => {
    if (p.periodMonth && p.periodMonth === currentMonthStr) return true
    const due = p.dueDate ? String(p.dueDate) : ''
    if (due.startsWith(currentMonthStr)) return true
    return false
  })

  // Expected Revenue
  const expectedRevenue = currentMonthPayments.length > 0
    ? currentMonthPayments.reduce((sum, p) => sum + Number(p.amountDue ?? p.amount ?? 0), 0)
    : activeAgreements.reduce((sum, a) => sum + Number(a.rentAmount ?? a.monthlyRentEtb ?? 0), 0)

  // Collected Revenue
  const collectedRevenue = currentMonthPayments.length > 0
    ? currentMonthPayments.reduce((sum, p) => {
        if (p.status === 'paid' || p.status === 'collected') {
          return sum + Number(p.amountPaid ?? p.amountDue ?? p.amount ?? 0)
        }
        return sum
      }, 0)
    : payments.reduce((sum, p) => {
        if (p.status === 'paid' || p.status === 'collected') {
          const paidDate = p.paidAt || p.paidDate ? String(p.paidAt || p.paidDate) : ''
          if (paidDate.startsWith(currentMonthStr)) {
            return sum + Number(p.amountPaid ?? p.amountDue ?? p.amount ?? 0)
          }
        }
        return sum
      }, 0)

  // Collection Rate
  const collectionRate = expectedRevenue > 0
    ? `${((collectedRevenue / expectedRevenue) * 100).toFixed(1)}%`
    : totalProperties === 0
    ? 'No active units'
    : '100%'

  // Open maintenance tickets
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed')
  const urgentTickets = openTickets.filter((t) => t.priority === 'urgent' || t.priority === 'high')

  // Verification state
  const hasDocs = (profile?.submittedDocuments || []).length > 0
  const isVerified = profile?.verificationStatus === 'verified' && hasDocs
  const isUnderReview = profile?.verificationStatus === 'pending' || (hasDocs && !isVerified)

  /* ── Dynamic Summary Cards ── */
  const summaryCards = [
    {
      label: 'Total Properties',
      value: String(totalProperties),
      sub: totalProperties === 0
        ? 'No properties added yet'
        : pendingVerificationProps > 0
        ? `${pendingVerificationProps} pending verification`
        : 'All verified',
      icon: 'home',
      trend: totalProperties > 0 ? `${totalProperties} in portfolio` : 'Get started',
    },
    {
      label: 'Expected This Month',
      value: `ETB ${expectedRevenue.toLocaleString()}`,
      sub: totalProperties === 0 ? 'List a property to earn' : `${activeAgreements.length} active leases`,
      icon: 'money',
      trend: activeAgreements.length > 0 ? `${activeAgreements.length} occupied` : '0 active units',
    },
    {
      label: 'Collected',
      value: `ETB ${collectedRevenue.toLocaleString()}`,
      sub: expectedRevenue > 0 ? `${collectionRate} collection rate` : 'No payments due yet',
      icon: 'check',
      trend: collectedRevenue >= expectedRevenue && expectedRevenue > 0 ? 'On track' : totalProperties === 0 ? 'No activity' : 'In progress',
    },
    {
      label: 'Open Tickets',
      value: String(openTickets.length),
      sub: openTickets.length === 0
        ? 'All maintenance clear'
        : `${urgentTickets.length} urgent, ${Math.max(0, openTickets.length - urgentTickets.length)} in progress`,
      icon: 'wrench',
      trend: openTickets.length > 0 ? 'Action needed' : 'All clear',
    },
  ]

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`Welcome back, ${firstName}. Here's your portfolio at a glance.`}
      />

      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, i) => (
            <FadeIn key={card.label} delay={i * 0.07}>
              <div
                className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm hover:shadow-stamp transition-shadow"
                style={{ borderRadius: '12px 12px 24px 12px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rust/10">
                    <SummaryIcon type={card.icon} />
                  </div>
                  <span className="text-[11px] font-medium text-charcoal/40">{card.trend}</span>
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-charcoal">{card.value}</p>
                <p className="text-sm font-semibold text-charcoal/70">{card.label}</p>
                <p className="mt-0.5 text-xs text-charcoal/45">{card.sub}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* ── MAIN CONTENT GRID ── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

          {/* Left column */}
          <div className="space-y-6">

            {/* Properties Overview */}
            <FadeIn delay={0.1}>
              <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-charcoal">My Properties</h2>
                    <p className="text-xs text-charcoal/50">Your active listings and occupancy status</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href="/list-property" className="rounded-lg bg-rust/10 px-3 py-1.5 text-xs font-semibold text-rust hover:bg-rust hover:text-white transition-colors">
                      + Add Property
                    </Link>
                    <Link href="/landlord/properties" className="text-xs font-semibold text-rust hover:text-rust-dark">
                      Manage all →
                    </Link>
                  </div>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-sm text-charcoal/50">Loading properties…</div>
                ) : properties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rust/10 text-rust mb-3">
                      <SummaryIcon type="home" />
                    </div>
                    <p className="font-display font-semibold text-charcoal">No properties listed yet</p>
                    <p className="mt-1 max-w-sm text-xs text-charcoal/55">
                      Create your first listing to start accepting tenant viewing requests, lease applications, and digital rent payments.
                    </p>
                    <Link
                      href="/list-property"
                      className="mt-4 rounded-lg bg-rust px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rust-dark transition-colors"
                    >
                      List a New Property
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-charcoal/8">
                    {properties.slice(0, 5).map((p) => {
                      const rent = Number(p.rentAmount ?? p.price ?? 0)
                      const isOccupied = activeAgreements.some(
                        (a) => (typeof a.propertyId === 'object' ? a.propertyId?._id : a.propertyId) === p._id
                      ) || Boolean(p.currentTenantId)
                      const firstImg = p.images && p.images.length > 0 ? p.images[0] : null
                      const imgSrc = resolveImageUrl(firstImg, '/images/placeholder-property.jpg')

                      return (
                        <div key={p._id} className="flex items-center gap-4 px-5 py-4 hover:bg-sand/20 transition-colors">
                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-charcoal/5">
                            <img
                              src={imgSrc}
                              alt={p.title || 'Property'}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).src = '/images/placeholder-property.jpg'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-semibold text-charcoal truncate">{p.title}</p>
                            <p className="text-xs text-charcoal/55 truncate">{formatLocation(p.location, p.address)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm font-bold text-charcoal">
                              ETB {rent.toLocaleString()}
                              <span className="text-xs font-normal text-charcoal/45">/mo</span>
                            </p>
                            <span
                              className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                isOccupied ? 'bg-verified/10 text-verified' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isOccupied ? 'Occupied' : 'Vacant'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Rent Collection Table */}
            <FadeIn delay={0.15}>
              <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-charcoal">This Month&apos;s Rent Ledger</h2>
                    <p className="text-xs text-charcoal/50">Recent payments and collection records</p>
                  </div>
                  <Link href="/landlord/rent-payments" className="text-xs font-semibold text-rust hover:text-rust-dark">
                    Full ledger →
                  </Link>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-sm text-charcoal/50">Loading payments…</div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                    <p className="text-sm font-medium text-charcoal">No rent records yet</p>
                    <p className="mt-1 text-xs text-charcoal/50 max-w-sm">
                      Rent payment invoices and receipts will automatically show up here as your agreements become active.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-sm">
                      <thead className="bg-sand/40 text-xs uppercase tracking-wider text-charcoal/45">
                        <tr>
                          <th className="px-5 py-3 text-left font-medium">Tenant</th>
                          <th className="px-5 py-3 text-left font-medium">Property</th>
                          <th className="px-5 py-3 text-left font-medium">Amount</th>
                          <th className="px-5 py-3 text-left font-medium">Due Date</th>
                          <th className="px-5 py-3 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal/8">
                        {payments.slice(0, 5).map((p) => {
                          const tName = typeof p.tenantId === 'object' && p.tenantId
                            ? `${p.tenantId.firstName || ''} ${p.tenantId.lastName || ''}`.trim() || p.tenantId.email || 'Tenant'
                            : 'Tenant'
                          const pTitle = typeof p.propertyId === 'object' && p.propertyId ? p.propertyId.title || 'Property' : 'Property'
                          const amount = Number(p.amountDue ?? p.amount ?? 0)
                          const isPaid = p.status === 'paid' || p.status === 'collected'

                          return (
                            <tr key={p._id} className="hover:bg-sand/20">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  <InitialsAvatar name={tName} size={32} />
                                  <span className="font-medium text-charcoal">{tName}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-charcoal/60 truncate max-w-[160px]">{pTitle}</td>
                              <td className="px-5 py-3 font-mono font-semibold text-charcoal">ETB {amount.toLocaleString()}</td>
                              <td className="px-5 py-3 text-charcoal/60 text-xs">
                                {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-5 py-3">
                                {isPaid ? (
                                  <span className="rounded-full bg-verified/10 px-2.5 py-0.5 text-xs font-semibold text-verified">Paid</span>
                                ) : p.status === 'overdue' ? (
                                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Overdue</span>
                                ) : (
                                  <span className="rounded-full bg-rust/10 px-2.5 py-0.5 text-xs font-semibold text-rust">Pending</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </FadeIn>
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Verification Status Widget */}
            <FadeIn delay={0.2}>
              <div
                className={`rounded-xl border p-5 transition-all ${
                  isVerified
                    ? 'border-verified/20 bg-verified/5'
                    : isUnderReview
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-rust/20 bg-rust/5'
                }`}
                style={{ borderRadius: '12px 12px 24px 12px' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 ${isVerified ? 'text-verified' : isUnderReview ? 'text-amber-600' : 'text-rust'}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 1.5l6.5 2.9v5c0 4.6-2.8 8.7-6.5 9.9-3.7-1.2-6.5-5.3-6.5-9.9v-5L10 1.5zm3.4 6.4a.75.75 0 00-1.1-1L9 10.2 7.7 8.9a.75.75 0 10-1 1.1l1.8 1.8c.3.3.8.3 1 0l3.9-3.9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span
                    className={`text-sm font-bold ${
                      isVerified ? 'text-verified' : isUnderReview ? 'text-amber-800' : 'text-rust'
                    }`}
                  >
                    {isVerified ? 'Account Verified' : isUnderReview ? 'Verification Under Review' : 'Identity Verification Required'}
                  </span>
                </div>
                <p className="text-xs text-charcoal/65 leading-relaxed">
                  {isVerified
                    ? 'Your landlord profile is verified. All your active listings feature the trusted Verified Landlord badge.'
                    : isUnderReview
                    ? 'Your identity documents have been submitted and are being reviewed by an administrator.'
                    : 'Upload your Kebele ID or Title Deed in the Verification workbench to earn tenant trust and activate verified listings.'}
                </p>
                {!isVerified && (
                  <div className="mt-3">
                    <Link
                      href="/landlord/verification"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rust hover:text-rust-dark underline underline-offset-2"
                    >
                      {isUnderReview ? 'Check verification status →' : 'Complete verification now →'}
                    </Link>
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Pending Applications */}
            <FadeIn delay={0.25}>
              <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4">
                  <h2 className="font-display text-base font-bold text-charcoal">New Applications</h2>
                  <Link href="/landlord/applications" className="text-xs font-semibold text-rust hover:text-rust-dark">
                    View all →
                  </Link>
                </div>

                {loading ? (
                  <div className="p-6 text-center text-xs text-charcoal/50">Loading applications…</div>
                ) : applications.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-xs font-medium text-charcoal/70">No tenant applications yet</p>
                    <p className="mt-1 text-[11px] text-charcoal/45">
                      When prospective tenants apply for your units, they will be listed here for screening.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-charcoal/8">
                    {applications.slice(0, 4).map((app) => {
                      const tName = app.fullName || (typeof app.tenantId === 'object' && app.tenantId ? `${app.tenantId.firstName || ''} ${app.tenantId.lastName || ''}`.trim() : 'Applicant')
                      const pTitle = typeof app.propertyId === 'object' && app.propertyId ? app.propertyId.title || 'Property' : 'Property'

                      return (
                        <div key={app._id} className="flex items-start gap-3 px-5 py-4 hover:bg-sand/20 transition-colors">
                          <InitialsAvatar name={tName} size={36} className="border border-sand" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-sm font-bold text-charcoal truncate">{tName}</p>
                            <p className="text-xs text-charcoal/55 truncate">{pTitle}</p>
                            <p className="mt-1 text-[10px] text-charcoal/40">
                              {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''} · {app.employmentStatus || 'Employed'}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <Link
                              href="/landlord/applications"
                              className="rounded bg-sand/80 px-2.5 py-1 text-[11px] font-semibold text-charcoal hover:bg-rust hover:text-white transition-colors"
                            >
                              Review
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Quick Actions */}
            <FadeIn delay={0.3}>
              <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm p-5" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <h2 className="font-display text-base font-bold text-charcoal mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { label: 'List a New Property', href: '/list-property', icon: '➕' },
                    { label: 'Identity & Property Verification', href: '/landlord/verification', icon: '🛡️' },
                    { label: 'Rent Payments & Receipts', href: '/landlord/rent-payments', icon: '📄' },
                    { label: 'View Maintenance Requests', href: '/landlord/maintenance', icon: '🔧' },
                    { label: 'Tenant Directory & Leases', href: '/landlord/tenants', icon: '👥' },
                  ].map((a) => (
                    <Link
                      key={a.label}
                      href={a.href}
                      className="flex items-center gap-3 rounded-lg bg-sand/50 px-4 py-3 text-sm font-medium text-charcoal hover:bg-sand hover:text-rust transition-all"
                    >
                      <span className="text-base">{a.icon}</span>
                      {a.label}
                      <span className="ml-auto text-charcoal/30">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </main>
    </>
  )
}
