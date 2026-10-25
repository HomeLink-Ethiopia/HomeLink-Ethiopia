import Link from 'next/link'
import { formatEtb } from '@/lib/properties'

interface NextPaymentBoxProps {
  amountEtb: number
  dueInDays: number
}

export default function NextPaymentBox({ amountEtb, dueInDays }: NextPaymentBoxProps) {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-charcoal/10 bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-rust">Next Rent Payment</p>
        <p className="mt-0.5 text-xs text-charcoal/50">Due in {dueInDays} days</p>
        <p className="mt-3 font-display text-2xl font-semibold text-charcoal">{formatEtb(amountEtb)}</p>
      </div>
      <Link
        href="/tenant/payments"
        className="mt-4 block w-full rounded border border-charcoal/15 py-2 text-center text-sm font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust"
      >
        Pay / View Invoice →
      </Link>
    </div>
  )
}
