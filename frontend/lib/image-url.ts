import { API_URL } from './api-url'

/**
 * Resolve an image URL from the backend to an absolute URL.
 *
 * Backend image fields may contain either relative paths ("/uploads/x.jpg",
 * served by the API host) or fully-qualified URLs (e.g. seeded Unsplash
 * images). Prefixing the API base onto an absolute URL produces garbage like
 * "http://localhost:5000https://images.unsplash.com/..." — so only prefix
 * when the value is actually relative.
 */
export function resolveImageUrl(url?: any, fallback = '/images/placeholder.svg'): string {
  if (!url) return fallback
  const raw = typeof url === 'string' ? url : (typeof url?.url === 'string' ? url.url : (typeof url?.key === 'string' ? url.key : ''))
  if (!raw || typeof raw !== 'string') return fallback
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  return `${API_URL}${raw.startsWith('/') ? '' : '/'}${raw}`
}

