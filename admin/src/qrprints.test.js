import { describe, expect, it } from 'vitest'
import { tableQRValue, seminarQRValue, tenantQRValue } from './QRPrints'

// Mirror of the attendee parser (frontend/src/pages/member/Networking.jsx),
// which is itself tested there against these same literals. Anchored at both
// ends so a member code's tail cannot pass as a table number.
const parseTableCode = (raw) => {
  const m = String(raw).trim().toUpperCase().match(/^(?:TABLE|MEJA|T)?[:\s-]*(\d{1,3})$/)
  return m ? parseInt(m[1], 10) : 0
}

describe('printed QR payloads', () => {
  it('table QR round-trips through the attendee scanner parser', () => {
    expect(tableQRValue({ table_no: 5 })).toBe('TABLE:5')
    expect(parseTableCode(tableQRValue({ table_no: 5 }))).toBe(5)
    expect(parseTableCode(tableQRValue({ table_no: 42 }))).toBe(42)
    // A member QR must not read as a table.
    expect(parseTableCode('NATCON-2026-09001')).toBe(0)
    expect(parseTableCode(tenantQRValue({ booth: 'A-03' }))).toBe(0)
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
