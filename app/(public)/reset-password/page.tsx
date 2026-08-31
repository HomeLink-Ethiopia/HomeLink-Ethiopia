'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resetPassword } from '@/lib/auth-db'
import Logo from '@/components/Logo'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [validToken, setValidToken] = useState<boolean | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number
    message: string
    color: string
  }>({ score: 0, message: '', color: '' })

  useEffect(() => {
    // Validate token exists
    if (!token) {
      setValidToken(false)
    } else {
      setValidToken(true)
    }
  }, [token])

  // Strong password validation
  const validatePassword = (password: string) => {
    let score = 0
    let message = ''
    let color = ''

    if (password.length === 0) {
      return { score: 0, message: '', color: '' }
    }

    if (password.length < 8) {
      return { score: 1, message: 'Too short (minimum 8 characters)', color: 'text-red-600' }
    }
    score++

    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) {
      message = 'Weak password'
      color = 'text-red-600'
    } else if (score === 3) {
      message = 'Medium password'
      color = 'text-yellow-600'
    } else if (score === 4) {
      message = 'Good password'
      color = 'text-green-600'
    } else {
      message = 'Strong password'
      color = 'text-green-700'
    }

    return { score, message, color }
  }

  const handlePasswordChange = (password: string) => {
    setPassword(password)
    setPasswordStrength(validatePassword(password))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!token) {
      setError('Invalid reset token')
      return
    }

    setLoading(true)

    try {
      const result = resetPassword(token, password)
      
      if (result.success) {
        setSuccess(true)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setError(result.error || 'Failed to reset password')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while validating token
  if (validToken === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mx-auto mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust"></div>
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Validating Link</h1>
            <p className="mt-2 text-sm text-charcoal/60">Please wait...</p>
          </div>
        </div>
      </div>
    )
  }

  // Invalid or expired token
  if (validToken === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mx-auto mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-red-600">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Invalid Reset Link</h1>
            <p className="mt-2 text-sm text-charcoal/60">
              This password reset link is invalid or has expired.
            </p>
            
            <div className="mt-6 space-y-3">
              <Link
                href="/forgot-password"
                className="block w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark"
              >
                Request New Link
              </Link>
              
              <Link
                href="/login"
                className="block text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mx-auto mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-green-600">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Password Reset!</h1>
            <p className="mt-2 text-sm text-charcoal/60">
              Your password has been reset successfully.
            </p>
            
            <p className="mt-4 text-sm text-charcoal/60">
              Redirecting you to login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Reset password form
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mx-auto mb-8 flex justify-center">
          <Logo />
        </div>

        {/* Reset Password Card */}
        <div className="rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-charcoal">Reset Your Password</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Enter your new password below
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-charcoal">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="At least 8 characters"
              />
              <p className="mt-1.5 text-xs text-charcoal/50">
                Must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-charcoal">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="Re-enter password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Login
            </Link>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-900">Security Tip</p>
          <p className="mt-1 text-xs text-blue-700">
            Choose a strong password that you don't use on other websites.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
