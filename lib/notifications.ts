'use client'

/**
 * In-app notifications for Sprint 7 (viewings & applications events).
 *
 * Stored per-user in localStorage under `hl_notifications_<userId|anon>`.
 * Every dashboard TopBar bell reads the same feed, so an action taken by
 * the landlord (e.g. accepting a viewing) surfaces for them, and tenant
 * events land in the tenant's feed. When the backend notification
 * endpoint exists, swap the two functions below for API calls — the UI
 * contract (shape + unread count) stays the same.
 */

export type NotificationKind =
  | 'viewing_accepted'
  | 'viewing_rejected'
  | 'viewing_rescheduled'
  | 'viewing_requested'
  | 'viewing_cancelled'
  | 'application_received'
  | 'application_accepted'
  | 'application_rejected'
  | 'application_under_review'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** Optional deep link, e.g. /landlord/applications */
  href?: string
  createdAt: string
  read: boolean
}

const KEY_PREFIX = 'hl_notifications_'

function storageKey(): string {
  if (typeof window === 'undefined') return KEY_PREFIX + 'anon'
  let userId = 'anon'
  try {
    const raw = localStorage.getItem('hl_user')
    if (raw) {
      const u = JSON.parse(raw)
      userId = u?._id || u?.id || u?.email || 'anon'
    }
  } catch { /* ignore */ }
  return KEY_PREFIX + userId
}

export function listNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw) return JSON.parse(raw) as AppNotification[]
  } catch { /* ignore */ }
  return []
}

function persist(items: AppNotification[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(), JSON.stringify(items.slice(0, 50)))
  } catch { /* ignore */ }
}

/** Record a new notification at the top of the feed. */
export function notify(kind: NotificationKind, title: string, body: string, href?: string): AppNotification {
  const item: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title,
    body,
    href,
    createdAt: new Date().toISOString(),
    read: false,
  }
  persist([item, ...listNotifications()])
  // Same-tab listeners (TopBar polls anyway; this helps instant refresh)
  window.dispatchEvent(new Event('hl-notification'))
  return item
}

export function unreadCount(): number {
  return listNotifications().filter((n) => !n.read).length
}

export function markAllRead(): void {
  persist(listNotifications().map((n) => ({ ...n, read: true })))
  window.dispatchEvent(new Event('hl-notification'))
}

export function markRead(id: string): void {
  persist(listNotifications().map((n) => (n.id === id ? { ...n, read: true } : n)))
  window.dispatchEvent(new Event('hl-notification'))
}

export function clearNotifications(): void {
  persist([])
  window.dispatchEvent(new Event('hl-notification'))
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
