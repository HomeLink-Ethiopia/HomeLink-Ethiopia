import Image from 'next/image'
import Link from 'next/link'
import type { Property } from '@/lib/properties'

interface CurrentHomeCardProps {
  property: Property
  leaseEnds: string
  status: string
}

export default function CurrentHomeCard({ property, leaseEnds, status }: CurrentHomeCardProps) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-charcoal">My Current Home</h3>
      </div>

      <div className="mt-3 flex gap-4">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md">
          <Image src={property.image} alt={property.title} fill sizes="112px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-medium text-charcoal">{property.title}</p>
            <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              {status}
            </span>
          </div>
          <p className="text-sm text-charcoal/60">{property.neighborhood}, Addis Ababa</p>
          <p className="mt-1 text-xs text-charcoal/50">Lease ends {leaseEnds}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/property/${property.id}`}
          className="flex-1 rounded border border-charcoal/15 py-2 text-center text-sm font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust"
        >
          View Details
        </Link>
        <button
          type="button"
          className="flex-1 rounded border border-charcoal/15 py-2 text-sm font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust"
        >
          Download Lease
        </button>
      </div>
    </div>
  )
}
