export interface MaintenanceTrackerItem {
  id: string
  title: string
  status: 'Submitted' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed'
  date: string
}
