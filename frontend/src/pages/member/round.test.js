import { describe, expect, it } from 'vitest'
import { remainingSeconds } from './Networking'

// The clock the whole hall reads. Its job is to agree with everyone else's,
// including on a phone whose own clock is wrong.
const session = (over) => ({
  running: true,
  server_now: '2026-09-03T15:00:00+07:00',
  fetched_at: '2026-09-03T15:00:00+07:00',
  ends_at: '2026-09-03T15:15:00+07:00',
  ...over,
})

const at = (iso) => new Date(iso).getTime()

describe('the networking round clock', () => {
  it('counts down to the moment the committee set', () => {
    expect(remainingSeconds(session(), at('2026-09-03T15:00:00+07:00'))).toBe(15 * 60)
    expect(remainingSeconds(session(), at('2026-09-03T15:05:30+07:00'))).toBe(9 * 60 + 30)
  })

  it('shows the same time on a phone whose clock is ten minutes fast', () => {
    // The device thinks it is 15:10 when the server says 15:00; the round
    // still has fifteen minutes on it.
    const fast = session({ fetched_at: '2026-09-03T15:10:00+07:00' })
    expect(remainingSeconds(fast, at('2026-09-03T15:10:00+07:00'))).toBe(15 * 60)
  })

  it('stops at zero instead of going negative', () => {
    expect(remainingSeconds(session(), at('2026-09-03T15:20:00+07:00'))).toBe(0)
  })

  it('reads zero once the committee stops the round', () => {
    expect(remainingSeconds(session({ running: false }), at('2026-09-03T15:01:00+07:00'))).toBe(0)
  })

  it('says nothing at all before any round has started', () => {
    expect(remainingSeconds(null)).toBeNull()
    expect(remainingSeconds({ running: false })).toBeNull()
  })

  it('never restarts on its own — the old bug', () => {
    // The browser timer used to loop back to 15:00 at zero. Long past the
    // end, this stays at zero.
    expect(remainingSeconds(session(), at('2026-09-03T17:30:00+07:00'))).toBe(0)
  })
})
