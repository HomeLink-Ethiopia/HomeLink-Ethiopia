'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import TopBar from '@/components/landlord/TopBar'
import InitialsAvatar from '@/components/shared/InitialsAvatar'
import { resolveImageUrl } from '@/lib/image-url'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Property {
  _id: string
  title: string
  propertyType?: string
  rentAmount: number
  listingStatus: string
  verificationStatus: string
  location?: {
    city?: string
    subCity?: string
    address?: string
  }
  images?: { url: string; isPrimary?: boolean }[]
}

interface Payment {
  _id: string
  amountDue?: number
  amount?: number
  amountPaid?: number
  dueDate?: string
  paidAt?: string
  status: string
  tenantId?: {
    firstName?: string
    lastName?: string
  }
  propertyId?: {
    title?: string
  }
}

interface Application {
  _id: string
  status: string
  createdAt: string
  tenantId?: {
    firstName?: string
    lastName?: string
    email?: string
  }
  propertyId?: {
    title?: string
  }
}

interface Ticket {
  _id: string
  status: string
  title: string
}

/* ─── ICON HELPER ────────────────────────────────────────────────────────── */
function SummaryIcon({ type }: { type: string }) {
  if (type === 'home') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
      <path d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'money') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-rust">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
    </svg>
  )
  if (type === 'check') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-verified">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-gold">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
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

/* ─── PAGE ───────────────────────────────────────────────────────────────── */
export default function LandlordDashboardPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] || 'there'

  const [properties, setProperties] = useState<Property[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

        const [propsRes, payRes, appRes, ticketRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/v1/properties/my`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_URL}/api/v1/payments`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_URL}/api/v1/applications/landlord`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_URL}/api/v1/maintenance`, { headers }).then(r => r.ok ? r.json() : null),
        ])

        if (!isMounted) return

        if (propsRes.status === 'fulfilled' && propsRes.value?.data) {
          setProperties(Array.isArray(propsRes.value.data) ? propsRes.value.data : [])
        }
        if (payRes.status === 'fulfilled' && payRes.value) {
          const list = Array.isArray(payRes.value) ? payRes.value : (payRes.value.data || [])
          setPayments(Array.isArray(list) ? list : [])
        }
        if (appRes.status === 'fulfilled' && appRes.value) {
          const list = Array.isArray(appRes.value) ? appRes.value : (appRes.value.data || [])
          setApplications(Array.isArray(list) ? list : [])
        }
        if (ticketRes.status === 'fulfilled' && ticketRes.value) {
          const list = Array.isArray(ticketRes.value) ? ticketRes.value : (ticketRes.value.data || ticketRes.value.requests || [])
          setTickets(Array.isArray(list) ? list : [])
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [])

  const totalProperties = properties.length
  const rentedProps = properties.filter(p => p.listingStatus === 'rented')
  const monthlyExpected = rentedProps.reduce((sum, p) => sum + (Number(p.rentAmount) || 0), 0)
    || payments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((sum, p) => sum + (Number(p.amountDue || p.amount) || 0), 0)

  const collected = payments.filter(p => p.status === 'paid' || p.status === 'collected')
    .reduce((sum, p) => sum + (Number(p.amountPaid || p.amountDue || p.amount) || 0), 0)

  const openTicketsCount = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length

  const summaryCards = [
    {
      label: 'Total Properties',
      value: totalProperties.toString(),
      sub: totalProperties === 0 ? 'No properties registered' : `${properties.filter(p => p.listingStatus === 'active').length} active listings`,
      icon: 'home',
      trend: totalProperties === 0 ? '0 registered' : `${properties.filter(p => p.verificationStatus === 'verified').length} verified`,
    },
    {
      label: 'Expected This Month',
      value: `ETB ${monthlyExpected.toLocaleString()}`,
      sub: totalProperties === 0 ? 'No leased units yet' : `${rentedProps.length} unit(s) leased`,
      icon: 'money',
      trend: monthlyExpected > 0 ? 'Current cycle' : 'ETB 0',
    },
    {
      label: 'Collected',
      value: `ETB ${collected.toLocaleString()}`,
      sub: (collected + monthlyExpected) > 0 ? `${Math.round((collected / (collected + monthlyExpected)) * 100)}% collection rate` : '0 rent collected',
      icon: 'check',
      trend: collected > 0 ? 'On track' : 'No records',
    },
    {
      label: 'Open Tickets',
      value: openTicketsCount.toString(),
      sub: openTicketsCount === 0 ? 'All systems operational' : `${openTicketsCount} in progress`,
      icon: 'wrench',
      trend: openTicketsCount === 0 ? 'Clear' : 'Action needed',
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
              <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm hover:shadow-stamp transition-shadow" style={{ borderRadius: '12px 12px 24px 12px' }}>
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
                  <h2 className="font-display text-base font-bold text-charcoal">My Properties</h2>
                  <Link href="/landlord/properties" className="text-xs font-semibold text-rust hover:text-rust-dark">
                    Manage all →
                  </Link>
                </div>
                {properties.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rust/10 text-rust">
                      <SummaryIcon type="home" />
                    </div>
                    <h3 className="font-display text-base font-semibold text-charcoal">No properties registered yet</h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-charcoal/50">
                      You haven&apos;t listed any rental properties yet. Add your first property to start accepting tenant applications and collecting rent.
                    </p>
                    <Link
                      href="/list-property"
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rust px-4 py-2 text-xs font-semibold text-white hover:bg-rust-dark transition-colors"
                    >
                      + Register First Property
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-charcoal/8">
                    {properties.slice(0, 5).map((p) => {
                      const firstImg = p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null)
                      const displayImg = resolveImageUrl(firstImg, '/images/placeholder.svg')
                      return (
                        <div key={p._id} className="flex items-center gap-4 px-5 py-4 hover:bg-sand/20 transition-colors">
                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-sand/30">
                            <Image
                              src={displayImg}
                              alt={p.title}
                              fill
                              sizes="80px"
                              className="object-cover"
                              unoptimized={displayImg.startsWith('http')}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-semibold text-charcoal truncate">{p.title}</p>
                            <p className="text-xs text-charcoal/55">
                              {p.location?.subCity ? `${p.location.subCity}, Addis Ababa` : (p.location?.city || 'Addis Ababa')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm font-bold text-charcoal">
                              ETB {Number(p.rentAmount || 0).toLocaleString()}
                              <span className="text-xs font-normal text-charcoal/45">/mo</span>
                            </p>
                            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              p.listingStatus === 'rented' ? 'bg-verified/10 text-verified' :
                              p.listingStatus === 'active' ? 'bg-emerald-50 text-emerald-700' :
                              'bg-rust/10 text-rust'
                            }`}>
                              {p.listingStatus || 'active'}
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
                  <h2 className="font-display text-base font-bold text-charcoal">This Month&apos;s Rent</h2>
                  <Link href="/landlord/rent-payments" className="text-xs font-semibold text-rust hover:text-rust-dark">
                    Full ledger →
                  </Link>
                </div>
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-charcoal/50">
                    No rent payment records yet. Rent schedules and digital receipts will be automatically tracked here once your properties are leased.
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
                          const tenantName = p.tenantId ? `${p.tenantId.firstName || ''} ${p.tenantId.lastName || ''}`.trim() : 'Tenant'
                          const propTitle = p.propertyId?.title || 'Rental Unit'
                          const isPaid = p.status === 'paid' || p.status === 'collected'
                          return (
                            <tr key={p._id} className="hover:bg-sand/20">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  <InitialsAvatar name={tenantName} size={32} />
                                  <span className="font-medium text-charcoal">{tenantName}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-charcoal/60 truncate max-w-[150px]">{propTitle}</td>
                              <td className="px-5 py-3 font-mono font-semibold text-charcoal">
                                ETB {Number(p.amountDue || p.amount || 0).toLocaleString()}
                              </td>
                              <td className="px-5 py-3 text-charcoal/60">
                                {p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                              </td>
                              <td className="px-5 py-3">
                                {isPaid ? (
                                  <span className="rounded-full bg-verified/10 px-2.5 py-0.5 text-xs font-semibold text-verified">Paid</span>
                                ) : (
                                  <span className="rounded-full bg-rust/10 px-2.5 py-0.5 text-xs font-semibold text-rust">
                                    {p.status || 'Pending'}
                                  </span>
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

            {/* Pending Applications */}
            <FadeIn delay={0.2}>
              <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4">
                  <h2 className="font-display text-base font-bold text-charcoal">New Applications</h2>
                  <Link href="/landlord/applications" className="text-xs font-semibold text-rust hover:text-rust-dark">
                    View all →
                  </Link>
                </div>
                {applications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-charcoal/50">
                    No applications received yet. Interested tenants will appear here when they submit applications for your listings.
                  </div>
                ) : (
                  <div className="divide-y divide-charcoal/8">
                    {applications.slice(0, 4).map((app) => {
                      const applicantName = app.tenantId ? `${app.tenantId.firstName || ''} ${app.tenantId.lastName || ''}`.trim() : 'Applicant'
                      const propTitle = app.propertyId?.title || 'Rental Property'
                      return (
                        <div key={app._id} className="flex items-start gap-3 px-5 py-4 hover:bg-sand/20 transition-colors">
                          <InitialsAvatar name={applicantName} size={36} className="border border-sand" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-sm font-bold text-charcoal truncate">{applicantName}</p>
                            <p className="text-xs text-charcoal/55 truncate">{propTitle}</p>
                            <span className="mt-1 inline-block rounded bg-sand px-2 py-0.5 text-[10px] font-semibold text-charcoal/60 uppercase">
                              {app.status || 'Submitted'}
                            </span>
                          </div>
                          <Link
                            href="/landlord/applications"
                            className="rounded bg-rust/10 px-2.5 py-1 text-[11px] font-semibold text-rust hover:bg-rust/20 transition-colors shrink-0"
                          >
                            Review
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Quick Actions */}
            <FadeIn delay={0.25}>
              <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm p-5" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <h2 className="font-display text-base font-bold text-charcoal mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { label: 'List a New Property', href: '/list-property', icon: '➕' },
                    { label: 'View Maintenance Tickets', href: '/landlord/maintenance', icon: '🔧' },
                    { label: 'Download Rent Report', href: '/landlord/rent-payments', icon: '📄' },
                    { label: 'Manage Tenants', href: '/landlord/tenants', icon: '👥' },
                  ].map((a) => (
                    <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-lg bg-sand/50 px-4 py-3 text-sm font-medium text-charcoal hover:bg-sand hover:text-rust transition-all">
                      <span className="text-base">{a.icon}</span>
                      {a.label}
                      <span className="ml-auto text-charcoal/30">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Verification Status */}
            <FadeIn delay={0.3}>
              <div className="rounded-xl border border-verified/20 bg-verified/5 p-5" style={{ borderRadius: '12px 12px 24px 12px' }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-verified">
                    <path fillRule="evenodd" d="M10 1.5l6.5 2.9v5c0 4.6-2.8 8.7-6.5 9.9-3.7-1.2-6.5-5.3-6.5-9.9v-5L10 1.5zm3.4 6.4a.75.75 0 00-1.1-1L9 10.2 7.7 8.9a.75.75 0 10-1 1.1l1.8 1.8c.3.3.8.3 1 0l3.9-3.9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-verified">Account Active</span>
                </div>
                <p className="text-xs text-charcoal/60">
                  {totalProperties === 0
                    ? 'Your landlord account is active and verified. Register a property to start accepting applications.'
                    : `You have ${totalProperties} property listed. Verified listings receive priority placement.`}
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </main>
    </>
  )
}
