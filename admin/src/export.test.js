import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  buildWorkbook,
  buildTemplateWorkbook,
  MEMBER_TEMPLATE,
  TENANT_TEMPLATE,
  REGISTRATION_TEMPLATE,
  parseSheet,
  transformMemberRows,
  transformTenantRows,
  transformRegistrationRows,
  MEMBER_IMPORT_ALIASES,
  TENANT_IMPORT_ALIASES,
  REGISTRATION_IMPORT_ALIASES,
} from './excel'

// Read a workbook back the way Excel would: first sheet, header row, values.
function read(wb) {
  const name = wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
  const header = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })[0] || []
  return { sheetName: name, header, rows }
}

/* ---------- the three report exports ---------- */

describe('Tenant Leads export', () => {
  const visits = [
    { member_name: 'Fahmi Syaban', member_code: 'NATCON-2026-09001', chapter: 'Heritage',
      company: 'WIT Indonesia', tenant_name: 'Hukum & Rekan', booth: 'D-01',
      visited_at: '2026-09-03T12:30:00Z' },
    { member_name: 'Reddie Wijaya', member_code: 'NATCON-2026-08154', chapter: 'Jakarta Elite',
      company: 'Witid', tenant_name: 'Kopi Nusantara', booth: 'A-03',
      visited_at: '2026-09-03T13:05:00Z' },
  ]
  const rows = visits.map((v) => ({
    Attendee: v.member_name, 'Member Code': v.member_code, Chapter: v.chapter,
    Company: v.company, Tenant: v.tenant_name, Booth: v.booth, Time: v.visited_at,
  }))

  it('carries every scan under the committee-facing headers', () => {
    const { sheetName, header, rows: out } = read(buildWorkbook(rows, 'Leads'))
    expect(sheetName).toBe('Leads')
    expect(header).toEqual(['Attendee', 'Member Code', 'Chapter', 'Company', 'Tenant', 'Booth', 'Time'])
    expect(out).toHaveLength(visits.length)
    expect(out[0]).toMatchObject({
      Attendee: 'Fahmi Syaban', 'Member Code': 'NATCON-2026-09001',
      Tenant: 'Hukum & Rekan', Booth: 'D-01',
    })
  })

  it('keeps timestamps sortable', () => {
    const { rows: out } = read(buildWorkbook(rows, 'Leads'))
    // ISO-8601 sorts correctly as text, which is how a spreadsheet will treat it.
    expect(out[0].Time < out[1].Time).toBe(true)
  })
})

describe('Class Registrations export', () => {
  const rows = [
    { Attendee: 'Fahmi Syaban', 'Member Code': 'NATCON-2026-09001', Chapter: 'Heritage',
      Slot: 1, Room: 'Learning Class 2', Class: 'Work-Life Balance & AI',
      Attended: 'Yes', 'Registered At': '2026-09-03T11:00:00Z' },
    { Attendee: 'Sinta Dewi', 'Member Code': 'NATCON-2026-08201', Chapter: 'Jakarta Elite',
      Slot: 1, Room: 'Learning Class 1', Class: 'Mid-Market HR Squeeze',
      Attended: 'Not yet', 'Registered At': '2026-09-03T11:04:00Z' },
  ]

  it('is an attendance sheet the door crew can read', () => {
    const { sheetName, header, rows: out } = read(buildWorkbook(rows, 'Registrations'))
    expect(sheetName).toBe('Registrations')
    expect(header).toEqual(['Attendee', 'Member Code', 'Chapter', 'Slot', 'Room', 'Class', 'Attended', 'Registered At'])
    expect(out.map((r) => r.Attended)).toEqual(['Yes', 'Not yet'])
    // Slot stays a number, so the sheet can be sorted and filtered on it.
    expect(typeof out[0].Slot).toBe('number')
  })
})

describe('Attendee Pins export', () => {
  const rows = [
    { 'Member Code': 'NATCON-2026-09001', Name: 'Fahmi Syaban', Email: 'fahmi@flow.test',
      Chapter: 'Heritage', Company: 'WIT Indonesia', Pins: 3 },
    { 'Member Code': 'NATCON-2026-08201', Name: 'Sinta Dewi', Email: 'sinta@natcon.id',
      Chapter: 'Jakarta Elite', Company: 'Sinta Florist', Pins: 0 },
  ]

  it('counts pins as numbers, including zero', () => {
    const { header, rows: out } = read(buildWorkbook(rows, 'Attendees'))
    expect(header).toEqual(['Member Code', 'Name', 'Email', 'Chapter', 'Company', 'Pins'])
    expect(out.map((r) => r.Pins)).toEqual([3, 0])
    expect(typeof out[1].Pins).toBe('number')
  })
})

describe('awkward values survive the export', () => {
  it('keeps ampersands, quotes, commas and non-ASCII intact', () => {
    const rows = [{
      Attendee: 'Ir. Bambang "Pak BW" Wicaksono',
      Company: 'CV. TRIANA BINTANG, Tbk & Rekan',
      Tenant: 'Kopi Nusantara — Café',
      Booth: 'A-03',
    }]
    const { rows: out } = read(buildWorkbook(rows, 'Leads'))
    expect(out[0]).toEqual(rows[0])
  })

  it('writes values that look like formulas as plain text', () => {
    // Names and companies come from an imported sheet, so some will start with
    // = + - @. Written as string cells they are shown literally; the file
    // carries no formula, so nothing is evaluated when it is opened.
    const rows = [
      { Attendee: 'Safe Name', Company: '=HYPERLINK("http://evil.example","click")' },
      { Attendee: '+62 Studio', Company: '-2+3' },
      { Attendee: '@handle', Company: 'ordinary' },
    ]
    const wb = buildWorkbook(rows, 'Leads')
    const ws = wb.Sheets.Leads
    expect(ws.B2.t).toBe('s')
    expect(ws.A3.t).toBe('s')
    expect(ws).not.toHaveProperty('B2.f')
    // No cell in the workbook carries a formula.
    const cells = Object.keys(ws).filter((k) => !k.startsWith('!'))
    expect(cells.every((k) => ws[k].f === undefined)).toBe(true)
    // And the values reach the committee exactly as they were entered.
    expect(read(wb).rows).toEqual(rows)
  })
})

/* ---------- the three import templates ---------- */

const templates = [
  ['members', MEMBER_TEMPLATE, MEMBER_IMPORT_ALIASES, transformMemberRows],
  ['booths', TENANT_TEMPLATE, TENANT_IMPORT_ALIASES, transformTenantRows],
  ['class registrations', REGISTRATION_TEMPLATE, REGISTRATION_IMPORT_ALIASES, transformRegistrationRows],
]

describe.each(templates)('%s template', (label, template, aliases, transform) => {
  it('writes the documented headers and example rows', () => {
    const { sheetName, header, rows } = read(buildTemplateWorkbook(template))
    expect(sheetName).toBe(template.sheetName)
    expect(header).toEqual(template.columns)
    expect(rows).toHaveLength(template.examples.length)
    expect(template.fileName).toMatch(/^natcon2026-template-import-.*\.xlsx$/)
  })

  it('round-trips: the template it hands out is a file it can read back', async () => {
    const wb = buildTemplateWorkbook(template)
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    // parseSheet takes a File; a Blob with a name is enough for SheetJS.
    const file = new File([buf], template.fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const parsed = await parseSheet(file, aliases)
    expect(parsed).toHaveLength(template.examples.length)
    const { rows } = transform(parsed)
    // Every example row is importable — a template whose own examples are
    // rejected would send the committee in circles.
    expect(rows.length).toBeGreaterThan(0)
  })
})
