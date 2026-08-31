'use client'

import Link from 'next/link'
import TopBar from '@/components/landlord/TopBar'
import { useLanguage } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'

// Mock properties data - in production would filter by landlordId
const MOCK_PROPERTIES = [
  {
    id: '1',
    title: 'Modern 2BR Apartment',
    neighborhood: 'Bole',
    rentEtb: 18000,
    beds: 2,
    baths: 1,
    status: 'active' as const,
    tenantStatus: 'occupied' as const,
  },
  {
    id: '2',
    title: 'Spacious 3BR House',
    neighborhood: 'CMC',
    rentEtb: 25000,
    beds: 3,
    baths: 2,
    status: 'active' as const,
    tenantStatus: 'vacant' as const,
  },
  {
    id: '3',
    title: 'Cozy Studio',
    neighborhood: 'Kazanchis',
    rentEtb: 12000,
    beds: 1,
    baths: 1,
    status: 'inactive' as const,
    tenantStatus: 'vacant' as const,
  },
]

export default function PropertiesPage() {
  const { t } = useLanguage()
  const { user } = useAuth()

  const handleStatusChange = (propertyId: string, newStatus: 'active' | 'inactive') => {
    // In production, update property status in backend
    console.log(`Changing property ${propertyId} status to ${newStatus}`)
  }

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.properties.title}
        subtitle={t.dashboard.landlord.properties.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-charcoal">
            {t.dashboard.landlord.properties.myProperties}
          </h2>
          <Link
            href="/landlord/properties/new"
            className="bg-rust text-white px-4 py-2 rounded-lg hover:bg-rust-dark transition-colors"
          >
            {t.dashboard.landlord.properties.addNew}
          </Link>
        </div>

        {MOCK_PROPERTIES.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-charcoal/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-charcoal">
              {t.dashboard.landlord.properties.noProperties}
            </h3>
            <Link
              href="/landlord/properties/new"
              className="inline-block mt-4 text-rust hover:text-rust-dark"
            >
              {t.dashboard.landlord.properties.addNew}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {MOCK_PROPERTIES.map((property) => (
              <div
                key={property.id}
                className="bg-white rounded-lg border border-sand p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-charcoal">
                        {property.title}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          property.status === 'active'
                            ? 'bg-verified text-white'
                            : 'bg-sand text-charcoal'
                        }`}
                      >
                        {property.status === 'active'
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          property.tenantStatus === 'occupied'
                            ? 'bg-gold text-charcoal'
                            : 'bg-cream text-charcoal'
                        }`}
                      >
                        {property.tenantStatus === 'occupied'
                          ? 'Occupied'
                          : 'Vacant'}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal/60 mt-1">
                      {property.neighborhood} • {property.beds} bed • {property.baths} bath
                    </p>
                    <p className="text-lg font-bold text-charcoal mt-2">
                      ETB {property.rentEtb.toLocaleString()}/month
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/landlord/properties/${property.id}/edit`}
                      className="px-3 py-1 border border-sand rounded hover:bg-sand transition-colors text-sm"
                    >
                      {t.common.edit}
                    </Link>
                    <button
                      onClick={() =>
                        handleStatusChange(
                          property.id,
                          property.status === 'active' ? 'inactive' : 'active'
                        )
                      }
                      className="px-3 py-1 border border-sand rounded hover:bg-sand transition-colors text-sm"
                    >
                      {property.status === 'active'
                        ? t.dashboard.landlord.properties.deactivate
                        : t.dashboard.landlord.properties.activate}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
