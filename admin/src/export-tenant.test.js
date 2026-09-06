import { describe, expect, it, vi } from 'vitest'

// Capture the workbook instead of writing a file. xlsx is ESM here, so the
// module is mocked rather than spied on — everything else passes through.
let written = null
vi.mock('xlsx', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, writeFile: (wb) => { written = wb } }
})
const XLSX = await import('xlsx')
const { exportSheets } = await import('./excel')

describe('the per-tenant leads workbook', () => {
  it('gives every tenant its own sheet carrying its visitors with contacts', () => {
    exportSheets(
      [
        { name: 'A14 WIT.id', rows: [{ Attendee: 'Ayu', 'Member Code': 'NATCON-2026-09001', Email: 'ayu@wit.id', Phone: '+628111000154', Chapter: 'Heritage', Company: 'Ayu Co', Note: 'follow up', Time: '2026-09-03 12:30' }] },
        { name: 'A1 SSCX International', rows: [{ Attendee: 'Budi', 'Member Code': 'NATCON-2026-09002', Email: 'budi@natcon.id', Phone: '08111000201', Chapter: 'Grow', Company: 'Budi Co', Note: '', Time: '2026-09-03 12:31' }] },
      ],
      'leads.xlsx',
    )
    expect(written.SheetNames).toEqual(['A14 WIT.id', 'A1 SSCX International'])
    const rows = XLSX.utils.sheet_to_json(written.Sheets['A14 WIT.id'])
    expect(rows[0].Attendee).toBe('Ayu')
    expect(rows[0].Email).toBe('ayu@wit.id')
    expect(rows[0].Phone).toBe('+628111000154')
  })

  it('styles the header and adds a filter to each sheet', () => {
    exportSheets([{ name: 'A14 WIT.id', rows: [{ Attendee: 'Ayu', Phone: '+628111000154' }] }], 'leads.xlsx')
    const ws = written.Sheets['A14 WIT.id']
    expect(ws.A1.s.font.bold).toBe(true)
    expect(ws['!autofilter'].ref).toBe('A1:B2')
  })

  it('survives tenant names Excel would refuse as sheet names', () => {
    exportSheets(
      [
        { name: 'C1 T Royal Medicalink Pharmalab & PT Aroma Bathi Indonesia', rows: [{ A: 1 }] },
        { name: 'B2 Parahita [Diagnostic] / Center: *?', rows: [{ A: 2 }] },
        { name: 'B2 Parahita [Diagnostic] / Center: *?', rows: [{ A: 3 }] },
      ],
      'leads.xlsx',
    )
    for (const n of written.SheetNames) {
      expect(n.length).toBeLessThanOrEqual(31)
      expect(n).not.toMatch(/[:\\/?*[\]]/)
    }
    expect(new Set(written.SheetNames).size).toBe(3)
  })
})
