import VerificationWorkbench from '@/components/admin/verification/VerificationWorkbench'

/**
 * Sprint 3 — Landlord identity verification.
 * Focused view: review identity documents and approve/reject landlords.
 * The combined queue (landlords + properties) lives at /admin/verification-queue.
 */
export default function LandlordVerificationPage() {
  return <VerificationWorkbench scope="landlords" title="Landlord Verification" />
}
