'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

/**
 * Property listing is only available to authenticated landlords
 * inside their dashboard at /landlord/properties/new
 * 
 * This page redirects accordingly.
 */
export default function ListPropertyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    
    if (user?.role === 'landlord') {
      // Logged-in landlord → go to their property creation page
      router.push('/landlord/properties/new')
    } else if (user?.role === 'tenant' || user?.role === 'admin') {
      // Wrong role → go to their dashboard
      router.push(user.role === 'admin' ? '/admin/dashboard' : '/tenant/dashboard')
    }
    // Not logged in → show the info page below
  }, [user, loading, router])

  // Show info page while loading or if not logged in
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-charcoal/10 border-t-rust" />
      </div>
    )
  }

  if (user) return null // Redirecting...

  return (
    <div className="bg-cream py-20">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-rust font-semibold">Landlord Portal</p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-charcoal sm:text-4xl">
          List Your Property
        </h1>
        <p className="mt-4 text-base text-charcoal/70">
          To list a property on HomeLink Ethiopia, you need a landlord account. 
          Our verification process ensures tenants trust your listings.
        </p>
        
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-charcoal">How it works:</h2>
          <div className="mt-4 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rust text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-charcoal">Create a Landlord Account</p>
                <p className="text-xs text-charcoal/50">Sign up and select &quot;I have properties to rent&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rust text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-charcoal">Get Verified</p>
                <p className="text-xs text-charcoal/50">Upload your identity and ownership documents</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rust text-xs font-bold text-white">3</span>
              <div>
                <p className="text-sm font-medium text-charcoal">List Your Property</p>
                <p className="text-xs text-charcoal/50">Add details, photos, and set your price</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="rounded-lg bg-rust px-6 py-3 font-semibold text-white shadow-sm hover:bg-rust-dark transition-colors"
          >
            Create Landlord Account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-charcoal/20 px-6 py-3 font-semibold text-charcoal/70 hover:bg-charcoal/5 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
