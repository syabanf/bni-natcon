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

describe('the per-tenant handout workbook', () => {
  it('gives every tenant its own sheet, phone nowhere in it', () => {
    exportSheets(
      [
        { name: 'A14 WIT.id', rows: [{ Attendee: 'Ayu', 'Member Code': 'NATCON-2026-09001', Chapter: 'Heritage', Company: 'Ayu Co', Note: 'follow up', Time: 'x' }] },
        { name: 'A1 SSCX International', rows: [{ Attendee: 'Budi', 'Member Code': 'NATCON-2026-09002', Chapter: 'Grow', Company: 'Budi Co', Note: '', Time: 'y' }] },
      ],
      'leads.xlsx',
    )
    expect(written.SheetNames).toEqual(['A14 WIT.id', 'A1 SSCX International'])
    const rows = XLSX.utils.sheet_to_json(written.Sheets['A14 WIT.id'])
    expect(rows[0].Attendee).toBe('Ayu')
    expect(Object.keys(rows[0])).not.toContain('Phone')
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
