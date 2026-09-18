'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'

/**
 * Shared Settings page for tenant & landlord dashboards.
 * Language preference persists in localStorage; signing out clears the
 * real session (token, user, session_role cookie) and returns to home.
 */
export default function SettingsPage({ dashboard }: { dashboard: 'tenant' | 'landlord' | 'admin' }) {
  const router = useRouter()
  const { locale, setLocale } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const signOut = () => {
    localStorage.removeItem('hl_token')
    localStorage.removeItem('hl_user')
    document.cookie = 'session_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.replace('/')
  }

  return (
    <div className="min-h-full bg-cream">
      <TopBar title="Settings" subtitle="Preferences and account actions" />

      <main className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
        <section className="mb-6 rounded-xl border border-charcoal/10 bg-white p-6">
          <h2 className="mb-1 font-display text-lg font-semibold text-charcoal">Language</h2>
          <p className="mb-4 text-sm text-charcoal/60">
            Choose the language used across your dashboard.
          </p>
          {mounted && (
            <div className="flex gap-2">
              {(['EN', 'AM'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    locale === lang
                      ? 'bg-rust text-white'
                      : 'bg-sand text-charcoal/70 hover:bg-charcoal/10'
                  }`}
                >
                  {lang === 'EN' ? 'English' : 'አማርኛ'}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-charcoal/10 bg-white p-6">
          <h2 className="mb-1 font-display text-lg font-semibold text-charcoal">Sign out</h2>
          <p className="mb-4 text-sm text-charcoal/60">
            Ends your session on this device. You can sign in again anytime.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Sign out of {dashboard} account
          </button>
        </section>
      </main>
    </div>
  )
}
