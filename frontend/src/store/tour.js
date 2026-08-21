import { create } from 'zustand'

/*
 * The guided tour's open/closed state.
 *
 * It lives in a store rather than in a page because the button that starts it
 * is on Home while the tour itself is rendered by the layout — it walks the
 * attendee through every tab, so it has to outlive the page they started on.
 */
export const TOUR_SEEN_KEY = 'natcon-tour-seen'

export const seenTour = () => {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === '1'
  } catch {
    return false // private mode: better to offer the tour twice than never
  }
}

const remember = () => {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    /* nothing to do — the tour still ran */
  }
}

export const useTourStore = create((set) => ({
  open: false,
  start: () => set({ open: true }),
  // Closing always counts as seen, whether they finished or skipped: an
  // attendee who dismissed it does not want it again at every sign-in.
  close: () => {
    remember()
    set({ open: false })
  },
}))
