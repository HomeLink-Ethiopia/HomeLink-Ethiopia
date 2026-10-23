/**
 * Saved Searches storage — real filter presets persisted in localStorage
 * that deep-link into the live /explore search.
 */

const KEY = 'homelink-saved-searches'

export interface SavedSearch {
  id: string
  name: string
  params: string // URLSearchParams string applied to /explore
  createdAt: string
}

export function readSavedSearches(): SavedSearch[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveSearch(name: string, params: string): SavedSearch {
  const list = readSavedSearches()
  const entry: SavedSearch = {
    id: `${Date.now()}`,
    name,
    params,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, 30)))
  return entry
}

export function removeSavedSearch(id: string) {
  const list = readSavedSearches().filter((s) => s.id !== id)
  localStorage.setItem(KEY, JSON.stringify(list))
}
