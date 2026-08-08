import { describe, expect, it } from 'vitest'
import { parseTableCode } from './Networking'

/*
 * The admin QR Prints page prints table posters as `TABLE:<no>` (see
 * admin/src/QRPrints.jsx). These are those exact strings, checked against the
 * parser the attendee app really ships — the two apps build separately, so
 * this literal is the contract between them.
 */
describe('table QR payloads the committee prints', () => {
  it('reads the printed TABLE:<no> poster', () => {
    expect(parseTableCode('TABLE:5')).toBe(5)
    expect(parseTableCode('TABLE:42')).toBe(42)
  })

  it('still accepts what people type or older signage says', () => {
    expect(parseTableCode('5')).toBe(5)
    expect(parseTableCode(' t7 ')).toBe(7)
    expect(parseTableCode('MEJA:12')).toBe(12)
    expect(parseTableCode('Table - 9')).toBe(9)
  })

  it('refuses anything that is not a table code', () => {
    expect(parseTableCode('NATCON-2026-09001')).toBe(0)
    expect(parseTableCode('BOOTH:A-03')).toBe(0)
    expect(parseTableCode('')).toBe(0)
  })
})
