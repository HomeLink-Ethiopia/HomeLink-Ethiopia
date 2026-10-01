'use client'

import { useAuth } from '@/lib/auth-context'

/**
 * Shows the real logged-in user (initials avatar + name) in dashboard TopBars.
 * Replaces the old hardcoded placeholder names/photos so every user sees
 * their own identity after signing in.
 */
export default function UserChip() {
  const { user } = useAuth()
  const name = user?.name?.trim() || 'User'
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'U'

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust/10 text-xs font-semibold text-rust"
        aria-hidden="true"
      >
        {initials}
      </span>
      <span className="hidden max-w-[140px] truncate text-sm font-medium text-charcoal sm:inline">
        {name}
      </span>
    </div>
  )
}
