// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./api/client', () => ({ api: { login: () => Promise.resolve({}) } }))

const { default: Login } = await import('./pages/Login')

afterEach(cleanup)

// Booth logins and every generated first password are all-lowercase by
// construction. A phone keyboard undoes that: it capitalises the first
// letter the moment somebody taps "show password", and the crew is turned
// away at their own booth. The fields must never capitalise or autocorrect.
describe('sign-in fields on a phone', () => {
  for (const [label, kind] of [['Email', 'tenant'], ['Email', 'member']]) {
    it(`leaves the ${kind} email exactly as typed`, () => {
      render(<MemoryRouter><Login kind={kind} /></MemoryRouter>)
      const field = screen.getByLabelText(label)
      expect(field.getAttribute('autocapitalize')).toBe('none')
      expect(field.getAttribute('autocorrect')).toBe('off')
      expect(field.getAttribute('spellcheck')).toBe('false')
    })
  }

  it('leaves the password exactly as typed, revealed or not', () => {
    render(<MemoryRouter><Login kind="tenant" /></MemoryRouter>)
    const field = screen.getByLabelText('Password')
    expect(field.getAttribute('autocapitalize')).toBe('none')
    expect(field.getAttribute('autocorrect')).toBe('off')
    expect(field.getAttribute('spellcheck')).toBe('false')
  })
})
