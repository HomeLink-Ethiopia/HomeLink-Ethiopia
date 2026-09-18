'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/landlord/TopBar'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/**
 * Shared Profile page for tenant & landlord dashboards.
 * Shows the user's real account data from GET /api/auth/profile and
 * lets them update their own names and phone via PUT /api/auth/profile.
 */
export default function ProfilePage({ dashboard }: { dashboard: 'tenant' | 'landlord' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<{
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    role?: string
    emailVerified?: boolean
  } | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      if (!token) {
        router.replace('/login')
        return
      }
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      const u = data.data || data.user
      setProfile(u)
      setFirstName(u.firstName || '')
      setLastName(u.lastName || '')
      setPhone(u.phone || '')
    } catch {
      setError('Could not load your profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName, lastName, phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || 'Could not save your changes.')
      } else {
        setProfile(data.data || data.user)
        // refresh cached user so TopBar shows the new name
        const apiUser = data.apiUser
        if (apiUser) localStorage.setItem('hl_user', JSON.stringify(apiUser))
        setMessage('Profile updated.')
      }
    } catch {
      setError('Could not reach the server.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-full bg-cream">
        <TopBar title="Profile" subtitle="Your account information" />
        <div className="px-6 py-8 sm:px-8">
          <SkeletonTable rows={3} cols={2} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-cream">
      <TopBar title="Profile" subtitle="Your account information" />

      <main className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <section className="rounded-xl border border-charcoal/10 bg-white p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rust font-display text-xl font-semibold text-white">
              {((profile?.firstName || '')[0] || '?').toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-charcoal">
                {`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'User'}
              </h2>
              <p className="text-sm capitalize text-charcoal/60">
                {profile?.role || dashboard} {profile?.emailVerified ? '· email verified' : '· email not verified'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-charcoal/70">First name</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-rust"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-charcoal/70">Last name</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-rust"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-charcoal/70">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XXXXXXXX"
                className="w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-rust"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-charcoal/70">Email</span>
              <input
                value={profile?.email || ''}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-charcoal/10 bg-sand px-3 py-2 text-sm text-charcoal/60"
              />
              <span className="mt-1 block text-xs text-charcoal/50">Email cannot be changed.</span>
            </label>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-rust px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rust/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
