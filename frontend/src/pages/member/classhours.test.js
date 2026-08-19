import { describe, expect, it } from 'vitest'
import { classHours } from './Seminars'

// The hour on a class card used to be the string "13:00 – 14:30", typed into
// the layout. It now comes from the rundown block the committee placed the
// class in.
describe('the hour on a class card', () => {
  it('reads the block the class sits in', () => {
    expect(
      classHours({
        starts_at: '2026-09-03T13:00:00+07:00',
        ends_at: '2026-09-03T15:00:00+07:00',
      }),
    ).toBe('13:00 – 15:00')
  })

  it('says nothing for a class the committee has not scheduled', () => {
    expect(classHours({})).toBe('')
    expect(classHours(null)).toBe('')
    expect(classHours({ starts_at: '2026-09-03T13:00:00+07:00' })).toBe('')
  })
})
