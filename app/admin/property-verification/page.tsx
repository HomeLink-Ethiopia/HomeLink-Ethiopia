import VerificationWorkbench from '@/components/admin/verification/VerificationWorkbench'

/**
 * Sprint 3 — Property verification.
 * Focused view: review property ownership documents and listings before they
 * go live. The combined queue lives at /admin/verification-queue.
 */
export default function PropertyVerificationPage() {
  return <VerificationWorkbench scope="properties" title="Property Verification" />
}
