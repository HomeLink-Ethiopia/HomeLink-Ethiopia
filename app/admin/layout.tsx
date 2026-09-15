import Sidebar from '@/components/admin/Sidebar'
import AdminFooter from '@/components/admin/AdminFooter'

/**
 * Layout for the entire /admin tree.
 * Sidebar is shared across all admin pages.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
        <AdminFooter />
      </div>
    </div>
  )
}
