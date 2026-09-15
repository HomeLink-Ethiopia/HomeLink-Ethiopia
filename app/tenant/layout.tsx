import type { Role } from '@/types/roles'
import Sidebar from '@/components/tenant/Sidebar'
import TenantFooter from '@/components/tenant/TenantFooter'

/**
 * Layout for the entire /tenant tree. Kept separate from the public
 * (marketing) shell — a persistent sidebar rather than TopNav/Footer,
 * matching the Tenant.jpg reference. The sidebar is shared across
 * every /tenant page; only the dashboard exists so far (Phase 4).
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
        <TenantFooter />
      </div>
    </div>
  )
}
