import Image from 'next/image'
import Link from 'next/link'
import type { Landlord } from '@/lib/propertyDetails'

export default function LandlordCard({ landlord }: { landlord: Landlord }) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6">
      <h3 className="font-display text-lg font-semibold text-charcoal">Landlord</h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-charcoal/5">
          <Image src={landlord.avatar} alt={landlord.name} fill sizes="64px" className="object-cover" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-charcoal">{landlord.name}</p>
            {landlord.verified && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-verified">
                <path
                  fillRule="evenodd"
                  d="M10 1.5l6.5 2.9v5c0 4.6-2.8 8.7-6.5 9.9-3.7-1.2-6.5-5.3-6.5-9.9v-5L10 1.5zm3.4 6.4a.75.75 0 00-1.1-1L9 10.2 7.7 8.9a.75.75 0 10-1 1.1l1.8 1.8c.3.3.8.3 1 0l3.9-3.9z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <p className="mt-0.5 text-sm text-charcoal/60">
            {landlord.verified ? 'Verified Landlord' : 'Unverified'}
          </p>
          <p className="text-xs text-charcoal/50">Member since {landlord.memberSince}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-sm">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rust">
          <path d="M10 1.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8L10 1.5z" />
        </svg>
        <span className="font-semibold text-charcoal">{landlord.rating}</span>
        <span className="text-charcoal/50">({landlord.reviewCount} reviews)</span>
      </div>

      <Link
        href="/tenant/messages"
        className="mt-5 block w-full rounded-lg border-2 border-rust px-4 py-3 text-center text-sm font-semibold text-rust transition-all hover:bg-rust hover:text-white"
      >
        Message Landlord
      </Link>
    </div>
  )
}
