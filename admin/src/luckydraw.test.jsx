// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

// The draw now asks the server for the pool and for each winner: the result
// is recorded before it reaches the screen, so a reload on stage cannot lose
// the list or hand somebody a second prize.
const draws = vi.fn()
const drawPool = vi.fn()
const drawPick = vi.fn()
const setDrawMinimum = vi.fn()
const resetDraw = vi.fn()

vi.mock('./api', () => ({
  api: {
    draws: (...a) => draws(...a),
    drawPool: (...a) => drawPool(...a),
    drawPick: (...a) => drawPick(...a),
    setDrawMinimum: (...a) => setDrawMinimum(...a),
    resetDraw: (...a) => resetDraw(...a),
  },
}))

const { default: LuckyDraw } = await import('./LuckyDraw')

const entrant = (id, name, visits = 0) => ({
  member_id: id, name, member_code: `NATCON-2026-0000${id}`,
  chapter: 'Heritage', company: 'Alpha', visits,
})

const POOL = [entrant(1, 'Ayu Pratiwi', 5), entrant(2, 'Budi Santoso', 0), entrant(3, 'Citra Dewi', 12)]

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

// fireEvent wraps each call in its own act(), which flushes React between
// presses — the one thing the race needs NOT to happen.
const pressKeys = async (...keys) => {
  await act(async () => {
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

const stage = () => document.querySelector('.draw-fullscreen')
const onStage = () => within(stage())
const eligibleCount = () => document.querySelector('.head-right .pill').textContent

beforeEach(async () => {
  // These are module-level fakes, so their call counts survive between tests
  // unless cleared — and half of what this file asserts is a call count.
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  draws.mockResolvedValue({
    draws: [
      { key: 'lucky', name: 'Lucky Draw', min_booth_visits: 0, winner_count: 0 },
      { key: 'doorprize', name: 'Doorprize', min_booth_visits: 0, winner_count: 0 },
    ],
  })
  drawPool.mockResolvedValue({ eligible: POOL, winners: [] })
  let position = 0
  drawPick.mockImplementation(() => {
    position += 1
    return Promise.resolve({ winner: { ...POOL[position - 1], position } })
  })
  document.documentElement.requestFullscreen = vi.fn(() => Promise.resolve())
  document.exitFullscreen = vi.fn(() => Promise.resolve())
  render(<LuckyDraw onUnauthorized={() => {}} />)
  await act(async () => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the draws', () => {
  it('offers both draws, not one', () => {
    expect(screen.getByRole('button', { name: /Lucky Draw/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Doorprize/i })).toBeTruthy()
  })

  it('shows the pool the server says is eligible', () => {
    expect(eligibleCount()).toBe('3 eligible')
  })

  it('switching draw loads that draw’s own pool and winners', async () => {
    drawPool.mockClear()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Doorprize/i }))
    })
    expect(drawPool).toHaveBeenCalledWith('doorprize', expect.anything())
  })

  it('asks the server once however many times Space is hit in one frame', async () => {
    await openStage()

    // The bug this pins: three presses in one frame all read the phase from
    // the render that installed the handler, so all three started a draw.
    await pressKeys(' ', ' ', ' ')
    await finishShuffle()

    expect(drawPick).toHaveBeenCalledTimes(1)
    expect(onStage().getByText(/^1 drawn:/)).toBeTruthy()
  })

  it('releases the latch so the next draw still works', async () => {
    await openStage()
    await pressKeys(' ')
    await finishShuffle()
    await pressKeys(' ')
    await finishShuffle()

    expect(drawPick).toHaveBeenCalledTimes(2)
    expect(onStage().getByText(/^2 drawn:/)).toBeTruthy()
  })

  it('takes the winner out of the pool on screen', async () => {
    await openStage()
    await pressKeys(' ')
    await finishShuffle()

    expect(eligibleCount()).toBe('2 eligible')
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

    expect(drawPick).toHaveBeenCalledTimes(1)
  })

  it('says why when the server has nobody left to draw', async () => {
    drawPick.mockRejectedValueOnce(
      Object.assign(new Error('nobody left to draw — everyone eligible has already won'), {
        status: 409,
      }),
    )
    await openStage()
    await pressKeys(' ')
    await finishShuffle()

    expect(screen.getByText(/nobody left to draw/i)).toBeTruthy()
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
