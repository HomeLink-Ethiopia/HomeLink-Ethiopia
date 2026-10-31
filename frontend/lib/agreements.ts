import { personPhoto } from './images'

export interface RentalAgreement {
  id: string
  propertyId: string
  propertyTitle: string
  propertyAddress: string
  tenantName: string
  tenantPhone: string
  tenantEmail: string
  landlordName: string
  landlordPhone: string
  landlordEmail: string
  monthlyRentEtb: number
  depositEtb: number
  leaseStart: string
  leaseEnd: string
  paymentDueDay: number
  status: 'draft' | 'pending_landlord' | 'pending_tenant' | 'active' | 'expired' | 'terminated'
  signedByTenant: boolean
  signedByLandlord: boolean
  terms: string[]
  createdAt: string
}

export const MOCK_AGREEMENTS: RentalAgreement[] = [
  {
    id: 'AGR-2024-001',
    propertyId: 'prop-001',
    propertyTitle: 'Modern 2BR Apartment in Bole',
    propertyAddress: 'Bole Road, Addis Ababa',
    tenantName: 'Tsedi Tesfaye',
    tenantPhone: '+251 911 123456',
    tenantEmail: 'tsedi@example.com',
    landlordName: 'Abebe Tekle',
    landlordPhone: '+251 911 234567',
    landlordEmail: 'abebe@example.com',
    monthlyRentEtb: 22000,
    depositEtb: 44000,
    leaseStart: '2024-02-01',
    leaseEnd: '2025-01-31',
    paymentDueDay: 5,
    status: 'active',
    signedByTenant: true,
    signedByLandlord: true,
    terms: [
      'Monthly rent of ETB 22,000 is due by the 5th of each month.',
      'Security deposit of ETB 44,000 to be returned within 30 days of lease termination, minus any deductions for damages.',
      'Tenant is responsible for utility payments (electricity, water, internet).',
      'Landlord is responsible for structural maintenance and common area upkeep.',
      'Minimum 30-day notice required for early termination by either party.',
      'No subletting without prior written consent from the landlord.',
      'Tenant must maintain the property in good condition and report damages promptly.',
      'Annual rent review may be negotiated at lease renewal, not exceeding 10% increase.',
    ],
    createdAt: '2024-01-25',
  },
  {
    id: 'AGR-2024-002',
    propertyId: 'prop-002',
    propertyTitle: 'Cozy Studio in Kazanchis',
    propertyAddress: 'Kazanchis, Addis Ababa',
    tenantName: 'Tsedi Tesfaye',
    tenantPhone: '+251 911 123456',
    tenantEmail: 'tsedi@example.com',
    landlordName: 'Selam Haile',
    landlordPhone: '+251 911 345678',
    landlordEmail: 'selam@example.com',
    monthlyRentEtb: 15000,
    depositEtb: 30000,
    leaseStart: '2024-06-01',
    leaseEnd: '2025-05-31',
    paymentDueDay: 1,
    status: 'pending_tenant',
    signedByTenant: false,
    signedByLandlord: true,
    terms: [
      'Monthly rent of ETB 15,000 is due by the 1st of each month.',
      'Security deposit of ETB 30,000 to be returned within 30 days of lease termination.',
      'Tenant is responsible for all utility payments.',
      'Landlord covers major structural repairs only.',
      'Minimum 45-day notice required for early termination.',
      'Property inspection will be conducted quarterly.',
    ],
    createdAt: '2024-05-20',
  },
]

export function getAgreementsForTenant(tenantEmail: string): RentalAgreement[] {
  return MOCK_AGREEMENTS.filter((a) => a.tenantEmail === tenantEmail)
}

export function getActiveAgreement(tenantEmail: string): RentalAgreement | undefined {
  return MOCK_AGREEMENTS.find((a) => a.tenantEmail === tenantEmail && a.status === 'active')
}

export function getAgreementById(id: string): RentalAgreement | undefined {
  return MOCK_AGREEMENTS.find((a) => a.id === id)
}
