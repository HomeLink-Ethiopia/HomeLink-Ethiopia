'use client'

import { hashSeed } from '@/lib/images'

/**
 * Donut/initials avatar — replaces random stock portrait photos with a
 * deterministic, privacy-friendly identity chip: the person's initials on a
 * stable color picked by hashing their name (same name → same color always).
 *
 * Rendered as a flat colored disc with white initials and a subtle ring
 * ("donut") so it slots into any existing avatar slot without layout shifts.
 */

const PALETTE = [
  { bg: '#C05621', text: '#FFFFFF' }, // rust
  { bg: '#2F855A', text: '#FFFFFF' }, // green
  { bg: '#2B6CB0', text: '#FFFFFF' }, // blue
  { bg: '#6B46C1', text: '#FFFFFF' }, // violet
  { bg: '#B83280', text: '#FFFFFF' }, // magenta
  { bg: '#975A16', text: '#FFFFFF' }, // amber-brown
  { bg: '#1A365D', text: '#FFFFFF' }, // navy
  { bg: '#2C7A7B', text: '#FFFFFF' }, // teal
] as const

/** Ethiopian (transliterated) name words that should never become an initial alone. */
const PARTICLES = new Set(['de', 'del', 'la', 'le', 'van', 'von', 'da', 'di'])

function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !PARTICLES.has(w.toLowerCase()))
  if (words.length === 0) return '?'
  const first = words[0][0] ?? ''
  // Many Ethiopian names are "Given Name Father's Name" — first letters of
  // the first two words are the natural initials (e.g. "Tsedi Kebede" → TK).
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : ''
  const raw = (first + last).toUpperCase()
  return /^[A-Z\u1200-\u137F]+$/.test(raw) ? raw : '?'
}

export default function InitialsAvatar({
  name,
  size = 40,
  className = '',
}: {
  name: string
  /** Diameter in px. */
  size?: number
  className?: string
}) {
  const palette = PALETTE[hashSeed(name) % PALETTE.length]
  const initials = initialsOf(name)

  return (
    <span
      role="img"
      aria-label={`${name} avatar`}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase ring-2 ring-white/70 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: palette.bg,
        color: palette.text,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        letterSpacing: '0.02em',
      }}
    >
      {initials}
    </span>
  )
}
