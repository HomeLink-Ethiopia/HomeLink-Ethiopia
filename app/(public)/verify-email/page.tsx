'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { verifyEmail } from '@/lib/auth-db'
import Logo from '@/components/Logo'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const performVerification = async () => {
      try {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1500))
        
        if (!token) {
          setStatus('error')
          setMessage('No verification token provided.')
          return
        }

        // Verify the token
        const result = verifyEmail(token)
        
        if (result.success) {
          setStatus('success')
          setMessage('Your email has been verified successfully! You can now log in.')
        } else {
          setStatus('error')
          setMessage(result.error || 'Verification failed.')
        }
      } catch (err) {
        setStatus('error')
        setMessage('An unexpected error occurred. Please try again.')
      }
    }

    performVerification()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border border-charcoal/10 bg-white p-8 text-center shadow-sm">
          {status === 'verifying' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust"></div>
              </div>
              <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Verifying Your Email</h1>
              <p className="mt-2 text-sm text-charcoal/60">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-green-600">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Email Verified!</h1>
              <p className="mt-2 text-sm text-charcoal/60">{message}</p>
              
              <button
                onClick={() => router.push('/login')}
                className="mt-6 w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark"
              >
                Continue to Login
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-red-600">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="mt-4 font-display text-2xl font-bold text-charcoal">Verification Failed</h1>
              <p className="mt-2 text-sm text-charcoal/60">{message}</p>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full rounded-lg bg-rust px-4 py-3 font-semibold text-white transition-colors hover:bg-rust-dark"
                >
                  Create New Account
                </button>
                <Link
                  href="/support"
                  className="block text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
                >
                  Contact Support
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
