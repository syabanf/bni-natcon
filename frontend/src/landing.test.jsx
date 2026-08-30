// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { default: Landing } = await import('./pages/Landing')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the landing page', () => {
  it('counts down to the morning of 3 September, WIB', () => {
    // Two days, three hours before the doors open — regardless of the
    // machine's own timezone, because the target pins +07:00.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T04:00:00+07:00'))
    render(<MemoryRouter><Landing /></MemoryRouter>)
    expect(screen.getByAltText(/BNI Indonesia National Conference 2026/)).toBeTruthy()
    expect(screen.getByText('3 September 2026 · Pullman Central Park Jakarta')).toBeTruthy()
    const units = [...document.querySelectorAll('.cd-num')].map((n) => n.textContent)
    expect(units).toEqual(['02', '03', '00', '00'])
  })

  it('turns into a doorway once the day arrives', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T08:00:00+07:00'))
    render(<MemoryRouter><Landing /></MemoryRouter>)
    expect(screen.getByText(/We are live/)).toBeTruthy()
    expect(document.querySelector('.cd-num')).toBeNull()
  })

  it('advertises no sign-in at all — a poster until credentials go out', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>)
    expect(screen.queryByText('Attendee sign-in')).toBeNull()
    expect(screen.queryByText(/Booth scanner/)).toBeNull()
    expect(document.querySelector('a')).toBeNull()
  })
})
