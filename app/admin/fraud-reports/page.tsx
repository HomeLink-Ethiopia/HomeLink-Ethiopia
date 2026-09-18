'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface FraudReport {
  _id: string
  reporterId?: { firstName?: string; lastName?: string; email?: string } | string
  propertyId?: { title?: string; location?: string } | string
  reportedUserId?: string
  reportType: string
  description?: string
  status: string
  adminNotes?: string
  riskScore?: number
  createdAt: string
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  resolved: 'bg-green-50 text-green-700 border border-green-200',
  dismissed: 'bg-gray-50 text-gray-600 border border-gray-200',
}

const TYPE_LABELS: Record<string, string> = {
  fake_property: 'Fake Listing',
  fake_landlord: 'Fake Landlord',
  scam: 'Scam',
  duplicate_listing: 'Duplicate Listing',
  suspicious_payment: 'Suspicious Payment',
  misleading_info: 'Misleading Info',
}

export default function FraudReportsPage() {
  const [reports, setReports] = useState<FraudReport[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const active = reports.find(r => r._id === activeId) ?? null

  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    try {
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/fraud-reports`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setReports(data.data || [])
      }
    } catch (e) {
      console.error('Fetch fraud reports error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function updateReport(reportId: string, status: string, adminNotes?: string) {
    setActionLoading(reportId)
    try {
      const token = localStorage.getItem('homelink-token') || localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/fraud-reports/${reportId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status, adminNotes: adminNotes || '' }),
      })
      if (res.ok) {
        setReports(prev => prev.map(r => r._id === reportId ? { ...r, status, adminNotes: adminNotes || r.adminNotes } : r))
        if (activeId === reportId) setActiveId(null)
      }
    } catch (e) {
      console.error('Update report error:', e)
    } finally {
      setActionLoading(null)
    }
  }

  function addNote() {
    if (!active || !noteDraft.trim()) return
    updateReport(active._id, 'under_review', noteDraft.trim())
    setNoteDraft('')
  }

  return (
    <>
      <TopBar title="Fraud Reports" />
      <div className="flex-1 px-6 py-8 sm:px-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-charcoal/5" />)}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState title="No fraud reports" description="When tenants report suspicious activity, it will appear here." />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
            <div className="divide-y divide-charcoal/10 rounded-lg border border-charcoal/10 bg-white">
              {reports.map(r => {
                const reporterName = typeof r.reporterId === 'object' && r.reporterId
                  ? `${r.reporterId.firstName || ''} ${r.reporterId.lastName || ''}`.trim() || r.reporterId.email || 'User'
                  : 'User'
                const propertyTitle = typeof r.propertyId === 'object' && r.propertyId
                  ? r.propertyId.title || 'Property'
                  : r.propertyId || 'N/A'
                return (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => setActiveId(r._id)}
                    className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${activeId === r._id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'}`}
                  >
                    <div className="h-10 w-10 shrink-0 rounded-full bg-red-50 flex items-center justify-center">
                      <svg viewBox="0 0 20 20" fill="#dc2626" className="h-5 w-5">
                        <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal">{TYPE_LABELS[r.reportType] || r.reportType}</p>
                      <p className="truncate text-xs text-charcoal/50">{reporterName} reported {propertyTitle}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[r.status] || 'bg-gray-50 text-gray-600'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="h-fit rounded-lg border border-charcoal/10 bg-white p-5">
              {!active ? (
                <p className="text-sm text-charcoal/40">Select a report to view details.</p>
              ) : (
                <>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[active.status] || 'bg-gray-50 text-gray-600'}`}>
                    {active.status.replace('_', ' ')}
                  </span>
                  <h2 className="mt-2 font-display text-lg font-semibold text-charcoal">
                    {TYPE_LABELS[active.reportType] || active.reportType}
                  </h2>
                  <p className="text-xs text-charcoal/40">
                    Filed {new Date(active.createdAt).toLocaleDateString()}
                    {typeof active.propertyId === 'object' && active.propertyId?.title ? ` · ${active.propertyId.title}` : ''}
                  </p>
                  {active.description && (
                    <p className="mt-3 text-sm text-charcoal/70">{active.description}</p>
                  )}
                  {active.riskScore != null && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-charcoal/50">Risk Score:</span>
                      <span className={`text-sm font-bold ${active.riskScore >= 75 ? 'text-red-600' : active.riskScore >= 50 ? 'text-amber-600' : 'text-green-600'}`}>
                        {active.riskScore}/100
                      </span>
                    </div>
                  )}

                  {active.adminNotes && (
                    <div className="mt-3 rounded bg-cream p-2 text-sm text-charcoal/70">{active.adminNotes}</div>
                  )}

                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">Admin Notes</h3>
                    <textarea
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      rows={2}
                      placeholder="Add an investigation note..."
                      className="mt-2 w-full rounded border border-charcoal/15 bg-cream px-3 py-2 text-sm text-charcoal focus:border-rust focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={actionLoading === active._id || !noteDraft.trim()}
                        className="flex-1 rounded bg-rust px-3 py-2 text-xs font-medium text-white hover:bg-rust-dark disabled:opacity-50"
                      >
                        {actionLoading === active._id ? 'Saving...' : 'Add Note'}
                      </button>
                      {active.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => updateReport(active._id, 'resolved')}
                          disabled={actionLoading === active._id}
                          className="flex-1 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                      {active.status !== 'dismissed' && (
                        <button
                          type="button"
                          onClick={() => updateReport(active._id, 'dismissed')}
                          disabled={actionLoading === active._id}
                          className="flex-1 rounded border border-charcoal/15 px-3 py-2 text-xs font-medium text-charcoal/60 hover:bg-sand disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
