import TopBar from '@/components/tenant/TopBar'
import HomeJourneyTracker from '@/components/tenant/HomeJourneyTracker'
import NextPaymentBox from '@/components/tenant/NextPaymentBox'
import CurrentHomeCard from '@/components/tenant/CurrentHomeCard'
import RentPaymentCard from '@/components/tenant/RentPaymentCard'
import QuickActions from '@/components/tenant/QuickActions'
import MaintenanceTrackerCard from '@/components/tenant/MaintenanceTrackerCard'
import PropertyCard from '@/components/discovery/PropertyCard'
import AiRecommendations from '@/components/tenant/AiRecommendations'
import { MOCK_TENANT } from '@/lib/tenant'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export const metadata = {
  title: 'My Home — HomeLink Ethiopia',
}

export default function TenantDashboardPage() {
  const { name, currentHome, nextPayment, lastPayment, maintenanceRequests, recommended } = MOCK_TENANT

  return (
    <>
      <TopBar tenantName={name} />

      <div className="flex-1 px-6 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-semibold text-charcoal sm:text-3xl">
          {greeting()}, {name} 👋
        </h1>
        <p className="mt-1 text-charcoal/60">Welcome back to your home journey.</p>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
          <div className="rounded-lg border border-charcoal/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-charcoal">Your Home Journey</h2>
            <div className="mt-6">
              <HomeJourneyTracker currentStepIndex={4} />
            </div>
          </div>
          <NextPaymentBox amountEtb={nextPayment.amountEtb} dueInDays={nextPayment.dueInDays} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CurrentHomeCard property={currentHome.property} leaseEnds={currentHome.leaseEnds} status={currentHome.status} />
          <RentPaymentCard month={lastPayment.month} amountEtb={lastPayment.amountEtb} paidOn={lastPayment.paidOn} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <QuickActions />
          <MaintenanceTrackerCard requests={maintenanceRequests} />
        </div>

        <div className="mt-8">
          <AiRecommendations />
        </div>
      </div>
    </>
  )
}
