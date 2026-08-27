// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The server no longer sends a phone number to either app. These pin the
// screens themselves, so a payload that starts carrying one again — a
// rollback, a new endpoint — still cannot put it in front of anybody.
const mate = {
  member_id: 7, name: 'Sinta Dewi', chapter: 'Star', company: 'Sinta Florist',
  classification: 'Trade & Distribution', seat_no: 2, is_me: false, saved: false,
  phone: '+62811000201',
}

vi.mock('./api/client', () => ({
  api: {
    networking: () => Promise.resolve({ checked_in: true, seat_no: 1, tables: [], mates: [mate, { ...mate, member_id: 1, is_me: true }], table: { table_no: 12, name: 'Table 12', hall: 'Main', capacity: 8, occupied: 2 } }),
    networkingHistory: () => Promise.resolve({ tables: [], contacts: [] }),
    networkingSession: () => Promise.resolve({ running: false, seconds_left: 0, round: 1 }),
    boothVisitors: () => Promise.resolve({ visitors: [] }),
    visitorDetail: () => Promise.resolve({ visitor: { member_id: 7, name: 'Sinta Dewi', chapter: 'Star', company: 'Sinta Florist', member_code: 'NATCON-2026-09001', note: '', phone: '+62811000201' } }),
    boothStats: () => Promise.resolve({ stats: {} }),
  },
}))

afterEach(cleanup)

const noNumberAnywhere = () => {
  const text = document.body.innerText || document.body.textContent || ''
  expect(text).not.toMatch(/\+?62\s?811|0811|wa\.me|WhatsApp/i)
  expect(document.querySelector('a[href^="tel:"]')).toBeNull()
  expect(document.querySelector('a[href*="wa.me"]')).toBeNull()
}

describe('phone numbers never reach a screen', () => {
  it('a networking tablemate shows who they are, not their number', async () => {
    const { default: Networking } = await import('./pages/member/Networking')
    render(<MemoryRouter><Networking /></MemoryRouter>)
    expect((await screen.findAllByText('Sinta Florist')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trade & Distribution').length).toBeGreaterThan(0)
    noNumberAnywhere()
  })
})
