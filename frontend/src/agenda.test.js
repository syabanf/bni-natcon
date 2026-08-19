import { describe, expect, it } from 'vitest'
import { dayLabel, groupByDay, timeOf } from './agenda'

const block = (id, starts) => ({ id, starts_at: starts, ends_at: starts, title: `#${id}` })

describe('the attendee agenda', () => {
  it('keeps one day as one list', () => {
    const days = groupByDay([
      block(1, '2026-09-03T09:00:00+07:00'),
      block(2, '2026-09-03T13:00:00+07:00'),
    ])
    expect(days).toHaveLength(1)
    expect(days[0].blocks.map((b) => b.id)).toEqual([1, 2])
  })

  it('splits the morning after into its own named day', () => {
    const days = groupByDay([
      block(2, '2026-09-04T08:00:00+07:00'),
      block(1, '2026-09-03T09:00:00+07:00'),
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-09-03', '2026-09-04'])
    expect(dayLabel(days[1].date)).toBe('Friday 4 September')
  })

  it('reads the hour the committee typed, not the reader’s timezone', () => {
    expect(timeOf('2026-09-03T07:00:00+07:00')).toBe('07:00')
  })

  it('survives an empty or missing programme', () => {
    expect(groupByDay([])).toEqual([])
    expect(groupByDay(null)).toEqual([])
  })
})
