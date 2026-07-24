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

export function exportSheet(rows, sheetName, fileName) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}
