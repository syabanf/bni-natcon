import { describe, expect, it } from 'vitest'
import { tableQRValue, seminarQRValue, tenantQRValue, doorQRValue, DOORS, PUBLIC_APP_URL } from './QRPrints'

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

  it('door QRs carry the two sign-in URLs attendees and booths actually open', () => {
    const byKey = Object.fromEntries(DOORS.map((d) => [d.key, doorQRValue(d.path)]))
    expect(byKey['door-attendee']).toBe(`${PUBLIC_APP_URL}/login`)
    expect(byKey['door-tenant']).toBe(`${PUBLIC_APP_URL}/tenant/login`)
    // The two doors must never collapse into one — a booth crew sent to the
    // attendee door gets attendee-only wording and a recovery link they
    // cannot use.
    expect(byKey['door-attendee']).not.toBe(byKey['door-tenant'])
    for (const url of Object.values(byKey)) {
      // Absolute https, or a phone camera will not offer to open it...
      expect(url).toMatch(/^https:\/\/[^/]+\/\S+$/)
      // ...and no doubled slash from a base URL that ended in one.
      expect(url.slice('https://'.length)).not.toContain('//')
    }
  })
})
