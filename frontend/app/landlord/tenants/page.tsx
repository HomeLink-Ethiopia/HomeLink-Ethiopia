'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { useLanguage } from '@/lib/language-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Tenant {
  _id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  status?: 'current' | 'past' | string
  moveInDate?: string
  moveOutDate?: string
  rent?: number
  propertyId?: { title?: string } | string
}

export default function TenantsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const { t } = useLanguage()

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/agreements/landlord/tenants`, {
        headers: token ? { Authorization: `Bearer ${token}` } : { Authorization: '' },
      })
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        const raw = data.data || data.tenants || []
        // Backend returns one tenant per agreement-group with properties[];
        // flatten into one row per (tenant, property) so filtering works.
        const rows: Tenant[] = []
        for (const tn of raw) {
          const props = Array.isArray(tn.properties) ? tn.properties : []
          if (props.length === 0) {
            rows.push({ ...tn, status: 'current' })
            continue
          }
          for (const pr of props) {
            const active = pr.agreementStatus === 'active'
            rows.push({
              ...tn,
              _id: `${tn._id}_${pr._id}`,
              status: active ? 'current' : 'past',
              rent: pr.rentAmount,
              propertyId: { title: pr.title },
              moveInDate: pr.startDate,
            })
          }
        }
        setTenants(rows)
      } else if (res.status === 401) {
        setError('Please log in as a landlord to see your tenants.')
      } else {
        setError(`Could not load tenants (${res.status}).`)
      }
    } catch {
      setError('Cannot reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  const fullName = (tt: Tenant) => `${tt.firstName || ''} ${tt.lastName || ''}`.trim() || 'Tenant'
  const propertyTitle = (tt: Tenant) => (typeof tt.propertyId === 'object' ? tt.propertyId?.title : 'Property')

  const currentTenants = tenants.filter((tt) => tt.status === 'current')
  const pastTenants = tenants.filter((tt) => tt.status === 'past')

  return (
    <>
      <TopBar
        title={t.dashboard.landlord.tenants.title}
        subtitle={t.dashboard.landlord.tenants.subtitle}
      />
      <main className="flex-1 space-y-8 px-6 py-8 sm:px-8">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={3} cols={5} />
        ) : tenants.length === 0 ? (
          <EmptyState
            icon="user"
            title="No tenants yet"
            description="When tenants sign agreements for your properties, they will appear here."
          />
        ) : (
          <>
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
                    <div key={tenant._id} className="bg-white rounded-lg border border-sand p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-charcoal">{fullName(tenant)}</h3>
                          <p className="text-sm text-charcoal/60 mt-1">{propertyTitle(tenant)}</p>
                          <p className="text-sm text-charcoal/60">
                            {tenant.email} {tenant.phone ? `• ${tenant.phone}` : ''}
                          </p>
                          {tenant.moveInDate && (
                            <p className="text-sm text-charcoal/60 mt-2">
                              Move-in: {new Date(tenant.moveInDate).toLocaleDateString()}
                            </p>
                          )}
                          {tenant.rent ? (
                            <p className="text-lg font-bold text-charcoal mt-2">
                              ETB {tenant.rent.toLocaleString()}/month
                            </p>
                          ) : null}
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
            {pastTenants.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-charcoal mb-4">
                  {t.dashboard.landlord.tenants.pastTenants}
                </h2>
                <div className="grid gap-4">
                  {pastTenants.map((tenant) => (
                    <div key={tenant._id} className="bg-white rounded-lg border border-sand p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-charcoal">{fullName(tenant)}</h3>
                          <p className="text-sm text-charcoal/60 mt-1">{propertyTitle(tenant)}</p>
                          <p className="text-sm text-charcoal/60">
                            {tenant.email} {tenant.phone ? `• ${tenant.phone}` : ''}
                          </p>
                          {tenant.moveInDate && (
                            <p className="text-sm text-charcoal/60 mt-2">
                              {new Date(tenant.moveInDate).toLocaleDateString()}
                              {tenant.moveOutDate ? ` - ${new Date(tenant.moveOutDate).toLocaleDateString()}` : ''}
                            </p>
                          )}
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-sand text-charcoal">
                          Past
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
