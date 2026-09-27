'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

/**
 * NotificationBell — reads the user's real notifications from the backend
 * (GET /api/v1/notifications), marks read via PATCH endpoints, and deep-links
 * to the page each notification points at. Polls every 15s while logged in.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ApiNotification {
  _id: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
}

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
  application_withdrawn: { dot: 'bg-charcoal/40', label: 'Application' },
}

const styleFor = (type: string) => {
  if (KIND_STYLE[type]) return KIND_STYLE[type]
  if (type.startsWith('viewing')) return { dot: 'bg-blue-500', label: 'Viewing' }
  if (type.startsWith('application')) return { dot: 'bg-gold', label: 'Application' }
  if (type.startsWith('dispute')) return { dot: 'bg-red-500', label: 'Dispute' }
  if (type.startsWith('maintenance')) return { dot: 'bg-amber-500', label: 'Maintenance' }
  if (type.startsWith('agreement')) return { dot: 'bg-emerald-500', label: 'Agreement' }
  if (type.startsWith('rent') || type.startsWith('payment')) return { dot: 'bg-gold', label: 'Payment' }
  if (type.startsWith('message')) return { dot: 'bg-blue-500', label: 'Message' }
  if (type.startsWith('verification')) return { dot: 'bg-emerald-500', label: 'Verification' }
  if (type.startsWith('fraud')) return { dot: 'bg-red-500', label: 'Fraud' }
  return { dot: 'bg-charcoal/30', label: 'Update' }
}

function timeAgo(iso: string): string {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ApiNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)
  const tokenRef = useRef<string>('')

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('hl_token') || ''
    tokenRef.current = token
    if (!token) {
      setItems([])
      setUnread(0)
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const d = await res.json()
      setItems(Array.isArray(d.data) ? d.data : [])
      setUnread(typeof d.unreadCount === 'number' ? d.unreadCount : 0)
    } catch {
      /* offline — keep last known state */
    }
  }, [])

  const markOneRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
    } catch { /* refetch will reconcile */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
    try {
      await fetch(`${API_URL}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
    } catch { /* refetch will reconcile */ }
  }, [])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(iv)
      window.removeEventListener('focus', refresh)
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
            {unread > 9 ? '9+' : unread}
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
                onClick={markAllRead}
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
                  Updates about viewings, applications and agreements will appear here.
                </p>
              </div>
            ) : (
              items.map((n) => {
                const style = styleFor(n.type)
                const inner = (
                  <div className={`flex gap-2.5 px-4 py-3 hover:bg-cream/60 ${n.read ? '' : 'bg-rust/[0.03]'}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-charcoal">{n.title}</p>
                        <span className="shrink-0 text-[10px] text-charcoal/40">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/60">{n.message}</p>
                      <span className="mt-1 inline-block rounded bg-sand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal/50">
                        {style.label}
                      </span>
                    </div>
                  </div>
                )
                return n.link ? (
                  <Link
                    key={n._id}
                    href={n.link}
                    onClick={() => markOneRead(n._id)}
                    className="block border-b border-charcoal/5 last:border-0"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => markOneRead(n._id)}
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
