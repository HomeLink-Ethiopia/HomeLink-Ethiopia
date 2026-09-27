'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import TopBar from '@/components/admin/TopBar'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ChartPoint {
  label: string
  value: number
}

interface Analytics {
  kpis: Record<string, number>
  charts: {
    propertiesByCity: ChartPoint[]
    usersByRole: ChartPoint[]
    propertiesByPriceRange: ChartPoint[]
    verificationStats: ChartPoint[]
    fraudByType: ChartPoint[]
    applicationTrend: ChartPoint[]
  }
}

const COLORS = ['#9A4B2F', '#C9793F', '#5B7553', '#B9A44C', '#7A6A8A', '#4E7D8C']

const PIE_LABELS: Record<string, string> = {
  fake_property: 'Fake property',
  fake_landlord: 'Fake landlord',
  scam: 'Scam',
  duplicate_listing: 'Duplicate listing',
  suspicious_payment: 'Suspicious payment',
  misleading_info: 'Misleading info',
}

function KpiTile({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-rust/30 bg-rust-tint/30' : 'border-charcoal/10 bg-white'}`}>
      <p className="font-display text-2xl font-semibold text-charcoal">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-xs text-charcoal/60">{label}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp">
      <h2 className="font-display text-base font-semibold text-charcoal">{title}</h2>
      <div className="mt-3 h-64">{children}</div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const getToken = () => localStorage.getItem('hl_token') || ''

  const load = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`${API_URL}/api/v1/admin/analytics`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data)
    } catch {
      setError('Could not load analytics. Is the backend running and are you logged in as admin?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <>
        <TopBar title="Platform Analytics" />
        <main className="space-y-6 px-6 py-8 sm:px-8">
          <SkeletonList count={4} />
        </main>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <TopBar title="Platform Analytics" />
        <main className="px-6 py-8 sm:px-8">
          <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        </main>
      </>
    )
  }

  const k = data.kpis
  const fraudData = data.charts.fraudByType.map((f) => ({ ...f, label: PIE_LABELS[f.label] || f.label }))
  const roleData = data.charts.usersByRole.map((r) => ({ ...r, label: r.label.charAt(0).toUpperCase() + r.label.slice(1) }))

  return (
    <>
      <TopBar title="Platform Analytics" />
      <main className="space-y-6 px-6 py-8 sm:px-8">
        {/* KPI grid — Sprint 12 spec */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Users</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile value={k.totalUsers} label="Total users" />
            <KpiTile value={k.totalLandlords} label="Landlords" />
            <KpiTile value={k.totalTenants} label="Tenants" />
            <KpiTile value={k.totalAdmins} label="Admins" />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Properties & Rentals</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile value={k.totalProperties} label="Total properties" />
            <KpiTile value={k.verifiedProperties} label="Verified properties" />
            <KpiTile value={k.pendingVerification} label="Pending verification" />
            <KpiTile value={k.activeRentals} label="Active rentals" />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Activity & Risk</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile value={k.totalApplications} label="Applications" />
            <KpiTile value={k.pendingApplications} label="Pending applications" accent />
            <KpiTile value={k.fraudReports} label="Open fraud reports" accent />
            <KpiTile value={k.openDisputes} label="Open disputes" accent />
          </div>
        </section>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Properties by city">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.propertiesByCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#9A4B2F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Users by role">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" stroke="none">
                  {roleData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Properties by price range (ETB/month)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.propertiesByPriceRange}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#5B7553" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Verification statistics">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.verificationStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4E7D8C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Application trend (monthly)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.applicationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#C9793F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Fraud reports by type">
            {fraudData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-charcoal/40">
                No fraud reports yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fraudData} dataKey="value" nameKey="label" outerRadius="80%" stroke="none">
                    {fraudData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </main>
    </>
  )
}
