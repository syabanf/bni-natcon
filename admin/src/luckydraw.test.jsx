// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

// The draw talks to one endpoint; everything else on this page is local.
const allMembers = vi.fn()
vi.mock('./api', () => ({ api: { allMembers: (...a) => allMembers(...a) } }))

const { default: LuckyDraw } = await import('./LuckyDraw')

const POOL = [
  { id: 1, name: 'Ayu Pratiwi', chapter: 'Heritage', company: 'Alpha', member_code: 'NATCON-2026-00001', visits: 5 },
  { id: 2, name: 'Budi Santoso', chapter: 'Pioneer', company: 'Beta', member_code: 'NATCON-2026-00002', visits: 3 },
  { id: 3, name: 'Citra Dewi', chapter: 'Achievers', company: 'Gamma', member_code: 'NATCON-2026-00003', visits: 1 },
  // Never visited a booth, still in the draw: pins decide nothing.
  { id: 4, name: 'Dodi Nopin', chapter: 'Heritage', company: 'Delta', member_code: 'NATCON-2026-00004', visits: 0 },
]

// The shuffle runs on real timers for ~3.6s; fake timers let a draw finish in
// a millisecond of wall clock.
const finishShuffle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000)
  })
}

const openStage = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /stage mode/i }))
  })
}

// fireEvent wraps every call in its own act(), which flushes React between
// presses — that is the one thing the race needs NOT to happen. Raw dispatches
// inside a single act() put all the handlers in one frame, exactly like a
// finger held down on the space bar.
const pressKeys = async (...keys) => {
  await act(async () => {
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

// While the stage is up the draw is on screen twice — the panel underneath
// and the overlay — so every assertion has to say which one it means.
const stage = () => document.querySelector('.draw-fullscreen')
const onStage = () => within(stage())
const eligibleCount = () => document.querySelector('.head-right .pill').textContent

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  allMembers.mockResolvedValue(POOL)
  // jsdom implements neither side of the Fullscreen API.
  document.documentElement.requestFullscreen = vi.fn(() => Promise.resolve())
  document.exitFullscreen = vi.fn(() => Promise.resolve())
  render(<LuckyDraw onUnauthorized={() => {}} />)
  await act(async () => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Lucky Draw', () => {
  it('puts every registered attendee in the deck, pins or not', () => {
    expect(screen.getByText('4 eligible')).toBeTruthy()
  })

  it('can draw the attendee who never collected a pin', async () => {
    // Weighted by pins, Dodi (0 pins) could never win. Forced to the last
    // slot of the pool, a uniform pick lands on him.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await openStage()
    await pressKeys(' ')
    await finishShuffle()

    expect(onStage().getByText('Dodi Nopin')).toBeTruthy()
  })

  it('draws exactly one winner however many times Space is hit in one frame', async () => {
    await openStage()

    // The bug this pins: three presses in a single frame all read the phase
    // from the render that installed the handler, so all three started a
    // shuffle — three winners for one draw, in front of the room.
    await pressKeys(' ', ' ', ' ')
    await finishShuffle()

    expect(onStage().getByText(/^1 drawn:/)).toBeTruthy()
    expect(eligibleCount()).toBe('3 eligible')
    // The winners panel is the other record of what happened on stage.
    expect(document.querySelectorAll('.rank-list .rank-row')).toHaveLength(1)
  })

  it('releases the latch so the next draw still works', async () => {
    await openStage()
    await pressKeys(' ')
    await finishShuffle()
    await pressKeys(' ')
    await finishShuffle()

    expect(onStage().getByText(/^2 drawn:/)).toBeTruthy()
    expect(eligibleCount()).toBe('2 eligible')
    expect(document.querySelectorAll('.rank-list .rank-row')).toHaveLength(2)
  })

  it('ignores Space while the cards are still shuffling', async () => {
    await openStage()
    await pressKeys(' ')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(onStage().getByText(/Shuffling/)).toBeTruthy()

    await pressKeys(' ', ' ')
    await finishShuffle()

    expect(onStage().getByText(/^1 drawn:/)).toBeTruthy()
    expect(document.querySelectorAll('.rank-list .rank-row')).toHaveLength(1)
  })

  it('never draws the same person twice', async () => {
    await openStage()
    for (let i = 0; i < POOL.length; i += 1) {
      await pressKeys(' ')
      await finishShuffle()
    }
    const names = onStage().getByText(/^4 drawn:/).textContent
    expect(eligibleCount()).toBe('0 eligible')
    for (const first of ['Ayu', 'Budi', 'Citra', 'Dodi']) expect(names).toContain(first)
  })

  it('locks the page behind the stage and gives the scroll back on the way out', async () => {
    await openStage()
    expect(document.body.style.overflow).toBe('hidden')

    await pressKeys('Escape')
    expect(document.body.style.overflow).toBe('')
    expect(document.querySelector('.draw-fullscreen')).toBeNull()
  })

  it('drops the overlay when fullscreen is left by any other route', async () => {
    await openStage()
    expect(document.querySelector('.draw-fullscreen')).toBeTruthy()

    // What the browser fires when the user hits Esc on its own chrome.
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(document.querySelector('.draw-fullscreen')).toBeNull()
  })

  it('still opens the stage when the browser refuses fullscreen', async () => {
    document.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))
    await openStage()
    expect(document.querySelector('.draw-fullscreen')).toBeTruthy()
  })
})
