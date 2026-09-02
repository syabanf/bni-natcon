import { create } from 'zustand'
import { api } from '../api/client'
import { useAuthStore } from './auth'

/*
 * The tenant list, kept between screens.
 *
 * Passport used to fetch it on every mount and sit on "Loading tenants…"
 * while it did — on a venue WiFi that was the slowest thing in the app. The
 * list changes rarely (a stand's scanned flag, when a booth scans you), so
 * it is fetched once after sign-in, shown instantly on the next visit, and
 * refreshed quietly behind whatever is already on screen.
 *
 * Stale-while-revalidate: a refresh that fails leaves the old list where it
 * is, and a refresh already in flight is not started twice.
 */

// How long a fetched list is trusted before Home asks for it again.
export const TENANTS_MAX_AGE_MS = 60 * 1000

export const useTenantsStore = create((set, get) => ({
  tenants: null, // null = never loaded on this session
  fetchedAt: 0,
  loading: false,

  isStale: () => Date.now() - get().fetchedAt > TENANTS_MAX_AGE_MS,

  refresh: async () => {
    if (get().loading) return get().tenants
    set({ loading: true })
    try {
      const data = await api.tenants()
      set({ tenants: data.tenants || [], fetchedAt: Date.now(), loading: false })
    } catch {
      set({ loading: false })
    }
    return get().tenants
  },

  clear: () => set({ tenants: null, fetchedAt: 0, loading: false }),
}))

// The scanned flags belong to one attendee: a different sign-in on the same
// phone must not open Passport on the previous person's stamps.
useAuthStore.subscribe((state, prev) => {
  if (state.token !== prev.token) useTenantsStore.getState().clear()
})

// Warm the list for an attendee who has just signed in. Booth accounts have
// no /tenants to read, so there is nothing to warm for them.
export function preloadTenants(user) {
  if (user?.role !== 'member') return
  useTenantsStore.getState().refresh()
}
