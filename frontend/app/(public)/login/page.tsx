'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import Logo from '@/components/Logo'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justVerified = searchParams.get('verified') === 'true'
  const redirectUrl = searchParams.get('redirect')

  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(email, password, redirectUrl || undefined)
      if (!result.success) {
        setError(result.error || 'Invalid email or password.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = async (devEmail: string) => {
    setEmail(devEmail)
    setPassword('Password123!')
    setError('')
    setLoading(true)
    try {
      const result = await login(devEmail, 'Password123!', redirectUrl || undefined)
      if (!result.success) {
        setError(result.error || 'Dev login failed.')
      }
    } catch {
      setError('Dev login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="mx-auto justify-center" />
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-charcoal">Sign In</h1>
          <p className="mt-2 text-sm text-charcoal/60">Sign in to your account to continue</p>

          {justVerified && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              ✅ Your email has been verified! You can now sign in.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-charcoal">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-charcoal">Password</label>
                <a href="/forgot-password" className="text-sm font-medium text-rust hover:text-rust-dark transition-colors">Forgot?</a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center">
              <input id="remember" type="checkbox" className="h-4 w-4 rounded border-charcoal/20 text-rust focus:ring-rust" />
              <label htmlFor="remember" className="ml-2 text-sm text-charcoal/70">Remember me for 30 days</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal/60">
            Don&apos;t have an account?{' '}
            <a
              href={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
              className="font-semibold text-rust hover:text-rust-dark transition-colors"
            >
              Create one
            </a>
          </p>

          {/* Dev Quick Login for testing without typing */}
          <div className="mt-6 border-t border-charcoal/10 pt-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal/45">
                ⚡ Dev Quick Login
              </span>
              <span className="font-mono text-[10px] text-charcoal/35">1-click test login</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDevLogin('dev.tenant@homelink.test')}
                disabled={loading}
                className="rounded-lg border border-charcoal/15 bg-sand/30 py-2 text-center text-xs font-semibold text-charcoal transition-all hover:border-rust hover:bg-white hover:text-rust disabled:opacity-50"
              >
                Tenant
              </button>
              <button
                type="button"
                onClick={() => handleDevLogin('dev.landlord@homelink.test')}
                disabled={loading}
                className="rounded-lg border border-charcoal/15 bg-sand/30 py-2 text-center text-xs font-semibold text-charcoal transition-all hover:border-rust hover:bg-white hover:text-rust disabled:opacity-50"
              >
                Landlord
              </button>
              <button
                type="button"
                onClick={() => handleDevLogin('dev.admin@homelink.test')}
                disabled={loading}
                className="rounded-lg border border-charcoal/15 bg-sand/30 py-2 text-center text-xs font-semibold text-charcoal transition-all hover:border-rust hover:bg-white hover:text-rust disabled:opacity-50"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
