import { personPhoto } from './images'

export type DisputeStatus = 'Open' | 'In Mediation' | 'Resolved'

export interface DisputeMessage {
  from: string
  text: string
  time: string
}

export interface Dispute {
  id: string
  title: string
  tenantName: string
  tenantAvatar: string
  landlordName: string
  landlordAvatar: string
  status: DisputeStatus
  filedOn: string
  evidence: string[]
  thread: DisputeMessage[]
}

/** Mock data standing in for FR-12 (dispute case management) until the real service exists. */
export const DISPUTES: Dispute[] = [
  {
    id: 'DSP-4401',
    title: 'Security deposit not returned',
    tenantName: 'Ruth M.',
    tenantAvatar: personPhoto('tenant-ruth-m'),
    landlordName: 'Abebe Kebede',
    landlordAvatar: personPhoto('landlord-abebe-kebede'),
    status: 'Open',
    filedOn: 'May 9, 2026',
    evidence: ['move-out-checklist.pdf', 'deposit-receipt.pdf'],
    thread: [
      { from: 'Ruth M.', text: 'It has been three weeks since I moved out and I have not received my deposit.', time: 'May 9, 2026' },
    ],
  },
  {
    id: 'DSP-4388',
    title: 'Disagreement over repair costs',
    tenantName: 'Yohannes G.',
    tenantAvatar: personPhoto('tenant-yohannes-g'),
    landlordName: 'Abebe Kebede',
    landlordAvatar: personPhoto('landlord-abebe-kebede'),
    status: 'In Mediation',
    filedOn: 'May 3, 2026',
    evidence: ['plumbing-invoice.pdf', 'chat-log.png'],
    thread: [
      { from: 'Yohannes G.', text: 'I was charged for a repair I believe was normal wear and tear.', time: 'May 3, 2026' },
      { from: 'Admin', text: 'Reviewing the invoice and lease terms now.', time: 'May 5, 2026' },
    ],
  },
  {
    id: 'DSP-4360',
    title: 'Early lease termination fee',
    tenantName: 'Bethlehem A.',
    tenantAvatar: personPhoto('tenant-bethlehem-a'),
    landlordName: 'Abebe Kebede',
    landlordAvatar: personPhoto('landlord-abebe-kebede'),
    status: 'Resolved',
    filedOn: 'Apr 18, 2026',
    evidence: ['lease-agreement.pdf'],
    thread: [
      { from: 'Bethlehem A.', text: 'The fee charged does not match what is in my lease.', time: 'Apr 18, 2026' },
      { from: 'Admin', text: 'Confirmed the lease caps the fee at one month\u2019s rent — landlord has issued a refund of the difference.', time: 'Apr 24, 2026' },
    ],
  },
]

export const DISPUTE_STATUS_BADGE_CLASS: Record<DisputeStatus, string> = {
  Open: 'bg-rust/10 text-rust',
  'In Mediation': 'bg-gold/15 text-gold',
  Resolved: 'bg-verified/10 text-verified',
}
