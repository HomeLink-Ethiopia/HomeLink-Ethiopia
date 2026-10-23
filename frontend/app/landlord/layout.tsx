import Sidebar from '@/components/landlord/Sidebar'
import LandlordFooter from '@/components/landlord/LandlordFooter'

/**
 * Layout for the entire /landlord tree.
 * Sidebar is shared across all landlord pages — matches the landlord.jpg reference.
 * Each page only needs to render its TopBar + main content.
 */
export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex-1 pb-16">
          {children}
        </div>
      </main>
    </div>
  )
}
