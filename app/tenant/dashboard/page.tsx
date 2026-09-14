'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/language-context'
import TopBar from '@/components/tenant/TopBar'
import HomeJourneyTracker from '@/components/tenant/HomeJourneyTracker'
import NextPaymentBox from '@/components/tenant/NextPaymentBox'
import CurrentHomeCard from '@/components/tenant/CurrentHomeCard'
import RentPaymentCard from '@/components/tenant/RentPaymentCard'
import QuickActions from '@/components/tenant/QuickActions'
import MaintenanceTrackerCard from '@/components/tenant/MaintenanceTrackerCard'
import AiRecommendations from '@/components/tenant/AiRecommendations'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface StoredUser {
  firstName?: string
  lastName?: string
  name?: string
  email?: string
}

export default function TenantDashboardPage() {
  const { t } = useLanguage()
  const [userName, setUserName] = useState('')
  const [payments, setPayments] = useState<{ amount: number; dueDate: string; paidDate?: string; status: string }[]>([])
  const [maintenance, setMaintenance] = useState<{ _id: string; title?: string; issue?: string; status?: string; createdAt?: string }[]>([])

  useEffect(() => {
    // Real logged-in user from auth storage
    try {
      const raw = localStorage.getItem('hl_user')
      if (raw) {
        const u: StoredUser = JSON.parse(raw)
        const n = u.firstName
          ? `${u.firstName} ${u.lastName || ''}`.trim()
          : u.name || ''
        setUserName(n)
      }
    } catch { /* ignore */ }

    const token = localStorage.getItem('hl_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }

    // Real payments (next + last payment cards)
    fetch(`${API_URL}/api/v1/payments/my`, { headers })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setPayments(d.data || []))
      .catch(() => setPayments([]))

    // Real maintenance requests
    fetch(`${API_URL}/api/v1/maintenance/my`, { headers })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setMaintenance(d.data || []))
      .catch(() => setMaintenance([]))
  }, [])

  const firstName = userName.split(' ')[0] || 'there'
  const pendingPayment = payments.find((p) => p.status !== 'paid')
  const lastPaid = payments.find((p) => p.status === 'paid')

  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86400000))
  }

  return (
    <>
      <TopBar tenantName={firstName} />

      <div className="flex-1 px-6 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-semibold text-charcoal sm:text-3xl">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-charcoal/60">Welcome back to your home journey.</p>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
          <div className="rounded-lg border border-charcoal/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-charcoal">Your Home Journey</h2>
            <div className="mt-6">
              <HomeJourneyTracker currentStepIndex={journeyStep(payments, maintenance)} />
            </div>
          </div>
          {pendingPayment ? (
            <NextPaymentBox amountEtb={pendingPayment.amount} dueInDays={daysUntil(pendingPayment.dueDate)} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-charcoal/20 bg-white p-6 text-center">
              <p className="text-sm font-medium text-charcoal">No upcoming payment</p>
              <p className="mt-1 text-xs text-charcoal/50">When you rent a home, your next rent payment will appear here.</p>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {lastPaid ? (
            <RentPaymentCard
              month={new Date(lastPaid.dueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              amountEtb={lastPaid.amount}
              paidOn={lastPaid.paidDate ? new Date(lastPaid.paidDate).toLocaleDateString() : '—'}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-charcoal/20 bg-white p-6">
              <p className="text-sm font-medium text-charcoal">No payment history yet</p>
              <p className="mt-1 text-xs text-charcoal/50">Your payment record builds once your lease starts.</p>
            </div>
          )}
          <CurrentHomePlaceholder />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <QuickActions />
          <MaintenanceTrackerCard
            requests={maintenance.slice(0, 3).map((m) => ({
              id: m._id,
              title: m.title || m.issue || 'Maintenance request',
              status:
                m.status === 'resolved' || m.status === 'closed'
                  ? 'Resolved'
                  : m.status === 'in_progress'
                  ? 'In Progress'
                  : m.status === 'assigned'
                  ? 'Assigned'
                  : 'Submitted',
              date: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '',
            }))}
          />
        </div>

        <div className="mt-8">
          <AiRecommendations />
        </div>
      </div>
    </>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function journeyStep(
  payments: { status: string }[],
  maintenance: unknown[]
): number {
  if (maintenance.length > 0) return 5
  if (payments.length > 0) return 4
  return 2
}

function CurrentHomePlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-charcoal/20 bg-white p-6">
      <p className="text-sm font-medium text-charcoal">No active lease</p>
      <p className="mt-1 text-xs text-charcoal/50">
        Once your application is approved and the agreement signed, your current home shows here.
      </p>
    </div>
  )
}
