'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import Logo from '@/components/Logo'
import { ROLE_HOME } from '@/types/roles'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect') || ''
  const justVerified = searchParams.get('verified') === 'true'
  const { user, login } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resending, setResending] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNeedsVerification(false)
    setLoading(true)

    try {
      const result = await login(email, password, redirectParam)
      
      if (!result.success) {
        if (result.requiresVerification) {
          setNeedsVerification(true)
          setError(result.error || 'Please verify your email before logging in.')
        } else {
          setError(result.error || 'Invalid email or password. Please check your credentials.')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setResending(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (response.ok) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`)
      } else {
        setError(data.message || 'Failed to resend code')
      }
    } catch {
      setError('Failed to resend verification code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="mx-auto justify-center" />
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-charcoal">Welcome Back</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Sign in to access your HomeLink Ethiopia portal
          </p>

          {justVerified && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
              <span>✅</span>
              <span>Your email has been verified! You can now sign in with your credentials.</span>
            </div>
          )}

          {error && (
            <div className={`mt-4 rounded-lg border p-3 text-sm ${needsVerification ? 'border-yellow-200 bg-yellow-50 text-yellow-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <p>{error}</p>
              {needsVerification && (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="w-full rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50"
                  >
                    {resending ? 'Sending...' : '📧 Send Verification Code'}
                  </button>
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(email)}`}
                    className="block text-center text-xs font-semibold text-rust hover:underline"
                  >
                    Enter 6-digit code on verification page →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-charcoal">
                Email Address
              </label>
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
                <label htmlFor="password" className="block text-sm font-medium text-charcoal">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-rust hover:text-rust-dark transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 pr-10 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm text-charcoal/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-charcoal/20 text-rust focus:ring-rust"
                />
                <span className="ml-2">Remember me</span>
              </label>
              <Link
                href="/verify-email"
                className="text-xs text-charcoal/50 hover:text-rust transition-colors"
              >
                Verify code?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal/60">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-rust hover:text-rust-dark transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
