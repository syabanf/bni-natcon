// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { default: Landing } = await import('./pages/Landing')

// The public programme the poster fetches — trimmed to one block and one class.
const AGENDA = {
  rundown: [
    {
      id: 1,
      title: 'Registration & Open Networking',
      place: '',
      starts_at: '2026-09-03T07:00:00+07:00',
      ends_at: '2026-09-03T08:00:00+07:00',
    },
    {
      id: 2,
      title: 'Learning Session 1',
      place: '',
      starts_at: '2026-09-03T08:00:00+07:00',
      ends_at: '2026-09-03T10:00:00+07:00',
    },
    {
      id: 3,
      title: 'Gold Club Breakfast',
      place: 'Gold Club ticket holders only',
      starts_at: '2026-09-04T08:00:00+07:00',
      ends_at: '2026-09-04T10:00:00+07:00',
    },
  ],
  classes: [
    {
      room: 'Learning Session 2',
      title: 'Work-Life Balance & AI',
      slot: 1,
      speaker: 'Viktor Iwan & Irfan Arsandi',
      moderator: 'Ryan Kristomuljono',
      description: 'AI is already in the stack.',
      cover_url: '/covers/learning-class-2.jpg',
    },
  ],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => AGENDA }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
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
    expect(screen.getByText('See you in Jakarta')).toBeTruthy()
    const units = [...document.querySelectorAll('.cd-num')].map((n) => n.textContent)
    // Days print unpadded like the reference; the clock units keep two digits.
    expect(units).toEqual(['2', '03', '00', '00'])
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

  it('keeps the programme behind two buttons — a popup, not a longer poster', async () => {
    render(<MemoryRouter><Landing /></MemoryRouter>)
    // Nothing of the programme on the poster itself.
    expect(document.querySelector('.lr-row')).toBeNull()
    fireEvent.click(screen.getByText('Event Rundown'))
    expect(await screen.findByText('Registration & Open Networking')).toBeTruthy()
    // The morning-after breakfast stays off the poster's rundown.
    expect(screen.queryByText('Gold Club Breakfast')).toBeNull()
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByText('Registration & Open Networking')).toBeNull()
    fireEvent.click(screen.getByText('Learning Sessions'))
    expect(await screen.findByText('Work-Life Balance & AI')).toBeTruthy()
    expect(screen.getByText('Viktor Iwan & Irfan Arsandi')).toBeTruthy()
    expect(screen.getByText(/Moderator: Ryan Kristomuljono/)).toBeTruthy()
    // Still not a single link on the page, popup open or closed.
    expect(document.querySelector('a')).toBeNull()
  })

  it('opens a detail view for each learning session', async () => {
    render(<MemoryRouter><Landing /></MemoryRouter>)
    fireEvent.click(screen.getByText('Learning Sessions'))
    fireEvent.click(await screen.findByText('Work-Life Balance & AI'))
    // The full story, not the clamped card: description, session hours, a way back.
    expect(screen.getByText('AI is already in the stack.')).toBeTruthy()
    expect(screen.getByText(/Session 1 · 08:00–10:00 WIB/)).toBeTruthy()
    fireEvent.click(screen.getByText('‹ All sessions'))
    expect(screen.getByText('View details ›')).toBeTruthy()
    expect(document.querySelector('a')).toBeNull()
  })
})
