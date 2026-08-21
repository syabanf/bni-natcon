// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('./api/client', () => ({
  api: {
    me: () => Promise.resolve({ user: { name: 'Ayu Pratiwi', member_code: 'NATCON-2026-09001' }, stats: {} }),
    rundown: () => Promise.resolve({ rundown: [] }),
    tenants: () => Promise.resolve({ tenants: [] }),
    seminars: () => Promise.resolve({ seminars: [] }),
    networking: () => Promise.resolve({ table: null, mates: [] }),
    networkingSession: () => Promise.resolve({ running: false }),
    myContacts: () => Promise.resolve({ contacts: [] }),
  },
  API_ORIGIN: '',
  assetUrl: (p) => p,
}))

const { useAuthStore } = await import('./store/auth')
const { useTourStore, TOUR_SEEN_KEY } = await import('./store/tour')
const { STEPS } = await import('./components/Tour')
const { default: App } = await import('./App')

const openApp = async () => {
  window.history.pushState({}, '', '/attendee')
  useAuthStore.setState({ token: 't', user: { id: 1, name: 'Ayu Pratiwi', role: 'member' } })
  render(<App />)
  await act(async () => {})
}

const next = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /next|got it/i }))
  })
}

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ open: false })
})
afterEach(cleanup)

describe('the guided tour', () => {
  it('introduces itself the first time an attendee signs in', async () => {
    await openApp()
    expect(screen.getByText(STEPS[0].title)).toBeTruthy()
    expect(screen.getByText(/step 1 of 6/i)).toBeTruthy()
  })

  it('walks the app as it explains it', async () => {
    await openApp()
    await next()
    expect(screen.getByText(STEPS[1].title)).toBeTruthy()
    // The tour is talking about My QR, so that is the screen behind it.
    expect(window.location.pathname).toBe(STEPS[1].path)
  })

  it('goes back a step without losing its place', async () => {
    await openApp()
    await next()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back/i }))
    })
    expect(screen.getByText(STEPS[0].title)).toBeTruthy()
  })

  it('closes at the end and does not come back uninvited', async () => {
    await openApp()
    for (let i = 0; i < STEPS.length; i++) await next()
    expect(screen.queryByText(STEPS[0].title)).toBeNull()
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1')

    cleanup()
    await openApp()
    expect(screen.queryByText(/step 1 of 6/i)).toBeNull()
  })

  it('remembers a skip too — dismissing it is an answer', async () => {
    await openApp()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    })
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1')
  })

  it('is always one button away on Home afterwards', async () => {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
    await openApp()
    expect(screen.queryByText(/step 1 of 6/i)).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /how to use this app/i }))
    })
    expect(screen.getByText(STEPS[0].title)).toBeTruthy()
  })
})
