// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('./api/client', () => ({
  api: {
    me: () => Promise.resolve({ user: { name: 'Ayu Pratiwi', member_code: 'NATCON-2026-09001' }, stats: {} }),
    rundown: () => Promise.resolve({ rundown: [] }),
    sponsors: () => Promise.resolve({ groups: [] }),
    tenants: () => Promise.resolve({ tenants: [] }),
    seminars: () => Promise.resolve({ seminars: [] }),
    networking: () => Promise.resolve({ table: null, mates: [] }),
    networkingSession: () => Promise.resolve({ running: false }),
    myContacts: () => Promise.resolve({ contacts: [] }),
  },
  API_ORIGIN: '',
  assetUrl: (p) => p,
}))

// jsdom has no speech synthesis; this stands in for it so the tests can say
// what the tour asked to be read, and when it stopped.
const spoken = []
let cancelled = 0
window.speechSynthesis = {
  speak: (u) => spoken.push(u.text),
  cancel: () => {
    cancelled += 1
  },
}
window.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text
  }
}

const { useAuthStore } = await import('./store/auth')
const { useTourStore } = await import('./store/tour')
const { STEPS } = await import('./components/Tour')
const { default: App } = await import('./App')

const openApp = async () => {
  window.history.pushState({}, '', '/attendee')
  useAuthStore.setState({ token: 't', user: { id: 1, name: 'Ayu Pratiwi', role: 'member' } })
  render(<App />)
  await act(async () => {})
}

const openTour = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /quick tour/i }))
  })
}

const next = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /next|got it/i }))
  })
}

beforeEach(() => {
  localStorage.clear()
  spoken.length = 0
  cancelled = 0
  useTourStore.setState({ open: false })
})
afterEach(cleanup)

describe('the guided tour', () => {
  it('stays out of the way until it is asked for', async () => {
    await openApp()
    expect(screen.queryByText(/step 1 of 6/i)).toBeNull()

    await openTour()
    expect(screen.getByText(STEPS[0].title)).toBeTruthy()
    expect(screen.getByText(/step 1 of 6/i)).toBeTruthy()
  })

  it('walks the app as it explains it', async () => {
    await openApp()
    await openTour()
    await next()
    expect(screen.getByText(STEPS[1].title)).toBeTruthy()
    // The tour is talking about My QR, so that is the screen behind it.
    expect(window.location.pathname).toBe(STEPS[1].path)
  })

  it('goes back a step without losing its place', async () => {
    await openApp()
    await openTour()
    await next()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back/i }))
    })
    expect(screen.getByText(STEPS[0].title)).toBeTruthy()
  })

  it('closes at the end, and starts from the beginning next time', async () => {
    await openApp()
    await openTour()
    for (let i = 0; i < STEPS.length; i++) await next()
    expect(screen.queryByText(STEPS[0].title)).toBeNull()

    await openTour()
    expect(screen.getByText(/step 1 of 6/i)).toBeTruthy()
  })

  it('closes on Skip', async () => {
    await openApp()
    await openTour()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    })
    expect(screen.queryByText(STEPS[0].title)).toBeNull()
  })

  it('reads each step out loud', async () => {
    await openApp()
    await openTour()
    expect(spoken[0]).toContain(STEPS[0].title)
    await next()
    expect(spoken[spoken.length - 1]).toContain(STEPS[1].title)
  })

  it('stops talking the moment it is closed', async () => {
    await openApp()
    await openTour()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    })
    expect(cancelled).toBeGreaterThan(0)
  })

  it('can be silenced, and stays silent next time', async () => {
    await openApp()
    await openTour()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stop reading out loud/i }))
    })
    const said = spoken.length
    await next()
    expect(spoken.length).toBe(said) // nothing more was read

    cleanup()
    spoken.length = 0
    await openApp()
    await openTour()
    expect(spoken).toHaveLength(0)
    expect(screen.getByRole('button', { name: /read the tour out loud/i })).toBeTruthy()
  })

  it('is one button away from any attendee screen', async () => {
    window.history.pushState({}, '', '/attendee/passport')
    await openApp()
    await openTour()
    // Wherever it is started from, it begins at the beginning: on Home.
    expect(screen.getByText(STEPS[0].title)).toBeTruthy()
    expect(window.location.pathname).toBe(STEPS[0].path)
  })
})
