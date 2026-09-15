export type MaintenanceStatus = 'Submitted' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed'
export type MaintenancePriority = 'Low' | 'Medium' | 'High'

export interface MaintenanceTicket {
  id: string
  title: string
  category: 'Plumbing' | 'Electrical' | 'Appliance' | 'Structural' | 'Other'
  priority: MaintenancePriority
  status: MaintenanceStatus
  submittedOn: string
  description: string
}

/** Mock data standing in for FR-09 (maintenance tracking) until the real service exists. */
export const TENANT_MAINTENANCE_TICKETS: MaintenanceTicket[] = [
  {
    id: 'MT-3311',
    title: 'Bathroom sink leaking',
    category: 'Plumbing',
    priority: 'Medium',
    status: 'In Progress',
    submittedOn: 'May 10, 2026',
    description: 'Steady drip under the sink, getting worse over the past week.',
  },
  {
    id: 'MT-3298',
    title: 'Fix door lock',
    category: 'Structural',
    priority: 'Low',
    status: 'Resolved',
    submittedOn: 'Apr 25, 2026',
    description: 'Front door lock sticks and takes a few tries to turn.',
  },
  {
    id: 'MT-3270',
    title: 'Kitchen light flickering',
    category: 'Electrical',
    priority: 'Low',
    status: 'Closed',
    submittedOn: 'Mar 15, 2026',
    description: 'Overhead kitchen light flickers when the fridge kicks on.',
  },
]

export const MAINTENANCE_STATUS_BADGE_CLASS: Record<MaintenanceStatus, string> = {
  Submitted: 'bg-sand text-charcoal/70',
  Assigned: 'bg-gold/15 text-gold',
  'In Progress': 'bg-gold/15 text-gold',
  Resolved: 'bg-verified/10 text-verified',
  Closed: 'bg-charcoal/10 text-charcoal/50',
}

export const PRIORITY_BADGE_CLASS: Record<MaintenancePriority, string> = {
  Low: 'bg-sand text-charcoal/60',
  Medium: 'bg-gold/15 text-gold',
  High: 'bg-rust/10 text-rust',
}
