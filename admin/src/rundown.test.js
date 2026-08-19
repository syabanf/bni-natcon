import { describe, expect, it } from 'vitest'
import { blockLength, dateOf, dayLabel, groupByDay, overlapping, toIso } from './Rundown'

const block = (id, starts, ends) => ({ id, starts_at: starts, ends_at: ends })

describe('the rundown, across more than one day', () => {
  it('names each day so 3 and 4 September cannot be confused', () => {
    expect(dayLabel('2026-09-03')).toBe('Thursday 3 September')
    expect(dayLabel('2026-09-04')).toBe('Friday 4 September')
  })

  it('groups blocks under their own day, in the order the days run', () => {
    const days = groupByDay([
      block(2, '2026-09-04T08:00:00+07:00', '2026-09-04T11:00:00+07:00'),
      block(1, '2026-09-03T09:00:00+07:00', '2026-09-03T10:00:00+07:00'),
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-09-03', '2026-09-04'])
    expect(days[1].blocks.map((b) => b.id)).toEqual([2])
  })

  it('measures length instead of subtracting hours, so a block can cross midnight', () => {
    expect(blockLength(block(1, '2026-09-03T23:00:00+07:00', '2026-09-04T01:00:00+07:00')))
      .toBe('2 hours')
    expect(blockLength(block(2, '2026-09-03T09:00:00+07:00', '2026-09-03T10:00:00+07:00')))
      .toBe('1 hour')
  })

  it('only calls blocks overlapping when they are on the same day', () => {
    const sameHourNextDay = [
      block(1, '2026-09-03T08:00:00+07:00', '2026-09-03T09:00:00+07:00'),
      block(2, '2026-09-04T08:00:00+07:00', '2026-09-04T09:00:00+07:00'),
    ]
    expect(overlapping(sameHourNextDay).size).toBe(0)
    expect(overlapping([
      block(1, '2026-09-03T08:00:00+07:00', '2026-09-03T10:00:00+07:00'),
      block(2, '2026-09-03T09:00:00+07:00', '2026-09-03T11:00:00+07:00'),
    ]).size).toBe(2)
  })

  it('builds the timestamp on the date the committee picked', () => {
    expect(toIso('2026-09-04', 8)).toBe('2026-09-04T08:00:00+07:00')
    expect(dateOf('2026-09-04T08:00:00+07:00')).toBe('2026-09-04')
  })
})
