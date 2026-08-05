import { describe, expect, it } from 'vitest'
import { tableQRValue, seminarQRValue, tenantQRValue } from './QRPrints'

// The member app parses table QRs with /(?:TABLE|MEJA|T)?[:\s-]*(\d{1,3})$/,
// so the printed payload has to survive that parser.
const parseTableCode = (raw) => {
  const m = String(raw).trim().toUpperCase().match(/(?:TABLE|MEJA|T)?[:\s-]*(\d{1,3})$/)
  return m ? parseInt(m[1], 10) : 0
}

describe('printed QR payloads', () => {
  it('table QR round-trips through the attendee scanner parser', () => {
    expect(tableQRValue({ table_no: 5 })).toBe('TABLE:5')
    expect(parseTableCode(tableQRValue({ table_no: 5 }))).toBe(5)
    expect(parseTableCode(tableQRValue({ table_no: 42 }))).toBe(42)
  })

  it('seminar QR matches the door check-in room switcher', () => {
    const value = seminarQRValue({ id: 7 })
    expect(value).toBe('SEMINAR:7')
    expect(value.toUpperCase().match(/^SEMINAR[:\s-]*(\d+)$/)[1]).toBe('7')
  })

  it('tenant QR carries the booth code', () => {
    expect(tenantQRValue({ booth: 'A-03' })).toBe('BOOTH:A-03')
  })
})
