// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const login = vi.fn()
const me = vi.fn()
vi.mock('./api', () => ({
  api: { login: (...a) => login(...a), me: (...a) => me(...a) },
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
}))
vi.mock('./DoorCheckin', () => ({ default: () => <div data-testid="door-screen" /> }))

const { default: App, LOGIN_PATH, HOME_PATH } = await import('./App')

const signIn = async (email, password) => {
  const setVal = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  // By placeholder rather than by class: the sign-in markup is styling, and
  // a test that breaks when a class is renamed is testing the wrong thing.
  const emailInput = screen.getByPlaceholderText('Email')
  const passwordInput = screen.getByPlaceholderText('Password')
  await act(async () => {
    setVal(emailInput, email)
    setVal(passwordInput, password)
  })
  await act(async () => {
    fireEvent.submit(emailInput.closest('form'))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
  render(<App />)
})
afterEach(cleanup)

describe('the door app sign-in', () => {
  // The app has its own path, like /login and /tenant/login: a bookmark or a
  // printed link should say which app it opens.
  it('puts the sign-in on its own address', async () => {
    await act(async () => {})
    expect(window.location.pathname).toBe(LOGIN_PATH)
  })

  it('moves off the sign-in address once the crew is in', async () => {
    login.mockResolvedValue({ token: 't', user: { role: 'door', name: 'Door Crew' } })
    await signIn('door@natcon.id', 'secret')
    expect(await screen.findByTestId('door-screen')).toBeTruthy()
    expect(window.location.pathname).toBe(HOME_PATH)
  })

  it('lets a door account in', async () => {
    login.mockResolvedValue({ token: 't', user: { role: 'door', name: 'Door Crew' } })
    await signIn('door@natcon.id', 'natcon2026')
    expect(screen.getByTestId('door-screen')).toBeTruthy()
  })

  it('lets the committee in too — they work doors as well', async () => {
    login.mockResolvedValue({ token: 't', user: { role: 'admin', name: 'Committee' } })
    await signIn('admin@natcon.id', 'natcon2026')
    expect(screen.getByTestId('door-screen')).toBeTruthy()
  })

  it('turns an attendee away at the door, and says what to do', async () => {
    // Their password is correct — the account is simply the wrong kind. A
    // wall of 403s on the next screen would be a worse way to learn that.
    login.mockResolvedValue({ token: 't', user: { role: 'member', name: 'Attendee' } })
    await signIn('someone@natcon.id', 'heritagesomeone')

    expect(screen.queryByTestId('door-screen')).toBeNull()
    expect(screen.getByText(/not a door account/i)).toBeTruthy()
  })

  it('turns a booth account away as well', async () => {
    login.mockResolvedValue({ token: 't', user: { role: 'tenant', name: 'Booth' } })
    await signIn('booth-a1@natcon.id', 'natcon2026')
    expect(screen.queryByTestId('door-screen')).toBeNull()
  })

  it('shows what the server said about a wrong password', async () => {
    login.mockRejectedValue(new Error('incorrect email or password — please double-check'))
    await signIn('door@natcon.id', 'wrong')
    expect(screen.getByText(/incorrect email or password/i)).toBeTruthy()
  })
})
