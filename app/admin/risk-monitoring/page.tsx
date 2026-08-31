'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/admin/TopBar'

/* ─── MOCK DATA ─────────────────────────────────────────────────────── */

const RISK_PROPERTIES = [
  { id: 'P-1023', title: '1 Bedroom in Piassa', landlord: 'Abebe K.', riskScore: 87, reasons: ['Duplicate phone number', 'Price 40% below market', 'New account (< 7 days)'], status: 'High Risk' as const },
  { id: 'P-1089', title: '3 Bedroom in Bole', landlord: 'Mulugeta D.', riskScore: 62, reasons: ['Image found on 3 other listings', 'Missing ownership docs'], status: 'Medium Risk' as const },
  { id: 'P-1102', title: '2 Bedroom in CMC', landlord: 'Tigist M.', riskScore: 45, reasons: ['Verified landlord, slight pricing anomaly'], status: 'Low Risk' as const },
  { id: 'P-1115', title: 'Villa in Old Airport', landlord: 'Worku S.', riskScore: 91, reasons: ['Reported by 2 tenants', 'Payment request outside platform', 'Stolen photos from another site'], status: 'High Risk' as const },
  { id: 'P-1134', title: 'Studio in Kazanchis', landlord: 'Hanna L.', riskScore: 32, reasons: ['Minor data inconsistency'], status: 'Low Risk' as const },
  { id: 'P-1156', title: '2 Bedroom in Yeka', landlord: 'Dawit T.', riskScore: 78, reasons: ['Multiple accounts same phone', 'Unusual listing pattern'], status: 'High Risk' as const },
]

const ACCOUNT_ALERTS = [
  { account: 'Abebe K.', email: 'abebek@email.com', riskScore: 82, flags: ['Duplicate phone', 'Multiple IPs'], action: 'Investigate' },
  { account: 'Worku S.', email: 'worku.s@email.com', riskScore: 94, flags: ['Payment scam pattern', '2 fraud reports'], action: 'Suspend' },
  { account: 'Mulugeta D.', email: 'mulugeta@email.com', riskScore: 58, flags: ['Stale verification'], action: 'Review' },
]

const FRAUD_SIGNALS = [
  { signal: 'Duplicate images detected', count: 23, trend: '+8', severity: 'high' as const },
  { signal: 'Price significantly below market', count: 17, trend: '+3', severity: 'medium' as const },
  { signal: 'Same phone on multiple accounts', count: 12, trend: '+5', severity: 'high' as const },
  { signal: 'New account + high-value listing', count: 9, trend: '+2', severity: 'medium' as const },
  { signal: 'Payments requested outside platform', count: 6, trend: '+1', severity: 'critical' as const },
]

const RISK_TREND = [
  { month: 'Mar', high: 14, medium: 22, low: 64 },
  { month: 'Apr', high: 18, medium: 25, low: 57 },
  { month: 'May', high: 12, medium: 19, low: 69 },
  { month: 'Jun', high: 21, medium: 28, low: 51 },
  { month: 'Jul', high: 16, medium: 23, low: 61 },
  { month: 'Aug', high: 19, medium: 21, low: 60 },
]

/* ─── COMPONENTS ────────────────────────────────────────────────────── */

function RiskBadge({ level }: { level: 'High Risk' | 'Medium Risk' | 'Low Risk' }) {
  const cls = level === 'High Risk' ? 'bg-red-50 text-red-700 border-red-200' :
    level === 'Medium Risk' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-green-50 text-green-700 border-green-200'
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{level}</span>
}

function RiskGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#dc2626' : score >= 50 ? '#f59e0b' : '#16a34a'
  const circumference = 2 * Math.PI * 28
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="-rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#F5F1EC" strokeWidth="4" />
        <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-charcoal">{score}</span>
    </div>
  )
}

function SeverityDot({ severity }: { severity: 'high' | 'medium' | 'critical' }) {
  const color = severity === 'critical' ? 'bg-red-600' : severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
}

/* ─── PAGE ──────────────────────────────────────────────────────────── */

export default function RiskMonitoringPage() {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const active = RISK_PROPERTIES.find((p) => p.id === selectedProperty) ?? null

  return (
    <>
      <TopBar title="Risk Monitoring" />

      <main className="flex-1 space-y-6 px-6 py-8 sm:px-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'High Risk Properties', value: '8', change: '+3 this week', color: 'text-red-600' },
            { label: 'Flagged Accounts', value: '14', change: '+5 this week', color: 'text-orange-600' },
            { label: 'Active Investigations', value: '6', change: '3 pending review', color: 'text-amber-600' },
            { label: 'Risk Score (Platform)', value: '72/100', change: '+4 vs last month', color: 'text-verified' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-charcoal/50">{kpi.label}</p>
              <p className="mt-2 font-display text-2xl font-bold text-charcoal">{kpi.value}</p>
              <p className={`mt-1 text-[11px] font-semibold ${kpi.color}`}>{kpi.change}</p>
            </div>
          ))}
        </div>

        {/* Main grid: Flagged Properties + Fraud Signals */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Flagged Properties List */}
          <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-charcoal/8 px-5 py-4">
              <h3 className="font-display text-base font-bold text-charcoal">AI-Flagged Properties</h3>
              <p className="text-xs text-charcoal/50">Properties with elevated fraud risk scores</p>
            </div>
            <div className="divide-y divide-charcoal/8">
              {RISK_PROPERTIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProperty(p.id === selectedProperty ? null : p.id)}
                  className={`flex w-full items-center gap-4 p-4 text-left transition-colors ${
                    selectedProperty === p.id ? 'bg-rust-tint/30' : 'hover:bg-sand/30'
                  }`}
                >
                  <RiskGauge score={p.riskScore} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-charcoal/40">{p.id}</span>
                      <RiskBadge level={p.status} />
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-charcoal">{p.title}</p>
                    <p className="text-xs text-charcoal/50">Landlord: {p.landlord}</p>
                  </div>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-charcoal/30">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="space-y-4">
            {active ? (
              <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-charcoal/40">{active.id}</span>
                  <RiskBadge level={active.status} />
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-charcoal">{active.title}</h2>
                <p className="text-xs text-charcoal/50">Landlord: {active.landlord}</p>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Risk Factors</h4>
                  <div className="mt-2 space-y-2">
                    {active.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-red-50/50 p-2.5 text-sm text-charcoal/70">
                        <svg viewBox="0 0 16 16" fill="#dc2626" className="mt-0.5 h-3.5 w-3.5 shrink-0">
                          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
                        </svg>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-lg bg-rust px-3 py-2 text-xs font-semibold text-white hover:bg-rust-dark transition-colors">
                    Investigate
                  </button>
                  <button className="flex-1 rounded-lg border border-charcoal/15 px-3 py-2 text-xs font-semibold text-charcoal/60 hover:bg-sand transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-charcoal/8 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-charcoal/40">Select a property to view risk details</p>
              </div>
            )}

            {/* Fraud Signals */}
            <div className="rounded-xl border border-charcoal/8 bg-white p-5 shadow-sm">
              <h3 className="font-display text-sm font-semibold text-charcoal">Top Fraud Signals</h3>
              <div className="mt-3 space-y-2.5">
                {FRAUD_SIGNALS.map((s) => (
                  <div key={s.signal} className="flex items-center gap-3">
                    <SeverityDot severity={s.severity} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-charcoal/70 truncate">{s.signal}</p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-charcoal">{s.count}</span>
                    <span className="text-[10px] text-red-500 font-semibold">{s.trend}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Trend Chart */}
        <div className="rounded-xl border border-charcoal/8 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="font-display text-base font-bold text-charcoal">Risk Trend (6 Months)</h3>
            <p className="text-xs text-charcoal/50">Monthly distribution of flagged properties by risk level</p>
          </div>
          <div className="flex items-end gap-3 h-48">
            {RISK_TREND.map((m) => (
              <div key={m.month} className="group flex flex-1 flex-col items-center gap-1">
                <div className="hidden group-hover:block text-[10px] font-mono font-semibold text-charcoal/70 mb-1">
                  H:{m.high} M:{m.medium} L:{m.low}
                </div>
                <div className="w-full flex flex-col gap-0.5" style={{ height: '120px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(m.high / (m.high + m.medium + m.low)) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="w-full rounded-t bg-red-500"
                    style={{ minHeight: '2px' }}
                  />
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(m.medium / (m.high + m.medium + m.low)) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full bg-amber-400"
                  />
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(m.low / (m.high + m.medium + m.low)) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full rounded-b bg-green-400"
                  />
                </div>
                <span className="text-[10px] font-mono text-charcoal/40 mt-1">{m.month}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[11px] text-charcoal/50">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-400" /> Low</span>
          </div>
        </div>

        {/* Flagged Accounts */}
        <div className="rounded-xl border border-charcoal/8 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-charcoal/8 px-5 py-4">
            <h3 className="font-display text-base font-bold text-charcoal">Flagged Accounts</h3>
            <p className="text-xs text-charcoal/50">Accounts with suspicious behavior patterns</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-sand/40 text-xs uppercase tracking-wider text-charcoal/45">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Account</th>
                  <th className="px-5 py-3 text-left font-medium">Risk Score</th>
                  <th className="px-5 py-3 text-left font-medium">Flags</th>
                  <th className="px-5 py-3 text-left font-medium">Recommended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/8">
                {ACCOUNT_ALERTS.map((a, i) => (
                  <tr key={a.email} className={`hover:bg-sand/20 transition-colors ${i % 2 === 0 ? '' : 'bg-cream/40'}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-charcoal">{a.account}</p>
                      <p className="text-xs text-charcoal/50">{a.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-sand overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${a.riskScore}%`,
                              backgroundColor: a.riskScore >= 75 ? '#dc2626' : a.riskScore >= 50 ? '#f59e0b' : '#16a34a',
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-charcoal">{a.riskScore}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.flags.map((f) => (
                          <span key={f} className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        a.action === 'Suspend' ? 'bg-red-600 text-white hover:bg-red-700' :
                        a.action === 'Investigate' ? 'bg-rust text-white hover:bg-rust-dark' :
                        'border border-charcoal/15 text-charcoal/60 hover:bg-sand'
                      }`}>
                        {a.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  )
}
