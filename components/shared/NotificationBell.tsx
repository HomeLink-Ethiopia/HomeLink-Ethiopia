'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
  timeAgo,
  type AppNotification,
} from '@/lib/notifications'

const KIND_STYLE: Record<string, { dot: string; label: string }> = {
  viewing_accepted: { dot: 'bg-emerald-500', label: 'Viewing' },
  viewing_rejected: { dot: 'bg-red-500', label: 'Viewing' },
  viewing_rescheduled: { dot: 'bg-blue-500', label: 'Viewing' },
  viewing_requested: { dot: 'bg-gold', label: 'Viewing' },
  viewing_cancelled: { dot: 'bg-charcoal/40', label: 'Viewing' },
  application_received: { dot: 'bg-gold', label: 'Application' },
  application_accepted: { dot: 'bg-emerald-500', label: 'Application' },
  application_rejected: { dot: 'bg-red-500', label: 'Application' },
  application_under_review: { dot: 'bg-blue-500', label: 'Application' },
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  const refresh = useCallback(() => {
    setItems(listNotifications())
    setUnread(unreadCount())
  }, [])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 4000)
    window.addEventListener('hl-notification', refresh)
    return () => {
      clearInterval(iv)
      window.removeEventListener('hl-notification', refresh)
    }
  }, [refresh])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref && !ref.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [ref])

  return (
    <div ref={setRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          if (!open) refresh()
        }}
        className="relative flex items-center gap-1.5 text-sm text-charcoal/70 hover:text-rust"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
          <path d="M10 6v4l2 2M15 10a5 5 0 11-10 0 5 5 0 0110 0z" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Notifications</span>
        {unread > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-2.5">
            <p className="text-sm font-semibold text-charcoal">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => { markAllRead(); refresh() }}
                className="text-xs font-medium text-rust hover:text-rust-dark"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-charcoal/50">No notifications yet</p>
                <p className="mt-1 text-xs text-charcoal/40">
                  Updates about viewings and applications will appear here.
                </p>
              </div>
            ) : (
              items.map((n) => {
                const style = KIND_STYLE[n.kind] || { dot: 'bg-charcoal/30', label: 'Update' }
                const inner = (
                  <div className={`flex gap-2.5 px-4 py-3 hover:bg-cream/60 ${n.read ? '' : 'bg-rust/[0.03]'}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-charcoal">{n.title}</p>
                        <span className="shrink-0 text-[10px] text-charcoal/40">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/60">{n.body}</p>
                      <span className="mt-1 inline-block rounded bg-sand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal/50">
                        {style.label}
                      </span>
                    </div>
                  </div>
                )
                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => { markRead(n.id); refresh() }}
                    className="block border-b border-charcoal/5 last:border-0"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { markRead(n.id); refresh() }}
                    className="block w-full border-b border-charcoal/5 text-left last:border-0"
                  >
                    {inner}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
