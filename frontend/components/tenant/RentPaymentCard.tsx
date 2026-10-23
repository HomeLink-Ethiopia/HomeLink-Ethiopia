import { formatEtb } from '@/lib/properties'

interface RentPaymentCardProps {
  month: string
  amountEtb: number
  paidOn: string
}

export default function RentPaymentCard({ month, amountEtb, paidOn }: RentPaymentCardProps) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <h3 className="font-display text-lg font-semibold text-charcoal">Rent Payment</h3>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-charcoal/60">{month}</p>
        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
          Paid
        </span>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold text-charcoal">{formatEtb(amountEtb)}</p>
      <p className="text-xs text-charcoal/50">Paid on {paidOn}</p>

      <button
        type="button"
        className="mt-4 w-full rounded border border-charcoal/15 py-2 text-sm font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust"
      >
        View Payment History
      </button>
    </div>
  )
}
