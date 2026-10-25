import { personPhoto } from './images'
import { LANDLORD_PROPERTIES } from './landlord'

export type KanbanStage = 'New' | 'Reviewing' | 'Info Requested' | 'Approved' | 'Rejected'

export interface LandlordApplication {
  id: string
  applicantName: string
  avatar: string
  propertyTitle: string
  submittedOn: string
  stage: KanbanStage
}

/** Mock data standing in for FR-06 (application review) until the real service exists. */
export const LANDLORD_APPLICATIONS: LandlordApplication[] = [
  { id: 'APP-3401', applicantName: 'Hana Girma', avatar: personPhoto('applicant-hana-girma'), propertyTitle: LANDLORD_PROPERTIES[2].title, submittedOn: 'May 8, 2026', stage: 'New' },
  { id: 'APP-3398', applicantName: 'Dawit Bekele', avatar: personPhoto('applicant-dawit-bekele'), propertyTitle: LANDLORD_PROPERTIES[4].title, submittedOn: 'May 6, 2026', stage: 'New' },
  { id: 'APP-3390', applicantName: 'Mekdes Alemu', avatar: personPhoto('applicant-mekdes-alemu'), propertyTitle: LANDLORD_PROPERTIES[2].title, submittedOn: 'May 4, 2026', stage: 'Reviewing' },
  { id: 'APP-3382', applicantName: 'Yonas Tesfaye', avatar: personPhoto('applicant-yonas-tesfaye'), propertyTitle: LANDLORD_PROPERTIES[7].title, submittedOn: 'May 1, 2026', stage: 'Info Requested' },
  { id: 'APP-3375', applicantName: 'Selam Worku', avatar: personPhoto('applicant-selam-worku'), propertyTitle: LANDLORD_PROPERTIES[4].title, submittedOn: 'Apr 27, 2026', stage: 'Approved' },
  { id: 'APP-3360', applicantName: 'Kaleb Mulu', avatar: personPhoto('applicant-kaleb-mulu'), propertyTitle: LANDLORD_PROPERTIES[7].title, submittedOn: 'Apr 20, 2026', stage: 'Rejected' },
]

export const KANBAN_STAGES: KanbanStage[] = ['New', 'Reviewing', 'Info Requested', 'Approved', 'Rejected']

export const STAGE_HEADER_CLASS: Record<KanbanStage, string> = {
  New: 'text-charcoal',
  Reviewing: 'text-gold',
  'Info Requested': 'text-rust-dark',
  Approved: 'text-verified',
  Rejected: 'text-charcoal/40',
}
