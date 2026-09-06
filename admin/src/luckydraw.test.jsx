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
const setDrawPrizeList = vi.fn()
const resetDraw = vi.fn()

vi.mock('./api', () => ({
  api: {
    draws: (...a) => draws(...a),
    drawPool: (...a) => drawPool(...a),
    drawPick: (...a) => drawPick(...a),
    setDrawMinimum: (...a) => setDrawMinimum(...a),
    setDrawPrizeList: (...a) => setDrawPrizeList(...a),
    resetDraw: (...a) => resetDraw(...a),
  },
}))

const { default: LuckyDraw } = await import('./LuckyDraw')

const entrant = (id, name, visits = 0) => ({
  member_id: id, name, member_code: `NATCON-2026-0000${id}`,
  chapter: 'Heritage', company: 'Alpha', visits,
})

const POOL = [entrant(1, 'Ayu Pratiwi', 5), entrant(2, 'Budi Santoso', 0), entrant(3, 'Citra Dewi', 12)]

// Longer than SHUFFLE_MS (5 s): the shuffle has to have finished, whatever
// the exact timer arithmetic adds on top.
const finishShuffle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(11000)
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
    // The next spin waits for the button — the keyboard does not roll it.
    await act(async () => {
      fireEvent.click(onStage().getByRole('button', { name: /draw the next winner/i }))
    })
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

  it('will not roll the next spin from the keyboard while a winner is up', async () => {
    await openStage()
    await pressKeys(' ')
    await finishShuffle()
    expect(onStage().getByText(/^1 drawn:/)).toBeTruthy()

    // A stray, held or auto-repeating key must not start the next draw —
    // the winner stays up until someone clicks the button.
    await pressKeys(' ', ' ', ' ')
    expect(drawPick).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(onStage().getByRole('button', { name: /draw the next winner/i }))
    })
    await finishShuffle()
    expect(drawPick).toHaveBeenCalledTimes(2)
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

  it('edits the prize queue row by row, with add and remove buttons', async () => {
    const rows = () => [...document.querySelectorAll('.draw-prize-row input')]
    // Empty queue starts with no rows and an Add button.
    expect(screen.getByRole('button', { name: /add prize/i })).toBeTruthy()
    expect(rows().length).toBe(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add prize/i }))
    })
    expect(rows().length).toBe(1)

    // Typing saves the queue; every row is its own field.
    await act(async () => {
      fireEvent.change(rows()[0], { target: { value: 'Umroh' } })
    })
    expect(setDrawPrizeList).toHaveBeenLastCalledWith('lucky', ['Umroh'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add prize/i }))
    })
    await act(async () => {
      fireEvent.change(rows()[1], { target: { value: 'Smart TV' } })
    })
    expect(setDrawPrizeList).toHaveBeenLastCalledWith('lucky', ['Umroh', 'Smart TV'])

    // Editing the first row in place keeps the rest.
    await act(async () => {
      fireEvent.change(rows()[0], { target: { value: 'Umroh 2026' } })
    })
    expect(setDrawPrizeList).toHaveBeenLastCalledWith('lucky', ['Umroh 2026', 'Smart TV'])

    // The × on the second row drops it.
    await act(async () => {
      fireEvent.click(document.querySelectorAll('.draw-prize-row .dpr-remove')[1])
    })
    expect(rows().length).toBe(1)
    expect(setDrawPrizeList).toHaveBeenLastCalledWith('lucky', ['Umroh 2026'])
  })

  it('moves to the next prize after each winner', async () => {
    draws.mockResolvedValue({
      draws: [
        {
          key: 'lucky',
          name: 'Lucky Draw',
          prize_list: ['Umroh', 'Smart TV'],
          min_booth_visits: 0,
          winner_count: 0,
        },
        {
          key: 'doorprize',
          name: 'Doorprize',
          prize_list: [],
          min_booth_visits: 0,
          winner_count: 0,
        },
      ],
    })
    // Reload the draws so the mocked prize list reaches the page.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Doorprize/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Lucky Draw/i }))
    })

    // First prize is on stage before anything is drawn.
    expect(document.querySelector('.draw-stage .draw-prize-name')?.textContent).toBe('Umroh')

    await openStage()
    await pressKeys(' ')
    await finishShuffle()
    expect(onStage().getByText('Umroh')).toBeTruthy() // the prize they just won
    // The next prize only spins once the button is clicked.
    await act(async () => {
      fireEvent.click(onStage().getByRole('button', { name: /draw the next winner/i }))
    })
    await finishShuffle()
    expect(onStage().getByText('Smart TV')).toBeTruthy() // and auto-next works
  })
})
