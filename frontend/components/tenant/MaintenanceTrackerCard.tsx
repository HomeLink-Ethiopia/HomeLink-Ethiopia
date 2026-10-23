import type { MaintenanceTrackerItem } from '@/lib/tenant'

const STATUS_STYLE: Record<MaintenanceTrackerItem['status'], string> = {
  Submitted: 'bg-amber-50 text-amber-700 border border-amber-200',
  Assigned: 'bg-amber-50 text-amber-700 border border-amber-200',
  'In Progress': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  Resolved: 'bg-green-50 text-green-700 border border-green-200',
  Closed: 'bg-charcoal/5 text-charcoal/60 border border-charcoal/10',
}

const ICON_FOR_REQUEST: Record<string, JSX.Element> = {
  'Leaking faucet': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  'Broken door lock': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  'AC not working': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 2v10M8 6L6 8M16 6l2 2M6 16l2-2M18 16l-2-2M12 22v-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

export default function MaintenanceTrackerCard({ requests }: { requests: MaintenanceTrackerItem[] }) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-charcoal">Maintenance Requests</h3>
        <button type="button" className="text-sm font-medium text-rust hover:text-rust-dark">
          View all
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {requests.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-lg border border-charcoal/10 p-3 hover:border-charcoal/20 transition-colors">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rust/10 text-rust">
              {ICON_FOR_REQUEST[r.title] || DEFAULT_ICON}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-charcoal">{r.title}</p>
              <p className="mt-0.5 text-xs text-charcoal/50">
                {r.status === 'Resolved' ? 'Completed on' : 'Requested on'} {r.date}
              </p>
              <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>
                {r.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
