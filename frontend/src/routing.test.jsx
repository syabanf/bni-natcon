// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// The apps share one sign-in endpoint, so an account that belongs to a
// DIFFERENT app can sign in here. What happens next is the point of this
// file: a door or admin account has no home in the attendee app, and used to
// be bounced from /attendee to /attendee forever — a white screen with
// nothing on it and no way out.
vi.mock('./api/client', () => ({
  api: {
    me: () => Promise.resolve({ user: null, stats: null }),
    rundown: () => Promise.resolve({ rundown: [] }),
    sponsors: () => Promise.resolve({ groups: [] }),
    tenants: () => Promise.resolve({ tenants: [] }),
  },
  API_ORIGIN: '',
  assetUrl: (p) => p,
}))

const { useAuthStore } = await import('./store/auth')
const { default: App, homeFor } = await import('./App')

const signIn = (role) =>
  useAuthStore.setState({ token: 'tok', user: { id: 1, name: 'Door Crew', role } })

beforeEach(() => {
  window.history.pushState({}, '', '/attendee')
  useAuthStore.setState({ token: null, user: null })
})
afterEach(cleanup)

describe('an account from another app signs in at the attendee door', () => {
  it('never sends a role back to the page it was just refused', () => {
    for (const role of ['door', 'admin', 'member', 'tenant']) {
      const home = homeFor({ role })
      expect(typeof home === 'string' || home === null).toBe(true)
    }
    // The loop was homeFor('door') === '/attendee', the very page that
    // refuses a door account.
    expect(homeFor({ role: 'door' })).not.toBe('/attendee')
    expect(homeFor({ role: 'admin' })).not.toBe('/attendee')
  })

  it('says so on screen instead of leaving a blank page', async () => {
    signIn('door')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /door crew account/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /door app/i })).toBeTruthy()
  })

  it('points a committee account at the admin panel', async () => {
    signIn('admin')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /committee account/i })).toBeTruthy()
  })

  it('still says something for a role it has never heard of', async () => {
    signIn('caterer')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /cannot open the attendee app/i })).toBeTruthy()
  })

  it('signing out from that screen puts the sign-in form back', async () => {
    signIn('door')
    render(<App />)
    const out = await screen.findByRole('button', { name: /sign out/i })
    out.click()
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('walks a booth crew through choosing their own password first', async () => {
    window.history.pushState({}, '', '/tenant/scanner')
    useAuthStore.setState({
      token: 't',
      user: { id: 9, name: 'WIT.id', role: 'tenant', must_set_password: true },
    })
    render(<App />)
    // The handed-out password opened the door; nothing else opens until the
    // crew replaces it.
    expect(await screen.findByRole('heading', { name: /choose your password/i })).toBeTruthy()
  })

  it('leaves the attendee app working for an attendee', async () => {
    signIn('member')
    render(<App />)
    expect(await screen.findByText(/Hello/i)).toBeTruthy()
  })
})
