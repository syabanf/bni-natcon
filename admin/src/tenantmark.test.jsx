// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('./api', () => ({ assetUrl: (p) => (p?.startsWith('/uploads/') ? `http://api${p}` : p) }))

const { default: TenantMark } = await import('./TenantMark')

afterEach(cleanup)

describe('how a booth is marked in the committee’s lists', () => {
  it('shows the logo when the company sent one', () => {
    render(<TenantMark tenant={{ name: 'Paper.id', initials: 'P', logo_url: '/logos/paper-id.png' }} />)
    const img = screen.getByRole('img', { name: 'Paper.id' })
    expect(img.getAttribute('src')).toBe('/logos/paper-id.png')
    expect(screen.queryByText('P')).toBeNull()
  })

  it('falls back to the initials, never to an empty tile', () => {
    render(<TenantMark tenant={{ name: 'SSCX International', initials: 'SI', logo_url: '' }} />)
    expect(screen.getByText('SI')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('sends an uploaded logo to the API, not to the admin origin', () => {
    render(<TenantMark tenant={{ name: 'Booth Z', initials: 'BZ', logo_url: '/uploads/z.png' }} />)
    expect(screen.getByRole('img').getAttribute('src')).toBe('http://api/uploads/z.png')
  })

  it('keeps the caller’s own class so it can sit in a ranking row or a hero', () => {
    render(<TenantMark tenant={{ name: 'X', initials: 'X' }} className="rank-ini" />)
    expect(screen.getByText('X').closest('.tn-mark').className).toContain('rank-ini')
  })

  it('puts the logo and the initials in the same slot, so names line up', () => {
    const { container } = render(
      <>
        <TenantMark tenant={{ name: 'With', initials: 'WI', logo_url: '/logos/a.png' }} />
        <TenantMark tenant={{ name: 'Without', initials: 'WO' }} />
      </>,
    )
    const slots = container.querySelectorAll('.tn-mark')
    expect(slots).toHaveLength(2)
    expect(slots[0].className).toBe(slots[1].className)
  })
})
