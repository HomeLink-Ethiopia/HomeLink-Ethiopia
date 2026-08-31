import TopBar from '@/components/admin/TopBar'
import KpiCard from '@/components/admin/KpiCard'
import VerificationQueue from '@/components/admin/VerificationQueue'
import VerificationProgress from '@/components/admin/VerificationProgress'
import FraudReportsByType from '@/components/admin/FraudReportsByType'
import RiskLevelDistribution from '@/components/admin/RiskLevelDistribution'
import { VERIFICATION_KPIS } from '@/lib/admin'

const KPI_ICONS = ['queue', 'fraud', 'scale', 'verified'] as const

export const metadata = {
  title: 'Admin Dashboard — HomeLink Ethiopia',
}

export default function AdminDashboardPage() {
  return (
    <>
      <TopBar title="Trust & Verification Center" />
      <main className="space-y-6 px-6 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VERIFICATION_KPIS.map((stat, i) => (
            <KpiCard key={stat.label} stat={stat} icon={KPI_ICONS[i]} index={i} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VerificationQueue />
          <VerificationProgress />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FraudReportsByType />
          <RiskLevelDistribution />
        </div>
      </main>
    </>
  )
}
