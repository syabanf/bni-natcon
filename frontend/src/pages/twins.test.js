import { describe, expect, it } from 'vitest'
import { withTwinNumbers } from './Login'

describe('numbering identical passes on the account picker', () => {
  it('numbers people who share a name, in the order offered', () => {
    const out = withTwinNumbers([
      { id: 1, name: 'Priscilla Pang' },
      { id: 2, name: 'Priscilla Pang' },
    ])
    expect(out.map((a) => [a.twinIndex, a.twinCount])).toEqual([[1, 2], [2, 2]])
  })

  it('leaves a lone pass unnumbered', () => {
    const [only] = withTwinNumbers([{ id: 1, name: 'Billy Chan' }])
    expect(only.twinCount).toBe(1)
  })

  it('numbers each name separately', () => {
    const out = withTwinNumbers([
      { id: 1, name: 'Ayu' },
      { id: 2, name: 'Budi' },
      { id: 3, name: 'Ayu' },
    ])
    expect(out.map((a) => `${a.name}#${a.twinIndex}/${a.twinCount}`)).toEqual([
      'Ayu#1/2', 'Budi#1/1', 'Ayu#2/2',
    ])
  })

  it('treats spacing and case as the same name — they look the same on screen', () => {
    const out = withTwinNumbers([
      { id: 1, name: 'Sinta Dewi' },
      { id: 2, name: '  sinta dewi ' },
    ])
    expect(out.every((a) => a.twinCount === 2)).toBe(true)
  })
})
