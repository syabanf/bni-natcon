import { create } from 'zustand'

/*
 * The guided tour's open/closed state.
 *
 * It lives in a store rather than in a page because the button that starts it
 * is in the top bar while the tour itself is rendered by the layout — it
 * walks the attendee through every tab, so it has to outlive the page they
 * started on.
 *
 * The tour only ever opens when somebody asks for it. It used to introduce
 * itself on first sign-in; an attendee arriving at a registration desk is
 * usually trying to do one thing, and a sheet across the screen is in the way
 * of it.
 */
export const useTourStore = create((set) => ({
  open: false,
  start: () => set({ open: true }),
  close: () => set({ open: false }),
}))
