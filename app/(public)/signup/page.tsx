'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '@/types/roles'
import Logo from '@/components/Logo'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [role, setRole] = useState<Role>('tenant')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  })
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number
    message: string
    color: string
  }>({ score: 0, message: '', color: '' })

  const validatePassword = (password: string) => {
    let score = 0
    if (password.length === 0) return { score: 0, message: '', color: '' }
    if (password.length < 8) return { score: 1, message: 'Too short (minimum 8 characters)', color: 'text-red-600' }
    score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return { score, message: 'Weak password', color: 'text-red-600' }
    if (score === 3) return { score, message: 'Medium password', color: 'text-yellow-600' }
    if (score === 4) return { score, message: 'Good password', color: 'text-green-600' }
    return { score, message: 'Strong password', color: 'text-green-700' }
  }

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password })
    setPasswordStrength(validatePassword(password))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.agreeToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (passwordStrength.score < 3) {
      setError('Please use a stronger password')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Registration failed')
        setLoading(false)
        return
      }

      // Show OTP screen with verification code from backend
      setVerificationCode(data.verificationCode || '')
      setStep('otp')
    } catch (err) {
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: otpCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Invalid verification code')
        setLoading(false)
        return
      }

      // Success! Redirect to login
      router.push('/login?verified=true')
    } catch (err) {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message || 'Failed to resend code')
      } else {
        alert('New verification code sent to your email!')
      }
    } catch {
      setError('Failed to resend code')
    }
  }

  // OTP Verification Step
  if (step === 'otp') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Logo className="mx-auto justify-center" />
          </div>

          <div className="rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-green-600">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <h1 className="mt-4 text-center font-display text-2xl font-bold text-charcoal">Check Your Email</h1>
            <p className="mt-2 text-center text-sm text-charcoal/60">
              We sent a 6-digit verification code to
            </p>
            <p className="mt-1 text-center font-semibold text-charcoal">{formData.email}</p>
            
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-center text-sm text-green-700">
                📧 A verification code has been sent to your email.
              </p>
              <p className="mt-1 text-center text-xs text-green-600">
                Check your inbox and spam folder for the 6-digit code.
              </p>
            </div>
            {verificationCode && (
              <div 
                className="mt-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-3 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => {
                  const newOtp = verificationCode.split('')
                  setOtp(newOtp)
                  const lastInput = document.getElementById(`otp-${newOtp.length - 1}`)
                  lastInput?.focus()
                }}
              >
                <p className="text-center text-xs text-blue-500 mb-1">Your verification code (click to auto-fill):</p>
                <p className="text-center text-2xl font-bold tracking-[8px] text-blue-700 font-mono">{verificationCode}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-center gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otp[index] && index > 0) {
                      const prevInput = document.getElementById(`otp-${index - 1}`)
                      prevInput?.focus()
                    }
                  }}
                  className="h-12 w-12 rounded-lg border-2 border-charcoal/20 text-center text-xl font-bold text-charcoal transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.some(d => !d)}
              className="mt-6 w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>

            <button
              onClick={() => setStep('form')}
              className="mt-3 w-full text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
            >
              Change email address
            </button>

            <p className="mt-6 text-center text-xs text-charcoal/50">
              Didn&apos;t receive the code?{' '}
              <button 
                onClick={handleResendCode}
                className="font-semibold text-rust hover:text-rust-dark"
              >
                Resend code
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Registration Form Step
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="mx-auto justify-center" />
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-charcoal">Create Your Account</h1>
          <p className="mt-2 text-sm text-charcoal/60">Join HomeLink Ethiopia today</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Role Selection */}
            <div>
              <label className="text-sm font-medium text-charcoal">I am a</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('tenant')}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    role === 'tenant'
                      ? 'border-rust bg-rust text-white'
                      : 'border-charcoal/20 bg-white text-charcoal hover:border-rust'
                  }`}
                >
                  🏠 Tenant
                </button>
                <button
                  type="button"
                  onClick={() => setRole('landlord')}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    role === 'landlord'
                      ? 'border-rust bg-rust text-white'
                      : 'border-charcoal/20 bg-white text-charcoal hover:border-rust'
                  }`}
                >
                  🏢 Landlord
                </button>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-charcoal">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                  placeholder="Abebe"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-charcoal">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                  placeholder="Kebede"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-charcoal">Email Address</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="you@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-charcoal">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="0911234567"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-charcoal">Password</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="Strong password"
              />
              {formData.password && (
                <div className="mt-2 space-y-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal/10">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength.score <= 2 ? 'bg-red-500' :
                        passwordStrength.score === 3 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={formData.password.length >= 8 ? 'text-green-600' : 'text-charcoal/40'}>{formData.password.length >= 8 ? '✓' : '○'}</span>
                      <span className={formData.password.length >= 8 ? 'text-green-600' : 'text-charcoal/50'}>8+ characters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/40'}>{/[A-Z]/.test(formData.password) ? '✓' : '○'}</span>
                      <span className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/50'}>Uppercase (A-Z)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/40'}>{/[a-z]/.test(formData.password) ? '✓' : '○'}</span>
                      <span className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/50'}>Lowercase (a-z)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/40'}>{/[0-9]/.test(formData.password) ? '✓' : '○'}</span>
                      <span className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/50'}>Number (0-9)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/40'}>{/[^A-Za-z0-9]/.test(formData.password) ? '✓' : '○'}</span>
                      <span className={/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : 'text-charcoal/50'}>Symbol (!@#$%)</span>
                    </div>
                  </div>
                  <p className="text-xs text-charcoal/40">Example: Tsedenia123#</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-charcoal">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="mt-1.5 w-full rounded-lg border border-charcoal/20 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal/40 transition-colors focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/20"
                placeholder="Re-enter password"
              />
            </div>

            {/* Terms & Conditions */}
            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                required
                className="mt-1 h-4 w-4 rounded border-charcoal/20 text-rust focus:ring-rust"
              />
              <label htmlFor="terms" className="ml-2 text-sm text-charcoal/70">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="font-medium text-rust hover:text-rust-dark underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="font-medium text-rust hover:text-rust-dark underline">Privacy Policy</a>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !formData.agreeToTerms}
              className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal/60">
            Already have an account?{' '}
            <a href="/login" className="font-semibold text-rust hover:text-rust-dark transition-colors">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
