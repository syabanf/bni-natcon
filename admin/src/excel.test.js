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
        chapter: 'Heritage', company: 'PT Makmur', classification: 'Trade & Distribution',
        ticket_number: 'TKT-1',
      },
      // Same ticket twice in the file — must be skipped
      {
        name: '', first_name: 'Abraham', last_name: 'Sebastian', ktp_name: '',
        email: 'abraham@example.com', phone: "'08113096996", chapter: 'Heritage', company: '',
        ticket_number: 'TKT-1',
      },
      // Same buyer, second ticket — a different person, so it must be kept
      {
        name: '', first_name: 'Bella', last_name: 'Sebastian', ktp_name: '',
        email: 'abraham@example.com', phone: "'08113096996", chapter: 'Heritage', company: '',
        ticket_number: 'TKT-2',
      },
      // Simple-template style row keeps working
      { name: 'Sinta Dewi', email: 'sinta@x.id', phone: '0815 912 4500', chapter: 'Elite', company: 'Florist' },
      // Name only via ktp_name fallback
      { name: '', first_name: '', last_name: '', ktp_name: 'Budi KTP', email: 'budi@x.id', phone: '', chapter: '', company: '' },
    ]
    const { rows, skippedDuplicates } = transformMemberRows(parsed)
    expect(skippedDuplicates).toBe(1)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toEqual({
      name: 'Abraham Sebastian', email: 'abraham@example.com',
      chapter: 'Heritage', company: 'PT Makmur', phone: '+628112789988',
      classification: 'Trade & Distribution', ticket_number: 'TKT-1',
    })
    // Second ticket on the same address is a second attendee, not a duplicate.
    expect(rows[1]).toMatchObject({ name: 'Bella Sebastian', email: 'abraham@example.com', ticket_number: 'TKT-2' })
    expect(rows[2].phone).toBe('+628159124500')
    // Sheets without the columns still import; the extras just stay empty.
    expect(rows[2].classification).toBe('')
    expect(rows[2].ticket_number).toBe('')
    expect(rows[3].name).toBe('Budi KTP')
  })
})

describe('transformTenantRows', () => {
  it('reads the official booth sheet: company is the booth, name is the person', () => {
    const { rows } = transformTenantRows([
      {
        booth: 'A1', company_name: 'SSCX International',
        category: 'Management Consultant', contact_name: 'Nicolaas Andrew', chapter: 'Star',
      },
      // Trailing whitespace and a stray tab are normal in this sheet.
      {
        booth: 'a19', company_name: '\tSinar Printing ', category: 'Printer ',
        contact_name: 'Mulyadi', chapter: 'Balionaire',
      },
    ])
    expect(rows[0]).toMatchObject({
      name: 'SSCX International', booth: 'A1', category: 'Management Consultant',
      contact_name: 'Nicolaas Andrew', chapter: 'Star', kind: 'booth',
    })
    expect(rows[1]).toMatchObject({ name: 'Sinar Printing', booth: 'A19', category: 'Printer' })
  })

  it('normalizes booth codes and kind, and skips in-file duplicate booths', () => {
    const { rows, skippedDuplicates } = transformTenantRows([
      // The older template has a single "Name" column, which the alias layer
      // reads as contact_name — with no company it becomes the booth's name.
      { contact_name: 'BNI Xpora', booth: 'sp-01', category: 'Main Sponsor', kind: 'Sponsor', initials: 'bx', email: 'X@Natcon.ID', description: 'Export hub' },
      { contact_name: 'Kopi Nusantara', booth: 'A-03', category: 'F&B', kind: '', initials: '', email: '', description: '' },
      { contact_name: 'Kopi Duplikat', booth: 'a-03', category: 'F&B', kind: '', initials: '', email: '', description: '' },
      { contact_name: '', booth: '', category: '', kind: '', initials: '', email: '', description: '' },
    ])

    expect(rows).toHaveLength(2)
    expect(skippedDuplicates).toBe(1)
    expect(rows[0]).toMatchObject({
      name: 'BNI Xpora', booth: 'SP-01', kind: 'sponsor', initials: 'BX', email: 'x@natcon.id',
    })
    // Unknown/blank kind falls back to booth.
    expect(rows[1]).toMatchObject({ booth: 'A-03', kind: 'booth', initials: '' })
    // The simple template has no company column, so "Name" is the booth's own
    // name and there is no contact person.
    expect(rows[0].contact_name).toBe('')
  })
})
