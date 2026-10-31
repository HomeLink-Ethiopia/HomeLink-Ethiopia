import type { Role } from '@/types/roles'
import Sidebar from '@/components/tenant/Sidebar'

/**
 * Layout for the entire /tenant tree.
 * Persistent left rail with clean, full-height scrollable workspace.
 */
const ROLE: Role = 'tenant'

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream" data-role={ROLE}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
