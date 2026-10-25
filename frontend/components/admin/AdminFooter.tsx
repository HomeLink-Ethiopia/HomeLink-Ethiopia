import Link from 'next/link'

export default function AdminFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-charcoal/8 bg-white/70 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row sm:px-8 text-xs text-charcoal/60">
        {/* Left: Branding & Region */}
        <div className="flex items-center gap-3">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-rust text-[10px] font-bold text-white">
            HL
          </span>
          <span className="font-semibold text-charcoal">HomeLink Ethiopia</span>
          <span className="text-charcoal/30">|</span>
          <span className="text-[11px] text-charcoal/50">Admin Operator Console</span>
          <span className="hidden text-charcoal/30 md:inline">·</span>
          <span className="hidden text-[11px] text-charcoal/50 md:inline">Addis Ababa (UTC+3)</span>
        </div>

        {/* Center: System Status */}
        <div className="flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/60 px-3 py-1 text-[11px] font-medium text-emerald-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
          </span>
          <span>Core Ledger & Services Active</span>
        </div>

        {/* Right: Administrative Quick Links */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <Link href="/admin/audit-logs" className="text-charcoal/60 hover:text-rust transition-colors">
            Audit Logs
          </Link>
          <Link href="/admin/fraud-reports" className="text-charcoal/60 hover:text-rust transition-colors">
            Fraud Queue
          </Link>
          <Link href="/admin/disputes" className="text-charcoal/60 hover:text-rust transition-colors">
            Disputes
          </Link>
          <Link href="/support" className="text-charcoal/60 hover:text-rust transition-colors">
            Support Desk
          </Link>
          <span className="text-charcoal/30">·</span>
          <span className="font-mono text-[11px] text-charcoal/40">v2.4.0</span>
        </div>
      </div>
    </footer>
  )
}

