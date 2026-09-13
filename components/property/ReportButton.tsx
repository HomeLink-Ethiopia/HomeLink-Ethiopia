'use client'

import { useUIStore } from '@/lib/store'

export default function ReportButton({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const openModal = useUIStore((s) => s.openModal)
  return (
    <button
      type="button"
      onClick={() => openModal('fraud', { propertyId, propertyTitle })}
      className="hover:text-rust"
    >
      Report
    </button>
  )
}
