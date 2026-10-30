'use client'

import { hashSeed } from '@/lib/images'

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

const PARTICLES = new Set(['de', 'del', 'la', 'le', 'van', 'von', 'da', 'di'])

function initialsOf(name?: string): string {
  const safe = (typeof name === 'string' ? name : '').trim()
  if (!safe) return '?'
  const words = safe
    .split(/\s+/)
    .filter((w) => w.length > 0 && !PARTICLES.has(w.toLowerCase()))
  if (words.length === 0) return '?'
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : ''
  const raw = (first + last).toUpperCase()
  return /^[A-Z\u1200-\u137F]+$/.test(raw) ? raw : '?'
}

export default function InitialsAvatar({
  name,
  size = 40,
  className = '',
}: {
  name?: string
  size?: number
  className?: string
}) {
  const safeName = typeof name === 'string' ? name : ''
  const hash = hashSeed(safeName || 'seed')
  const colorIndex = hash % PALETTE.length
  const colors = PALETTE[colorIndex] || PALETTE[0]
  const initials = initialsOf(safeName)

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white select-none ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: `${Math.round(size * 0.38)}px`,
      }}
      aria-label={safeName || 'Avatar'}
    >
      {initials}
    </div>
  )
}
