'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import TopBar from '@/components/admin/TopBar'
import KpiCard from '@/components/admin/KpiCard'
import VerificationQueue, { type QueueItem } from '@/components/admin/VerificationQueue'
import VerificationProgress from '@/components/admin/VerificationProgress'
import FraudReportsByType, { type FraudRow } from '@/components/admin/FraudReportsByType'
import RiskLevelDistribution, { type RiskSlice } from '@/components/admin/RiskLevelDistribution'
import { VERIFICATION_KPIS, type KpiStat } from '@/lib/admin'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const KPI_ICONS = ['queue', 'fraud', 'scale', 'verified'] as const

interface LiveKpis {
  totalUsers: number
  totalLandlords: number
  totalTenants: number
  totalAdmins: number
  totalProperties: number
  verifiedProperties: number
  pendingVerification: number
  activeRentals: number
  totalAgreements?: number
  pendingAgreements?: number
  totalApplications: number
  pendingApplications?: number
  totalMaintenance?: number
  openMaintenance?: number
  totalEscrowHeld?: number
  totalRentSettled?: number
  fraudReports: number
  openDisputes: number
}

interface AnalyticsCharts {
  verificationStats?: any[]
  fraudByType?: any[]
  propertiesByCity?: any[]
  usersByRole?: any[]
  propertiesByPriceRange?: any[]
  applicationTrend?: any[]
}

const CONTROLS = [
  { href: '/admin/agreements', label: 'Rental Agreements', desc: 'Active leases, digital signatures & escrow', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/admin/applications', label: 'Applications Desk', desc: 'Tenant vetting, income & Kebele IDs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/admin/maintenance', label: 'Maintenance Oversight', desc: 'Habitability & urgent repair tickets', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { href: '/admin/reports', label: 'Financial Ledgers', desc: 'Escrow balances & settled payments', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { href: '/admin/properties', label: 'Manage Properties', desc: 'Listings moderation & risk level', icon: 'M3 10l7-7 7 7v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1v-8z' },
  { href: '/admin/landlord-verification', label: 'Landlord Verification', desc: 'National ID, trade license & Fayda', icon: 'M9 12l2 2 4-4M10 3h4l5 5v9a2 2 0 01-2 2H7a2 2 0 01-2-2V8l5-5z' },
  { href: '/admin/fraud-reports', label: 'Review Fraud', desc: 'AI risk triage & scam reports', icon: 'M10 2l8 4v5c0 4.4-3.4 7.8-8 9-4.6-1.2-8-4.6-8-9V6l8-4zM10 6v4M10 12.5v.1' },
  { href: '/admin/disputes', label: 'Review Disputes', desc: 'Investigate, mediate & resolve', icon: 'M10 2v14M5 5l-3 5.5a2.5 2.5 0 005 0L5 5zM15 5l-3 5.5a2.5 2.5 0 005 0L15 5zM5 5h10M6 18h8' },
  { href: '/admin/users', label: 'Manage Users', desc: 'Suspend or reinstate accounts', icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zM3 18a7 7 0 0114 0M17.5 12a3 3 0 100-6M14 18a5.5 5.5 0 017 0' },
  { href: '/admin/audit-logs', label: 'Audit Logs', desc: 'Every admin action recorded', icon: 'M6 3h9l3 3v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 9h6M9 13h6' },
] as const

function fmtEtb(n?: number) {
  return n !== undefined && !isNaN(n) ? `ETB ${n.toLocaleString('en-US')}` : '0 ETB'
}

export default function AdminDashboardPage() {
  const { t } = useLanguage()
  const [kpis, setKpis] = useState<KpiStat[]>(VERIFICATION_KPIS)
  const [fraudRows, setFraudRows] = useState<FraudRow[] | undefined>(undefined)
  const [riskSlices, setRiskSlices] = useState<RiskSlice[] | undefined>(undefined)
  const [verificationSlices, setVerificationSlices] = useState<{ name: string; value: number; color?: string }[] | undefined>(undefined)
  const [queueItems, setQueueItems] = useState<QueueItem[] | undefined>(undefined)
  const [stats, setStats] = useState<LiveKpis | null>(null)

  const load = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || '') : ''
      const res = await fetch(`${API_URL}/api/v1/admin/analytics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const json = await res.json()
      const k: LiveKpis | undefined = json.data?.kpis
      const charts: AnalyticsCharts | undefined = json.data?.charts
      if (k) {
        setStats(k)
        const pendingVerif = Number((k as any).pendingVerification ?? (k as any).pendingVerifications ?? 0)
        const openFraud = Number((k as any).fraudReports ?? (k as any).openFraudReports ?? 0)
        const openDisp = Number((k as any).openDisputes ?? (k as any).activeDisputes ?? 0)
        const totalProps = Number((k as any).totalProperties ?? 0)
        const verifiedProps = Number((k as any).verifiedProperties ?? 0)
        const totalApps = Number((k as any).totalApplications ?? 0)
        const activeRents = Number((k as any).activeRentals ?? 0)

        setKpis([
          { label: 'Pending Verification', value: String(pendingVerif), deltaLabel: `${totalProps} listings`, deltaDirection: 'up' },
          { label: 'Open Fraud Reports', value: String(openFraud), deltaLabel: `${totalApps} applications`, deltaDirection: openFraud > 0 ? 'up' : 'down' },
          { label: 'Active Disputes', value: String(openDisp), deltaLabel: `${activeRents} active rentals`, deltaDirection: openDisp > 0 ? 'up' : 'down' },
          {
            label: 'Verification Rate',
            value: totalProps > 0 ? `${Math.round((verifiedProps / totalProps) * 100)}%` : '100%',
            deltaLabel: `${verifiedProps}/${totalProps} verified`,
            deltaDirection: 'up',
          },
        ])
      }
      if (Array.isArray(charts?.fraudByType)) {
        setFraudRows(charts!.fraudByType.map((f: any) => ({
          type: String(f.label || f._id || 'other'),
          count: Number(f.value ?? f.count ?? 0)
        })))
      }
      if (Array.isArray(charts?.verificationStats)) {
        setVerificationSlices(
          charts!.verificationStats.map((v: any) => {
            const rawLabel = String(v.label || v._id || 'unverified')
            const name = rawLabel ? (rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)) : 'Unverified'
            return {
              name,
              value: Number(v.value ?? v.count ?? 0),
            }
          }),
        )
      }

      // Fetch real verification queue items
      const verifRes = await fetch(`${API_URL}/api/v1/verification/pending`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (verifRes.ok) {
        const vJson = await verifRes.json()
        const landlords: any[] = vJson.data?.landlords || []
        const properties: any[] = vJson.data?.properties || []

        const items: QueueItem[] = [
          ...landlords.map((l: any, idx: number) => ({
            id: String(l._id || `L-${idx}`).slice(-6) || 'L-PEND',
            title: l.legalName || (typeof l.accountId === 'object' ? `${l.accountId.firstName || ''} ${l.accountId.lastName || ''}`.trim() : null) || 'Landlord Identity',
            subtitle: `${l.phone || (typeof l.accountId === 'object' ? l.accountId.phone : null) || 'Landlord'} · ${l.faydaVerified ? 'Fayda Verified' : 'Fayda Pending'}`,
            avatar: '',
            risk: ((l.aiTrustScore && l.aiTrustScore < 50 ? 'high' : l.aiTrustScore < 80 ? 'medium' : 'low') as 'high' | 'medium' | 'low'),
            timeAgo: 'Pending',
            type: 'Identity',
          })),
          ...properties.map((p: any, idx: number) => ({
            id: String(p._id || `P-${idx}`).slice(-6) || 'P-PEND',
            title: (typeof p.propertyId === 'object' && p.propertyId?.title) ? p.propertyId.title : 'Property Title Deed',
            subtitle: `${(typeof p.landlordProfileId === 'object' && p.landlordProfileId?.legalName) ? p.landlordProfileId.legalName : 'Landlord'} · ${(typeof p.propertyId === 'object' && p.propertyId?.address) ? p.propertyId.address : 'Addis Ababa'}`,
            avatar: '',
            risk: ((p.aiTrustScore && p.aiTrustScore < 50 ? 'high' : p.aiTrustScore < 80 ? 'medium' : 'low') as 'high' | 'medium' | 'low'),
            timeAgo: 'Pending',
            type: 'Title Deed',
          })),
        ]
        setQueueItems(items)
      }
    } catch {
      // static demo data stays
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Live risk distribution from the properties the admin can see
  useEffect(() => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('hl_token') || localStorage.getItem('homelink-token')) : null
    fetch(`${API_URL}/api/v1/properties/all`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const props = j?.data || []
        if (!Array.isArray(props) || props.length === 0) return
        const score = (p: any) => Math.max(Number(p.fraudRiskScore) || 0, p.riskLevel === 'high' ? 75 : p.riskLevel === 'medium' ? 40 : 5)
        const high = props.filter((p: any) => score(p) >= 60).length
        const medium = props.filter((p: any) => score(p) >= 30 && score(p) < 60).length
        const low = Math.max(0, props.length - high - medium)
        const pct = (n: number) => (props.length > 0 ? Math.round((n / props.length) * 100) : 0)
        setRiskSlices([
          { name: 'High', pct: pct(high) },
          { name: 'Medium', pct: pct(medium) },
          { name: 'Low', pct: pct(low) },
        ])
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <TopBar title="Trust & Verification Center" />
      <main className="space-y-6 px-6 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((stat, i) => (
            <KpiCard key={stat.label} stat={stat} icon={KPI_ICONS[i]} index={i} />
          ))}
        </div>

        {/* Live Unified Platform Overview (Aligned with Tenant & Landlord sides) */}
        {stats && (
          <section className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-charcoal">Platform Health & Tenancy Overview</h2>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                Live Data Synchronized
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Active Leases', value: stats.activeRentals, sub: `${stats.totalAgreements || 0} total agreements`, href: '/admin/agreements' },
                { label: 'Applications Desk', value: stats.totalApplications, sub: `${stats.pendingApplications || 0} pending review`, href: '/admin/applications' },
                { label: 'Maintenance Issues', value: stats.totalMaintenance || 0, sub: `${stats.openMaintenance || 0} unresolved`, href: '/admin/maintenance' },
                { label: 'Properties Listed', value: stats.totalProperties, sub: `${stats.verifiedProperties} verified`, href: '/admin/properties' },
                { label: 'Active Escrow Held', value: fmtEtb(stats.totalEscrowHeld), sub: 'Security deposits', href: '/admin/reports' },
                { label: 'Total Users', value: stats.totalUsers, sub: `${stats.totalLandlords} landlords, ${stats.totalTenants} tenants`, href: '/admin/users' },
              ].map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="rounded-lg border border-charcoal/10 bg-sand/20 p-3 transition-colors hover:bg-sand/50"
                >
                  <p className="font-display text-lg font-bold text-charcoal">{item.value}</p>
                  <p className="text-xs font-semibold text-charcoal/80">{item.label}</p>
                  <p className="mt-0.5 text-[10px] text-charcoal/50">{item.sub}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VerificationQueue items={queueItems} />
          <VerificationProgress slices={verificationSlices} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FraudReportsByType rows={fraudRows} />
          <RiskLevelDistribution slices={riskSlices} />
        </div>

        {/* Admin Controls Hub */}
        <section className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-charcoal">Core Operations & Moderation Hub</h2>
            <p className="text-xs text-charcoal/50">Full administrative control across all three pillars</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group flex items-start gap-3 rounded-lg border border-charcoal/10 p-3.5 transition-colors hover:bg-sand/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-rust-tint text-rust-dark shadow-xs">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-[18px] w-[18px]">
                    <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold text-charcoal group-hover:text-rust-dark">{c.label}</span>
                  <span className="mt-0.5 block text-xs text-charcoal/50">{c.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
