'use client'

import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'

const MOCK_TENANTS = [
  {
    id: '1',
    name: 'Tsedi Tesfaye',
    email: 'tsedi@example.com',
    phone: '+251 911 123456',
    propertyTitle: 'Modern 2BR Apartment',
    moveInDate: '2023-06-01',
    rentEtb: 18000,
    status: 'current' as const,
  },
  {
    id: '2',
    name: 'Meron Alemu',
    email: 'meron@example.com',
    phone: '+251 911 234567',
    propertyTitle: 'Spacious 3BR House',
    moveInDate: '2022-01-15',
    moveOutDate: '2023-12-31',
    rentEtb: 25000,
    status: 'past' as const,
  },
]

export default function TenantsPage() {
  const { t } = useLanguage()

  const currentTenants = MOCK_TENANTS.filter((t) => t.status === 'current')
  const pastTenants = MOCK_TENANTS.filter((t) => t.status === 'past')

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.tenants.title}
        subtitle={t.dashboard.landlord.tenants.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        {/* Current Tenants */}
        <div>
          <h2 className="text-xl font-semibold text-charcoal mb-4">
            {t.dashboard.landlord.tenants.currentTenants}
          </h2>
          {currentTenants.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-sand">
              <p className="text-charcoal/60">{t.dashboard.landlord.tenants.noTenants}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {currentTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="bg-white rounded-lg border border-sand p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-charcoal">
                        {tenant.name}
                      </h3>
                      <p className="text-sm text-charcoal/60 mt-1">
                        {tenant.propertyTitle}
                      </p>
                      <p className="text-sm text-charcoal/60">
                        {tenant.email} • {tenant.phone}
                      </p>
                      <p className="text-sm text-charcoal/60 mt-2">
                        Move-in: {new Date(tenant.moveInDate).toLocaleDateString()}
                      </p>
                      <p className="text-lg font-bold text-charcoal mt-2">
                        ETB {tenant.rentEtb.toLocaleString()}/month
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-verified text-white">
                      Current
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Tenants */}
        <div>
          <h2 className="text-xl font-semibold text-charcoal mb-4">
            {t.dashboard.landlord.tenants.pastTenants}
          </h2>
          {pastTenants.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-sand">
              <p className="text-charcoal/60">{t.dashboard.landlord.tenants.noTenants}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pastTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="bg-white rounded-lg border border-sand p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-charcoal">
                        {tenant.name}
                      </h3>
                      <p className="text-sm text-charcoal/60 mt-1">
                        {tenant.propertyTitle}
                      </p>
                      <p className="text-sm text-charcoal/60">
                        {tenant.email} • {tenant.phone}
                      </p>
                      <p className="text-sm text-charcoal/60 mt-2">
                        {new Date(tenant.moveInDate).toLocaleDateString()} -{' '}
                        {tenant.moveOutDate &&
                          new Date(tenant.moveOutDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-sand text-charcoal">
                      Past
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
