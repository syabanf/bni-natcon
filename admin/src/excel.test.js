import { describe, expect, it } from 'vitest'
import { normalizePhone, transformMemberRows, transformTenantRows } from './excel'

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

describe('transformTenantRows', () => {
  it('normalizes booth codes and kind, and skips in-file duplicate booths', () => {
    const { rows, skippedDuplicates } = transformTenantRows([
      { name: 'BNI Xpora', booth: 'sp-01', category: 'Main Sponsor', kind: 'Sponsor', initials: 'bx', email: 'X@Natcon.ID', description: 'Export hub' },
      { name: 'Kopi Nusantara', booth: 'A-03', category: 'F&B', kind: '', initials: '', email: '', description: '' },
      { name: 'Kopi Duplikat', booth: 'a-03', category: 'F&B', kind: '', initials: '', email: '', description: '' },
      { name: '', booth: '', category: '', kind: '', initials: '', email: '', description: '' },
    ])

    expect(rows).toHaveLength(2)
    expect(skippedDuplicates).toBe(1)
    expect(rows[0]).toMatchObject({
      name: 'BNI Xpora', booth: 'SP-01', kind: 'sponsor', initials: 'BX', email: 'x@natcon.id',
    })
    // Unknown/blank kind falls back to booth.
    expect(rows[1]).toMatchObject({ booth: 'A-03', kind: 'booth', initials: '' })
  })
})
