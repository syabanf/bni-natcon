// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The wall's whole job is the ranking, so that is what this pins: the groups
// render in the order the API sends them, and a Diamond sponsor is never
// drawn below a supporter because a front end re-sorted them.
vi.mock('./api/client', () => ({
  api: {
    me: () => Promise.resolve({ user: { name: 'Ilham', member_code: 'X' }, stats: {} }),
    rundown: () => Promise.resolve({ rundown: [] }),
    sponsors: () =>
      Promise.resolve({
        groups: [
          { tier: 'diamond', label: 'Diamond Sponsor', sponsors: [{ id: 1, name: 'ZOHO', logo_url: '/sponsors/zoho.png' }] },
          { tier: 'platinum', label: 'Platinum Sponsor', sponsors: [{ id: 2, name: 'OCBC', logo_url: '/sponsors/ocbc.png' }] },
          { tier: 'supported', label: 'Supported by', sponsors: [{ id: 3, name: 'cocomodo', logo_url: '' }] },
        ],
      }),
  },
}))

const { default: Home } = await import('./pages/member/Home')

afterEach(cleanup)

describe('the sponsor wall', () => {
  it('ranks Diamond above Platinum above the supporters', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const wall = (await screen.findByText('Diamond Sponsor')).closest('.sponsor-wall')
    const tiers = [...wall.querySelectorAll('.sponsor-tier')].map((n) => n.textContent)
    expect(tiers).toEqual(['Diamond Sponsor', 'Platinum Sponsor', 'Supported by'])
  })

  it('shows each sponsor its own artwork', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const zoho = await screen.findByAltText('ZOHO')
    expect(zoho.getAttribute('src')).toBe('/sponsors/zoho.png')
  })

  it('falls back to the name when a sponsor sent no logo', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const group = (await screen.findByText('Supported by')).parentElement
    expect(within(group).getByText('cocomodo')).toBeTruthy()
    expect(within(group).queryByRole('img')).toBeNull()
  })
})
