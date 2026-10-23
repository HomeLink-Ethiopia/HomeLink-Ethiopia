'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { useAuth } from '@/lib/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const urlEmail = searchParams.get('email') || ''
  const urlCode = searchParams.get('code') || searchParams.get('token') || ''

  const [email, setEmail] = useState(urlEmail)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [resendNotice, setResendNotice] = useState('')
  const [rescueCode, setRescueCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Handle URL parameters auto-fill
  useEffect(() => {
    if (urlEmail) setEmail(urlEmail)
    if (urlCode && urlCode.length === 6) {
      setOtp(urlCode.split(''))
    }
  }, [urlEmail, urlCode])

  // Cooldown timer for resending
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '')
    if (digit.length > 1) {
      // User pasted multiple characters into a single box
      handlePaste(digit)
      return
    }

    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)

    if (digit && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handlePaste = (pastedText: string) => {
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('')
    if (digits.length === 0) return
    const newOtp = [...otp]
    digits.forEach((d, idx) => {
      newOtp[idx] = d
    })
    setOtp(newOtp)
    const focusIndex = Math.min(digits.length, 5)
    document.getElementById(`otp-${focusIndex}`)?.focus()
  }

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setMessage('')
    setRescueCode('')

    const code = otp.join('')
    if (!email.trim()) {
      setStatus('error')
      setMessage('Please enter your registered email address.')
      return
    }
    if (code.length !== 6) {
      setStatus('error')
      setMessage('Please enter the complete 6-digit verification code.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setStatus('success')
        setMessage('Your email has been verified successfully!')
        setTimeout(() => {
          router.push(`/login?verified=true&email=${encodeURIComponent(email)}`)
        }, 2200)
      } else {
        setStatus('error')
        setMessage(data.message || 'Invalid or expired verification code.')
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Unable to connect to verification server.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email.trim()) {
      setStatus('error')
      setMessage('Please enter your email to resend the code.')
      return
    }

    setResending(true)
    setMessage('')
    setResendNotice('')

    try {
      const res = await fetch(`${API_URL}/api/auth/resend-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setResendCooldown(60)
        setResendNotice('A new 6-digit code has been sent!')
        const code = data.devVerificationCode || data.verificationCode
        if (code) {
          setRescueCode(code)
          setOtp(code.split(''))
        }
      } else {
        setStatus('error')
        setMessage(data.message || 'Failed to resend verification code.')
      }
    } catch {
      setStatus('error')
      setMessage('Network error while requesting new code.')
    } finally {
      setResending(false)
    }
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center"><Logo className="mx-auto justify-center" /></div>
          <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8 text-green-600">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Email Verified!</h1>
            <p className="mt-2 text-sm text-charcoal/60">{message}</p>
            <p className="mt-4 text-xs text-charcoal/40">Redirecting you to sign in...</p>
            <Link
              href={`/login?verified=true&email=${encodeURIComponent(email)}`}
              className="mt-6 block w-full rounded-lg bg-rust px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rust-dark"
            >
              Continue to Login Now
            </Link>
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rust/10 text-rust">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="mt-4 text-center font-display text-2xl font-bold text-charcoal">
            Verify Your Email
          </h1>
          <p className="mt-2 text-center text-sm text-charcoal/60">
            Enter the 6-digit confirmation code sent to your email to activate your account.
          </p>

          {message && status === 'error' && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {message}
            </div>
          )}

          {resendNotice && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {resendNotice}
            </div>
          )}

          {rescueCode && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Dev Rescue:</strong> Your code is <span className="font-mono font-bold text-sm">{rescueCode}</span> (auto-filled below).
            </div>
          )}

          <form onSubmit={handleVerify} className="mt-6 space-y-5">
            <div>
              <label htmlFor="verify-email" className="block text-xs font-semibold uppercase tracking-wider text-charcoal/70">
                Email Address
              </label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal/70 mb-2">
                6-Digit Verification Code
              </label>
              <div
                className="flex justify-between gap-2"
                onPaste={(e) => {
                  e.preventDefault()
                  handlePaste(e.clipboardData.getData('text'))
                }}
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-12 w-12 rounded-lg border-2 border-charcoal/20 text-center font-mono text-xl font-bold text-charcoal transition-all focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Verifying Code...' : 'Verify Email & Continue'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-charcoal/60">
            <span>Didn&apos;t get a code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="font-semibold text-rust hover:text-rust-dark disabled:opacity-40 transition-colors"
            >
              {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>

          <div className="mt-6 text-center border-t border-charcoal/10 pt-4">
            <Link
              href="/login"
              className="text-xs font-medium text-charcoal/60 hover:text-charcoal transition-colors inline-flex items-center gap-1"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
