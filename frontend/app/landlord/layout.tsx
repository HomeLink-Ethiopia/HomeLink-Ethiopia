import Sidebar from '@/components/landlord/Sidebar'

/**
 * Layout for the entire /landlord tree.
 * Persistent left rail with clean, full-height scrollable workspace.
 */
export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
