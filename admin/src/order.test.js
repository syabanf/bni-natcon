import { describe, expect, it } from 'vitest'
import { isFirstExhibitor, witFirst } from './order'

const rows = [
  { id: 1, name: 'SSCX International', booth: 'A1' },
  { id: 2, name: 'WIT.id', booth: 'A14' },
  { id: 3, name: 'Paper.id', booth: 'A20' },
]

describe('where WIT.id sits in a list', () => {
  it('moves it to the front, leaving the rest in the order they came', () => {
    expect(witFirst(rows).map((t) => t.name)).toEqual(['WIT.id', 'SSCX International', 'Paper.id'])
  })

  it('changes nothing when it is not in the list', () => {
    const without = rows.filter((t) => t.name !== 'WIT.id')
    expect(witFirst(without)).toEqual(without)
  })

  it('is matched on the name, because booth codes move', () => {
    expect(isFirstExhibitor({ name: 'wit.id', booth: 'Z9' })).toBe(true)
    expect(isFirstExhibitor({ name: 'WIT Consultants', booth: 'A14' })).toBe(false)
  })

  it('survives an empty or missing list', () => {
    expect(witFirst([])).toEqual([])
    expect(witFirst()).toEqual([])
  })
})
