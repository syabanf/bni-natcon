import { describe, expect, it } from 'vitest'
import { normalizePhone, transformMemberRows } from './excel'

describe('normalizePhone', () => {
  it('cleans spreadsheet quirks into +62 format', () => {
    expect(normalizePhone("'+628112789988")).toBe('+628112789988')
    expect(normalizePhone("'08113096996")).toBe('+628113096996')
    expect(normalizePhone('62 811-234-567')).toBe('+62811234567')
    expect(normalizePhone('0815 912 4500')).toBe('+628159124500')
    expect(normalizePhone('')).toBe('')
  })
})

describe('transformMemberRows (ticketing export "Data Peserta")', () => {
  it('combines first/last name, normalizes phone, skips in-file duplicates', () => {
    const parsed = [
      // Ticketing-export style: no single "name" column
      {
        name: '', first_name: 'Abraham', last_name: 'Sebastian', ktp_name: 'Abraham Sebastian W',
        email: 'Abraham@Example.com', phone: "'+628112789988",
        chapter: 'Heritage', company: 'PT Makmur',
      },
      // Duplicate email (repeat buyer) — must be skipped
      {
        name: '', first_name: 'Abraham', last_name: 'Sebastian', ktp_name: '',
        email: 'abraham@example.com', phone: "'08113096996", chapter: 'Heritage', company: '',
      },
      // Simple-template style row keeps working
      { name: 'Sinta Dewi', email: 'sinta@x.id', phone: '0815 912 4500', chapter: 'Elite', company: 'Florist' },
      // Name only via ktp_name fallback
      { name: '', first_name: '', last_name: '', ktp_name: 'Budi KTP', email: 'budi@x.id', phone: '', chapter: '', company: '' },
    ]
    const { rows, skippedDuplicates } = transformMemberRows(parsed)
    expect(skippedDuplicates).toBe(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      name: 'Abraham Sebastian', email: 'abraham@example.com',
      chapter: 'Heritage', company: 'PT Makmur', phone: '+628112789988',
    })
    expect(rows[1].phone).toBe('+628159124500')
    expect(rows[2].name).toBe('Budi KTP')
  })
})
