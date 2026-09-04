'use client'

import { useState } from 'react'
import Logo from '@/components/Logo'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [resetCode, setResetCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        // If backend returns the code directly (dev mode), show it
        if (data.resetCode) {
          setResetCode(data.resetCode)
        }
        setSent(true)
      } else {
        setError(data.message || 'Failed to send reset code. Please try again.')
      }
    } catch (err) {
      setError('Could not connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Logo className="mx-auto justify-center" />
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-green-600">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Check Your Email</h1>
            <p className="mt-2 text-sm text-charcoal/60">
              If an account exists for
            </p>
            <p className="mt-1 font-semibold text-charcoal">{email}</p>
            
            <p className="mt-4 text-sm text-charcoal/60">
              We sent a password reset code to your email. Enter it on the next page.
            </p>

            {resetCode && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                <strong>Your reset code: {resetCode}</strong>
                <br />
                <span className="text-xs text-blue-500">(Check your email too — this is shown for demo purposes)</span>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <a
                href={`/reset-password?email=${encodeURIComponent(email)}`}
                className="block w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark"
              >
                Enter Reset Code
              </a>
              
              <a
                href="/login"
                className="block w-full text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
              >
                Back to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="mx-auto justify-center" />
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-charcoal">Forgot Password?</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            No worries! Enter your email and we'll send you a reset code.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
