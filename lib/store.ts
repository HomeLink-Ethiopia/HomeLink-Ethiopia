import { create } from 'zustand'

/**
 * Identifies which workflow modal (if any) is currently open, plus the
 * minimal context each one needs. Only one modal is open at a time —
 * that's a deliberate simplification, not a limitation of the store;
 * stacking workflow modals would confuse the "what am I submitting"
 * mental model this platform depends on for trust.
 */
export type ModalKind = 'application' | 'viewing' | 'maintenance' | 'fraud' | null

export interface ModalContext {
  propertyId?: string
  propertyTitle?: string
}

interface UIState {
  activeModal: ModalKind
  modalContext: ModalContext
  openModal: (modal: Exclude<ModalKind, null>, context?: ModalContext) => void
  closeModal: () => void

  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  modalContext: {},
  openModal: (modal, context = {}) => set({ activeModal: modal, modalContext: context }),
  closeModal: () => set({ activeModal: null, modalContext: {} }),

  // Drives the mobile drawer state for the tenant/landlord/admin
  // sidebars (components/*/Sidebar.tsx). Starts closed since it only
  // matters below the `lg` breakpoint — above `lg` the sidebar is
  // always visible via CSS regardless of this flag.
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

// ---------------------------------------------------------------------------
// Favorites / Saved Properties
// ---------------------------------------------------------------------------

const FAVORITES_KEY = 'hl_favorites'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

function persistFavorites(favs: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]))
  } catch { /* ignore */ }
}

/** Best-effort sync with the backend so favouriteCount stays accurate. */
function syncFavoriteWithBackend(propertyId: string, saved: boolean) {
  if (typeof window === 'undefined') return
  const token = localStorage.getItem('hl_token')
  if (!token) return
  fetch(`${API_URL}/api/v1/favorites/${propertyId}`, {
    method: saved ? 'POST' : 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => { /* endpoint may not exist yet — local persistence still works */ })
}

interface FavoritesState {
  favorites: Set<string>
  hydrated: boolean
  toggleFavorite: (propertyId: string) => void
  isFavorite: (propertyId: string) => boolean
  hydrate: () => void
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set<string>(),
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return
    set({ favorites: loadFavorites(), hydrated: true })
  },
  toggleFavorite: (propertyId) =>
    set((s) => {
      const next = new Set(s.favorites)
      let saved: boolean
      if (next.has(propertyId)) {
        next.delete(propertyId)
        saved = false
      } else {
        next.add(propertyId)
        saved = true
      }
      persistFavorites(next)
      syncFavoriteWithBackend(propertyId, saved)
      return { favorites: next }
    }),
  isFavorite: (propertyId) => get().favorites.has(propertyId),
}))
