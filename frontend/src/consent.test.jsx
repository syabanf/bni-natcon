// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'

const calls = []
vi.mock('./api/client', () => ({
  api: {
    recordConsent: () => { calls.push('consent'); return Promise.resolve({}) },
    setPassword: (p) => { calls.push(`password:${p}`); return Promise.resolve({}) },
  },
}))

const { useAuthStore } = await import('./store/auth')
const { default: SetPassword } = await import('./pages/SetPassword')

afterEach(() => { cleanup(); calls.length = 0 })

const signedIn = (extra) =>
  useAuthStore.setState({ token: 't', user: { id: 1, name: 'Sinta Dewi', role: 'member', ...extra } })

// Being imported from the committee's ticket sheet is not the same as
// agreeing to it. The app asks, once, before it shows anybody anything.
describe('the data notice on first sign-in', () => {
  it('will not continue until the box is ticked', async () => {
    signedIn({ must_set_password: true, must_consent: true })
    render(<SetPassword />)
    const submit = screen.getByRole('button', { name: /save and continue/i })
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'rahasiaku1' } })
    fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: 'rahasiaku1' } })
    expect(submit.disabled).toBe(true)   // password alone is not enough

    fireEvent.click(screen.getByRole('checkbox'))
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    // Consent is recorded BEFORE the password: if the second call fails, the
    // agreement they just gave is still on record.
    await waitFor(() => expect(calls).toEqual(['consent', 'password:rahasiaku1']))
  })

  it('says what is handed over, in words, not fine print', () => {
    signedIn({ must_consent: true })
    render(<SetPassword />)
    expect(screen.getByText(/name and email address/i)).toBeTruthy()
  })

  it('asks for the notice alone when the password is already their own', () => {
    signedIn({ must_consent: true })
    render(<SetPassword />)
    expect(screen.queryByLabelText('New password')).toBeNull()
    expect(screen.getByRole('button', { name: /agree and continue/i })).toBeTruthy()
  })

  it('leaves an attendee who has already agreed with the password screen only', () => {
    signedIn({ must_set_password: true })
    render(<SetPassword />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByLabelText('New password')).toBeTruthy()
  })
})
