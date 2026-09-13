import TopNav from '@/components/TopNav'
import Footer from '@/components/Footer'
import PageTransition from '@/components/PageTransition'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </div>
  )
}
