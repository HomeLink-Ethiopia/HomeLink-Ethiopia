import { personPhoto } from './images'

export interface AuditLog {
  id: string
  adminName: string
  adminAvatar: string
  action: string
  target: string
  targetType: 'landlord' | 'property' | 'tenant' | 'dispute' | 'fraud_report' | 'system'
  details: string
  timestamp: string
  ip: string
}

export const AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AL-001',
    adminName: 'Selam Haile',
    adminAvatar: personPhoto('admin-selam'),
    action: 'Approved landlord verification',
    target: 'Abebe Tekle',
    targetType: 'landlord',
    details: 'Verified identity document and property ownership proof for Bole Road properties.',
    timestamp: '2024-01-20T14:30:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-002',
    adminName: 'Selam Haile',
    adminAvatar: personPhoto('admin-selam'),
    action: 'Rejected property listing',
    target: 'Luxury Villa in CMC',
    targetType: 'property',
    details: 'Duplicate listing detected — same photos as prop-034. Requested additional documentation.',
    timestamp: '2024-01-20T11:15:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-003',
    adminName: 'Kidist Alemayehu',
    adminAvatar: personPhoto('admin-kidist'),
    action: 'Closed fraud report',
    target: 'FR-012 — Fake Listing',
    targetType: 'fraud_report',
    details: 'Investigation completed. Listing removed, landlord account suspended pending appeal.',
    timestamp: '2024-01-19T16:45:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-004',
    adminName: 'Selam Haile',
    adminAvatar: personPhoto('admin-selam'),
    action: 'Resolved dispute',
    target: 'DSP-005 — Deposit Dispute',
    targetType: 'dispute',
    details: 'Mediated between tenant Tsedi and landlord Samuel. Partial deposit refund of ETB 15,000 agreed.',
    timestamp: '2024-01-19T10:20:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-005',
    adminName: 'Kidist Alemayehu',
    adminAvatar: personPhoto('admin-kidist'),
    action: 'Suspended landlord account',
    target: 'Fatuma Hassan',
    targetType: 'landlord',
    details: 'Multiple fraud reports (3x fake listings). Account suspended pending full investigation.',
    timestamp: '2024-01-18T09:00:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-006',
    adminName: 'Selam Haile',
    adminAvatar: personPhoto('admin-selam'),
    action: 'Approved property listing',
    target: 'Modern Studio in Kazanchis',
    targetType: 'property',
    details: 'All documents verified. Property added to active listings.',
    timestamp: '2024-01-18T08:30:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-007',
    adminName: 'Kidist Alemayehu',
    adminAvatar: personPhoto('admin-kidist'),
    action: 'Updated system configuration',
    target: 'Fraud detection thresholds',
    targetType: 'system',
    details: 'Raised duplicate-image similarity threshold from 85% to 90% to reduce false positives.',
    timestamp: '2024-01-17T15:00:00',
    ip: '197.158.x.x',
  },
  {
    id: 'AL-008',
    adminName: 'Selam Haile',
    adminAvatar: personPhoto('admin-selam'),
    action: 'Approved landlord verification',
    target: 'Dawit Tesfaye',
    targetType: 'landlord',
    details: 'Identity and ownership documents reviewed and approved.',
    timestamp: '2024-01-17T11:20:00',
    ip: '197.158.x.x',
  },
]

const TARGET_TYPE_BADGE: Record<string, string> = {
  landlord: 'bg-blue-50 text-blue-700',
  property: 'bg-purple-50 text-purple-700',
  tenant: 'bg-green-50 text-green-700',
  dispute: 'bg-amber-50 text-amber-700',
  fraud_report: 'bg-red-50 text-red-700',
  system: 'bg-charcoal/5 text-charcoal/60',
}

export function getTargetTypeBadge(type: string): string {
  return TARGET_TYPE_BADGE[type] || TARGET_TYPE_BADGE.system
}
