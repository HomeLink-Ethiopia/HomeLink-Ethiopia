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

interface FavoritesState {
  favorites: Set<string>
  toggleFavorite: (propertyId: string) => void
  isFavorite: (propertyId: string) => boolean
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set<string>(),
  toggleFavorite: (propertyId) =>
    set((s) => {
      const next = new Set(s.favorites)
      if (next.has(propertyId)) {
        next.delete(propertyId)
      } else {
        next.add(propertyId)
      }
      return { favorites: next }
    }),
  isFavorite: (propertyId) => get().favorites.has(propertyId),
}))
