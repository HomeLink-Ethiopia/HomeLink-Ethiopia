'use client'

import { useLanguage } from '@/lib/language-context'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import TopBar from '@/components/landlord/TopBar'
import { personPhoto, stockPhoto } from '@/lib/images'

/* ─── MOCK DATA ──────────────────────────────────────────────────────────── */
const SUMMARY_CARDS = [
  { label: 'Total Properties', value: '7', sub: '2 pending verification', icon: 'home', trend: '+1 this month' },
  { label: 'Expected This Month', value: 'ETB 147,500', sub: 'Across all units', icon: 'money', trend: '↑ 3.2%' },
  { label: 'Collected', value: 'ETB 132,000', sub: '89.5% collection rate', icon: 'check', trend: 'On track' },
  { label: 'Open Tickets', value: '3', sub: '1 urgent, 2 in progress', icon: 'wrench', trend: 'Act needed' },
]

const RECENT_PAYMENTS = [
  { name: 'Tsedi Kebede', property: 'Bole 2-Bed Apt', amount: 22000, dueDate: 'Aug 1', paid: true, avatar: personPhoto('tsedi-kebede-tenant', 80) },
  { name: 'Meron Alemu', property: 'Kazanchis Studio', amount: 14500, dueDate: 'Aug 3', paid: true, avatar: personPhoto('meron-alemu-t', 80) },
  { name: 'Henok Girma', property: 'CMC Family Home', amount: 32000, dueDate: 'Aug 5', paid: false, avatar: personPhoto('henok-girma-t', 80) },
  { name: 'Sara Tadesse', property: 'Yeka Villa', amount: 28000, dueDate: 'Aug 8', paid: true, avatar: personPhoto('sara-tadesse-t', 80) },
  { name: 'Daniel Bekele', property: 'Saris 1-Bed', amount: 11500, dueDate: 'Aug 10', paid: false, avatar: personPhoto('daniel-bekele-t', 80) },
]

const PROPERTIES_OVERVIEW = [
  { title: '2 Bed Apartment', location: 'Bole', rent: 22000, status: 'Occupied', occupancy: 100, img: stockPhoto('bole-apartment', 300, 200) },
  { title: 'Studio Apartment', location: 'Kazanchis', rent: 14500, status: 'Occupied', occupancy: 100, img: stockPhoto('kazanchis-studio', 300, 200) },
  { title: 'Family Compound', location: 'CMC', rent: 32000, status: 'Occupied', occupancy: 100, img: stockPhoto('cmc-compound', 300, 200) },
  { title: 'Villa', location: 'Yeka', rent: 28000, status: 'Vacant', occupancy: 0, img: stockPhoto('yeka-villa', 300, 200) },
]

const RECENT_APPS = [
  { name: 'Bereket Haile', property: 'Yeka Villa', submitted: 'Today, 9:22 AM', score: 92, avatar: personPhoto('bereket-haile-app', 80) },
  { name: 'Yemi Mulatu', property: 'Yeka Villa', submitted: 'Yesterday', score: 78, avatar: personPhoto('yemi-mulatu-app', 80) },
  { name: 'Amina Osman', property: 'Saris 1-Bed', submitted: '2 days ago', score: 85, avatar: personPhoto('amina-osman-app', 80) },
]

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

/* ─── SCORE BAR ──────────────────────────────────────────────────────────── */
function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? '#2E7D32' : score >= 70 ? '#F59E0B' : '#B8451F'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-sand overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold text-charcoal/70">{score}</span>
    </div>
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
  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Good morning, Abebe. Here's your portfolio at a glance."
      />

      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY_CARDS.map((card, i) => (
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
                <div className="divide-y divide-charcoal/8">
                  {PROPERTIES_OVERVIEW.map((p) => (
                    <div key={p.title} className="flex items-center gap-4 px-5 py-4 hover:bg-sand/20 transition-colors">
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                        <Image src={p.img} alt={p.title} fill sizes="80px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-charcoal truncate">{p.title}</p>
                        <p className="text-xs text-charcoal/55">{p.location}, Addis Ababa</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-charcoal">ETB {p.rent.toLocaleString()}<span className="text-xs font-normal text-charcoal/45">/mo</span></p>
                        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${p.status === 'Occupied' ? 'bg-verified/10 text-verified' : 'bg-rust/10 text-rust'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-sm">
                    <thead className="bg-sand/40 text-xs uppercase tracking-wider text-charcoal/45">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium">Tenant</th>
                        <th className="px-5 py-3 text-left font-medium">Property</th>
                        <th className="px-5 py-3 text-left font-medium">Amount</th>
                        <th className="px-5 py-3 text-left font-medium">Due</th>
                        <th className="px-5 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal/8">
                      {RECENT_PAYMENTS.map((p) => (
                        <tr key={p.name} className="hover:bg-sand/20">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-sand">
                                <Image src={p.avatar} alt={p.name} fill sizes="32px" className="object-cover" />
                              </div>
                              <span className="font-medium text-charcoal">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-charcoal/60">{p.property}</td>
                          <td className="px-5 py-3 font-mono font-semibold text-charcoal">ETB {p.amount.toLocaleString()}</td>
                          <td className="px-5 py-3 text-charcoal/60">{p.dueDate}</td>
                          <td className="px-5 py-3">
                            {p.paid ? (
                              <span className="rounded-full bg-verified/10 px-2.5 py-0.5 text-xs font-semibold text-verified">Paid</span>
                            ) : (
                              <span className="rounded-full bg-rust/10 px-2.5 py-0.5 text-xs font-semibold text-rust">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                <div className="divide-y divide-charcoal/8">
                  {RECENT_APPS.map((app) => (
                    <div key={app.name} className="flex items-start gap-3 px-5 py-4 hover:bg-sand/20 transition-colors">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-sand">
                        <Image src={app.avatar} alt={app.name} fill sizes="36px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm font-bold text-charcoal">{app.name}</p>
                        <p className="text-xs text-charcoal/55 truncate">{app.property}</p>
                        <ScoreBar score={app.score} />
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" className="rounded bg-verified/10 px-2.5 py-1 text-[11px] font-semibold text-verified hover:bg-verified/20 transition-colors">
                          Accept
                        </button>
                        <button type="button" className="rounded bg-rust/10 px-2.5 py-1 text-[11px] font-semibold text-rust hover:bg-rust/20 transition-colors">
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
                  <span className="text-sm font-bold text-verified">Account Verified</span>
                </div>
                <p className="text-xs text-charcoal/60">Your landlord profile and all listed properties are verified. Your listings appear with the Verified badge to tenants.</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </main>
    </>
  )
}
