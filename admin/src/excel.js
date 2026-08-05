import * as XLSX from 'xlsx'

// Parse the first sheet of an .xlsx/.xls/.csv file into objects keyed by the
// given header aliases, e.g. { name: ['nama', 'name'], email: ['email'] }.
export async function parseSheet(file, aliases) {
  const wb = XLSX.read(await file.arrayBuffer())
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  return raw.map((row) => {
    const lower = {}
    for (const [k, v] of Object.entries(row)) {
      lower[k.trim().toLowerCase()] = String(v).trim()
    }
    const out = {}
    for (const [field, names] of Object.entries(aliases)) {
      out[field] = ''
      for (const n of names) {
        if (lower[n] !== undefined && lower[n] !== '') {
          out[field] = lower[n]
          break
        }
      }
    }
    return out
  })
}

// Normalize an Indonesian phone number from spreadsheet quirks:
// strips Excel's leading text-marker apostrophe, spaces, dots and dashes,
// then converts local 08xx / bare 62xx prefixes to +62.
export function normalizePhone(raw) {
  let p = String(raw || '').trim().replace(/^'+/, '').replace(/[\s.\-()]/g, '')
  if (!p) return ''
  if (p.startsWith('+')) return '+' + p.slice(1).replace(/\D/g, '')
  p = p.replace(/\D/g, '')
  if (p.startsWith('0')) return '+62' + p.slice(1)
  if (p.startsWith('62')) return '+' + p
  return p
}

// Turn parsed sheet rows into member-import rows. Handles both the simple
// template (Nama/Email/Chapter/Perusahaan) and the official ticketing
// export ("Data Peserta": First Name + Last Name, Phone, Bni Chapter,
// Company Name, Ktp Name). Duplicate emails within the file are skipped
// (first occurrence wins).
export function transformMemberRows(parsed) {
  const seen = new Set()
  const rows = []
  let skippedDuplicates = 0
  for (const r of parsed) {
    const name =
      r.name || [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.ktp_name || ''
    const email = (r.email || '').trim().toLowerCase()
    if (!name && !email) continue
    if (email && seen.has(email)) {
      skippedDuplicates++
      continue
    }
    if (email) seen.add(email)
    rows.push({
      name: name.trim(),
      email,
      chapter: (r.chapter || '').trim(),
      company: (r.company || '').trim(),
      phone: normalizePhone(r.phone),
    })
  }
  return { rows, skippedDuplicates }
}

// Turn parsed sheet rows into tenant-import rows. Booth code is the key,
// so duplicate booths within one file are skipped (first occurrence wins).
export function transformTenantRows(parsed) {
  const seen = new Set()
  const rows = []
  let skippedDuplicates = 0
  for (const r of parsed) {
    const name = (r.name || '').trim()
    const booth = (r.booth || '').trim().toUpperCase()
    if (!name && !booth) continue
    if (booth && seen.has(booth)) {
      skippedDuplicates++
      continue
    }
    if (booth) seen.add(booth)
    const kind = (r.kind || '').trim().toLowerCase() === 'sponsor' ? 'sponsor' : 'booth'
    rows.push({
      name,
      booth,
      category: (r.category || '').trim(),
      initials: (r.initials || '').trim().toUpperCase(),
      email: (r.email || '').trim().toLowerCase(),
      kind,
      description: (r.description || '').trim(),
    })
  }
  return { rows, skippedDuplicates }
}

export const TENANT_IMPORT_ALIASES = {
  name: ['nama', 'name', 'tenant', 'tenant name', 'nama tenant'],
  category: ['kategori', 'category', 'industry'],
  booth: ['booth', 'booth code', 'kode booth', 'no booth'],
  initials: ['inisial', 'initials'],
  email: ['email', 'e-mail', 'login email', 'email login'],
  kind: ['kind', 'jenis', 'tipe', 'type'],
  description: ['description', 'deskripsi', 'keterangan'],
}

// Column order + example rows for the downloadable import templates.
export const MEMBER_TEMPLATE = {
  columns: ['Name', 'Email', 'Chapter', 'Company', 'Phone'],
  examples: [
    {
      Name: 'Reddie Wijaya',
      Email: 'reddie@natcon.id',
      Chapter: 'Heritage',
      Company: 'Witid Intelligence',
      Phone: '+628111000154',
    },
    {
      Name: 'Sinta Dewi',
      Email: 'sinta@natcon.id',
      Chapter: 'Achievers',
      Company: 'Sinta Florist',
      Phone: '08111000201',
    },
  ],
  fileName: 'natcon2026-template-import-attendees.xlsx',
  sheetName: 'Attendees',
}

export const TENANT_TEMPLATE = {
  columns: ['Name', 'Booth', 'Category', 'Kind', 'Initials', 'Email', 'Description'],
  examples: [
    {
      Name: 'BNI Xpora',
      Booth: 'SP-01',
      Category: 'Main Sponsor',
      Kind: 'sponsor',
      Initials: 'BX',
      Email: '',
      Description: "BNI's one-stop export hub for members going global.",
    },
    {
      Name: 'Kopi Nusantara',
      Booth: 'A-03',
      Category: 'F&B',
      Kind: 'booth',
      Initials: '',
      Email: '',
      Description: 'Single-origin Indonesian coffee, free cupping at the booth.',
    },
  ],
  fileName: 'natcon2026-template-import-tenants.xlsx',
  sheetName: 'Tenants',
}

// Build an .xlsx with the header row plus example rows, so the committee
// can fill it in and import it back without guessing column names.
export function downloadTemplate({ columns, examples, sheetName, fileName }) {
  const ws = XLSX.utils.json_to_sheet(examples, { header: columns })
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(14, c.length + 4) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

export const MEMBER_IMPORT_ALIASES = {
  name: ['nama', 'name', 'full name'],
  first_name: ['first name', 'nama depan'],
  last_name: ['last name', 'nama belakang'],
  ktp_name: ['ktp name'],
  email: ['email', 'e-mail'],
  phone: ['phone', 'no hp', 'no. hp', 'telepon', 'whatsapp', 'mobile'],
  chapter: ['chapter', 'bni chapter'],
  company: ['perusahaan', 'company', 'company name', 'bisnis'],
}

export function exportSheet(rows, sheetName, fileName) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}
