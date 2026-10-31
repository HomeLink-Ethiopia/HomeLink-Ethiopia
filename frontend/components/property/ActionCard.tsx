'use client'

import { useUIStore, useFavoritesStore } from '@/lib/store'
import type { BuildingUnit } from '@/lib/properties'

interface ActionCardProps {
  propertyId: string
  propertyTitle: string
  priceEtb: number
  depositEtb: number
  /** Landlord's User account id (property.landlord.accountId) — enables the Message button */
  landlordAccountId?: string
  landlordName?: string
  selectedUnit?: BuildingUnit | null
}

export default function ActionCard({
  propertyId,
  propertyTitle,
  priceEtb,
  depositEtb,
  landlordAccountId,
  landlordName,
  selectedUnit,
}: ActionCardProps) {
  const openModal = useUIStore((s) => s.openModal)
  const saved = useFavoritesStore((s) => s.favorites.has(propertyId))
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

  const unitRent = selectedUnit ? (selectedUnit.monthlyRent ?? (selectedUnit as any).rentAmount ?? 0) : null
  const effectivePrice = unitRent !== null && unitRent > 0 ? unitRent : priceEtb
  const effectiveDeposit = selectedUnit ? (selectedUnit.depositAmount || effectivePrice * 2) : depositEtb

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-sm">
      {selectedUnit && (
        <div className="mb-4 rounded-md border border-rust/30 bg-rust-tint/60 p-2.5 text-center">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-rust">
            Applying for Selected Unit
          </span>
          <span className="block font-display text-sm font-bold text-charcoal">
            {selectedUnit.name || selectedUnit.unitNumber} ({selectedUnit.sizeM2} m²)
          </span>
        </div>
      )}

      <div className="text-center">
        <p className="font-display text-4xl font-bold text-rust">
          ETB {effectivePrice.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-charcoal/60">
          / month {selectedUnit ? `(Unit ${selectedUnit.unitNumber})` : ''}
        </p>
        <p className="mt-2 text-sm text-charcoal/70">
          Deposit: <span className="font-semibold">ETB {effectiveDeposit.toLocaleString()}</span>
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() =>
            openModal('application', {
              propertyId,
              propertyTitle,
              selectedUnit: selectedUnit ? {
                id: selectedUnit.id,
                unitNumber: selectedUnit.unitNumber,
                name: selectedUnit.name,
                spaceType: selectedUnit.spaceType,
                monthlyRent: selectedUnit.monthlyRent,
                sizeM2: selectedUnit.sizeM2,
                floorNumber: selectedUnit.floorNumber
              } : undefined
            })
          }
          className="w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-rust-dark hover:shadow-md active:scale-[0.98]"
        >
          {selectedUnit ? `Apply for ${selectedUnit.unitNumber}` : 'Apply Now'}
        </button>
        
        <button
          type="button"
          onClick={() =>
            openModal('viewing', {
              propertyId,
              propertyTitle,
              selectedUnit: selectedUnit ? {
                unitNumber: selectedUnit.unitNumber,
                floorNumber: selectedUnit.floorNumber
              } : undefined
            })
          }
          className="w-full rounded-lg border-2 border-charcoal/15 px-5 py-3 text-sm font-bold text-charcoal transition-all hover:border-rust hover:text-rust active:scale-[0.98]"
        >
          {selectedUnit ? `Schedule Viewing for ${selectedUnit.unitNumber}` : 'Schedule Viewing'}
        </button>

        {landlordAccountId && (
          <button
            type="button"
            onClick={() =>
              openModal('message', { propertyId, propertyTitle, receiverId: landlordAccountId, receiverName: landlordName })
            }
            className="w-full rounded-lg border-2 border-rust/60 px-5 py-3 text-sm font-bold text-rust transition-all hover:bg-rust hover:text-white active:scale-[0.98]"
          >
            Message Landlord
          </button>
        )}

        <button
          type="button"
          onClick={() => toggleFavorite(propertyId)}
          aria-pressed={saved}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-charcoal/15 px-5 py-3 text-sm font-semibold text-charcoal transition-all hover:border-rust hover:text-rust"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={saved ? 0 : 1.5}
          >
            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
          </svg>
          {saved ? 'Saved' : 'Save Property'}
        </button>
      </div>
    </div>
  )
}
