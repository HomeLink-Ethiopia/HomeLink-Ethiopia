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
  totalApplications: number
  pendingApplications: number
  fraudReports: number
  openDisputes: number
}

interface AnalyticsCharts {
  verificationStats?: { label: string; value: number }[]
  fraudByType?: { label: string; value: number }[]
  propertiesByCity?: { label: string; value: number }[]
  usersByRole?: { label: string; value: number }[]
  propertiesByPriceRange?: { label: string; value: number }[]
  applicationTrend?: { label: string; value: number }[]
}

const CONTROLS = [
  { href: '/admin/users', label: 'Manage Users', desc: 'Suspend or reinstate accounts', icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zM3 18a7 7 0 0114 0M17.5 12a3 3 0 100-6M14 18a5.5 5.5 0 017 0' },
  { href: '/admin/verification-queue', label: 'Review Verification', desc: 'Landlord identity & property documents', icon: 'M9 12l2 2 4-4M10 3h4l5 5v9a2 2 0 01-2 2H7a2 2 0 01-2-2V8l5-5z' },
  { href: '/admin/fraud-reports', label: 'Review Fraud', desc: 'AI risk triage — admin decides', icon: 'M10 2l8 4v5c0 4.4-3.4 7.8-8 9-4.6-1.2-8-4.6-8-9V6l8-4zM10 6v4M10 12.5v.1' },
  { href: '/admin/disputes', label: 'Review Disputes', desc: 'Investigate, mediate, resolve', icon: 'M10 2v14M5 5l-3 5.5a2.5 2.5 0 005 0L5 5zM15 5l-3 5.5a2.5 2.5 0 005 0L15 5zM5 5h10M6 18h8' },
  { href: '/admin/properties', label: 'Manage Properties', desc: 'Suspend suspicious listings', icon: 'M3 10l7-7 7 7v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1v-8z' },
  { href: '/admin/audit-logs', label: 'Audit Logs', desc: 'Every admin action recorded', icon: 'M6 3h9l3 3v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 9h6M9 13h6' },
] as const

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
      const token = localStorage.getItem('hl_token') || ''
      const res = await fetch(`${API_URL}/api/v1/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      const k: LiveKpis | undefined = json.data?.kpis
      const charts: AnalyticsCharts | undefined = json.data?.charts
      if (k) {
        setStats(k)
        setKpis([
          { label: 'Pending Verification', value: String(k.pendingVerification), deltaLabel: `${k.totalProperties} listings`, deltaDirection: 'up' },
          { label: 'Open Fraud Reports', value: String(k.fraudReports), deltaLabel: `${k.totalApplications} applications`, deltaDirection: k.fraudReports > 0 ? 'up' : 'down' },
          { label: 'Active Disputes', value: String(k.openDisputes), deltaLabel: `${k.activeRentals} active rentals`, deltaDirection: k.openDisputes > 0 ? 'up' : 'down' },
          {
            label: 'Verification Rate',
            value: k.totalProperties > 0 ? `${Math.round((k.verifiedProperties / k.totalProperties) * 100)}%` : '0%',
            deltaLabel: `${k.verifiedProperties}/${k.totalProperties} verified`,
            deltaDirection: 'up',
          },
        ])
      }
      if (charts?.fraudByType) {
        setFraudRows(charts.fraudByType.map((f) => ({ type: f.label, count: f.value })))
      }
      if (charts?.verificationStats) {
        setVerificationSlices(
          charts.verificationStats.map((v) => ({
            name: v.label.charAt(0).toUpperCase() + v.label.slice(1),
            value: v.value,
          })),
        )
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
    if (!token) return
    fetch(`${API_URL}/api/v1/properties/all`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const props = j?.data || []
        if (!Array.isArray(props) || props.length === 0) return
        const score = (p: any) => Math.max(Number(p.fraudRiskScore) || 0, p.riskLevel === 'high' ? 75 : p.riskLevel === 'medium' ? 40 : 5)
        const high = props.filter((p: any) => score(p) >= 60).length
        const medium = props.filter((p: any) => score(p) >= 30 && score(p) < 60).length
        const low = props.length - high - medium
        const pct = (n: number) => Math.round((n / props.length) * 100)
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

        {/* Sprint 12 — live platform KPIs */}
        {stats && (
          <section className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
            <h2 className="font-display text-lg font-semibold text-charcoal">Platform Overview</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Total Users', stats.totalUsers],
                ['Landlords', stats.totalLandlords],
                ['Tenants', stats.totalTenants],
                ['Properties', stats.totalProperties],
                ['Verified', stats.verifiedProperties],
                ['Applications', stats.totalApplications],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-charcoal/10 bg-cream px-3 py-2.5">
                  <p className="font-display text-xl font-semibold text-charcoal">{Number(value).toLocaleString()}</p>
                  <p className="text-xs text-charcoal/60">{label}</p>
                </div>
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

        {/* Sprint 12 — admin controls hub */}
        <section className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
          <h2 className="font-display text-lg font-semibold text-charcoal">Admin Controls</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group flex items-start gap-3 rounded-lg border border-charcoal/10 p-3.5 transition-colors hover:bg-sand/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-rust-tint text-rust-dark">
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
