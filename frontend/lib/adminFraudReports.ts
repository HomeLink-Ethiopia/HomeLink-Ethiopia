import { personPhoto, stockPhoto } from './images'

export type FraudReportStatus = 'Open' | 'Investigating' | 'Closed'
export type FraudReportType = 'Fake Listing' | 'Payment Scam' | 'Duplicate Listing' | 'Identity Fraud' | 'Other'

export interface FraudReport {
  id: string
  type: FraudReportType
  subjectTitle: string
  subjectAvatar: string
  reportedBy: string
  status: FraudReportStatus
  filedOn: string
  details: string
  notes: string[]
}

/** Mock data standing in for FR-11 (fraud triage) until the real service exists. */
export const FRAUD_REPORTS: FraudReport[] = [
  {
    id: 'FR-8801',
    type: 'Fake Listing',
    subjectTitle: '2 Bedroom Apartment — Bole',
    subjectAvatar: stockPhoto('fraud-8801', 100, 100),
    reportedBy: 'Hana Girma',
    status: 'Open',
    filedOn: 'May 11, 2026',
    details: 'Photos appear to be reused from a listing on another platform; landlord unreachable.',
    notes: [],
  },
  {
    id: 'FR-8794',
    type: 'Payment Scam',
    subjectTitle: 'Wubeshet Alemu (Landlord)',
    subjectAvatar: personPhoto('landlord-wubeshet-alemu'),
    reportedBy: 'Dawit Bekele',
    status: 'Investigating',
    filedOn: 'May 8, 2026',
    details: 'Tenant asked to wire a deposit to a personal account before viewing the unit.',
    notes: ['Reached out to reported landlord for comment — awaiting response.'],
  },
  {
    id: 'FR-8770',
    type: 'Duplicate Listing',
    subjectTitle: 'Studio Apartment — Kazanchis',
    subjectAvatar: stockPhoto('fraud-8770', 100, 100),
    reportedBy: 'System — duplicate detection',
    status: 'Closed',
    filedOn: 'Apr 29, 2026',
    details: 'Same unit listed twice under different landlord accounts.',
    notes: ['Confirmed duplicate; older listing removed.', 'Case closed, no further action needed.'],
  },
]

export const FRAUD_STATUS_BADGE_CLASS: Record<FraudReportStatus, string> = {
  Open: 'bg-rust/10 text-rust',
  Investigating: 'bg-gold/15 text-gold',
  Closed: 'bg-charcoal/10 text-charcoal/50',
}
