// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The chapter field is a searchable dropdown over the chapters table: typing
// filters the list, a tap fills the field, and an unlisted chapter still
// saves (the backend registers it).
vi.mock('./api/client', () => ({
  api: {
    chapters: () =>
      Promise.resolve({
        chapters: ['BNI Chapter Jakarta Elite', 'BNI Chapter Prestige', 'BNI Chapter Surabaya Hebat'],
      }),
    updateProfile: (name, chapter) => Promise.resolve({ user: { name, chapter } }),
    changePassword: () => Promise.resolve({}),
  },
}))

const { default: Profile } = await import('./pages/member/Profile')
const { useAuthStore } = await import('./store/auth')

afterEach(() => {
  cleanup()
  useAuthStore.setState({ token: null, user: null })
})

function renderProfile() {
  useAuthStore.setState({
    token: 't',
    user: { name: 'Reddie Wijaya', chapter: 'BNI Chapter Jakarta Elite' },
  })
  render(<MemoryRouter><Profile /></MemoryRouter>)
}

describe('the profile page chapter picker', () => {
  it('searches the chapters table and fills on a tap', async () => {
    renderProfile()
    const input = screen.getByRole('combobox')
    expect(input.value).toBe('BNI Chapter Jakarta Elite')

    // Focus opens the list; the current chapter is marked in it.
    fireEvent.focus(input)
    expect((await screen.findByRole('option', { selected: true })).textContent).toBe(
      'BNI Chapter Jakarta Elite',
    )

    // Typing filters: "sura" leaves one chapter, and tapping it fills the field.
    fireEvent.change(input, { target: { value: 'sura' } })
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['BNI Chapter Surabaya Hebat'])
    fireEvent.mouseDown(options[0])
    expect(input.value).toBe('BNI Chapter Surabaya Hebat')
    // Picking closes the list.
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('lets the keyboard walk the list', async () => {
    renderProfile()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'chapter' } })
    await screen.findByRole('listbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('BNI Chapter Prestige')
  })

  it('says an unlisted chapter registers as typed', async () => {
    renderProfile()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Chapter Baru Sekali' } })
    expect(await screen.findByText(/saving registers it as typed/)).toBeTruthy()
  })
})
