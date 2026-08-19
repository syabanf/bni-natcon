import { describe, expect, it } from 'vitest'
import { scanCode } from './pass'

describe('what the pass QR carries', () => {
  it('is the ticket number when the attendee came from the ticketing sheet', () => {
    expect(scanCode({ ticket_number: '16C6C-23BBA1745', member_code: 'NATCON-2026-09001' }))
      .toBe('16C6C-23BBA1745')
  })

  it('falls back to the member code for someone added by hand', () => {
    expect(scanCode({ ticket_number: '', member_code: 'NATCON-2026-09001' }))
      .toBe('NATCON-2026-09001')
  })

  it('is empty rather than "undefined" before the profile loads', () => {
    expect(scanCode(null)).toBe('')
    expect(scanCode({})).toBe('')
  })
})
