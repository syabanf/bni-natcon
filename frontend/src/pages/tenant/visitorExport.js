/*
 * The booth's follow-up sheet, built on the device: one row per visitor —
 * name and email, the two fields the consent notice lets a visited booth
 * keep, plus the chapter printed on their pass. Two shapes of the same list: a CSV for a spreadsheet, and a PDF
 * for printing or forwarding as-is.
 *
 * The PDF is written by hand rather than pulled from a library: the app is
 * kept light for mid-range phones, and a text table needs nothing a few
 * PDF objects cannot say. Latin-1 only (WinAnsi) — a character outside it
 * prints as "?", which is a name to check in the CSV, not a broken file.
 */

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function csvOf(rows) {
  const lines = [['Name', 'Email', 'Chapter'].map(cell).join(',')]
  for (const r of rows) lines.push([r.name, r.email, r.chapter].map(cell).join(','))
  // A BOM up front so Excel reads the UTF-8 names right.
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// ---- PDF ----

const PAGE_W = 595 // A4, points
const PAGE_H = 842
const MARGIN = 40
const ROWS_PER_PAGE = 38
const LINE_H = 17

// Punctuation the app writes that WinAnsi cannot: dashes and curly quotes
// fold to their plain cousins instead of printing as "?".
const FOLD = { '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2026': '...' }

// Text inside a PDF string literal: escape the three specials, keep Latin-1
// bytes, fold known punctuation, and replace anything wider with "?".
function pdfText(s) {
  let out = ''
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0)
    if (ch === '\\' || ch === '(' || ch === ')') out += '\\' + ch
    else if (code < 32) out += ' '
    else if (FOLD[ch]) out += FOLD[ch]
    else if (code > 255) out += '?'
    else out += ch
  }
  return out
}

function clip(s, max) {
  s = String(s ?? '')
  return s.length > max ? s.slice(0, max - 1) + '…'.replace('…', '.') : s
}

function pageContent(rows, pageNo, pageCount, title, sub, startNo) {
  const ops = []
  let y = PAGE_H - MARGIN - 10
  ops.push(`BT /F2 15 Tf ${MARGIN} ${y} Td (${pdfText(title)}) Tj ET`)
  y -= 18
  ops.push(`BT /F1 9.5 Tf ${MARGIN} ${y} Td (${pdfText(sub)}) Tj ET`)
  y -= 26
  // Column heads and a rule under them: No. · Name · Email · Chapter.
  const COL = { no: MARGIN, name: MARGIN + 30, email: MARGIN + 210, chapter: MARGIN + 400 }
  ops.push(`BT /F2 9.5 Tf ${COL.no} ${y} Td (No.) Tj ET`)
  ops.push(`BT /F2 9.5 Tf ${COL.name} ${y} Td (Name) Tj ET`)
  ops.push(`BT /F2 9.5 Tf ${COL.email} ${y} Td (Email) Tj ET`)
  ops.push(`BT /F2 9.5 Tf ${COL.chapter} ${y} Td (Chapter) Tj ET`)
  y -= 6
  ops.push(`0.85 G ${MARGIN} ${y} m ${PAGE_W - MARGIN} ${y} l S`)
  y -= 14
  rows.forEach((r, i) => {
    ops.push(`BT /F1 9.5 Tf ${COL.no} ${y} Td (${startNo + i}) Tj ET`)
    ops.push(`BT /F1 9.5 Tf ${COL.name} ${y} Td (${pdfText(clip(r.name, 36))}) Tj ET`)
    ops.push(`BT /F1 9.5 Tf ${COL.email} ${y} Td (${pdfText(clip(r.email, 38))}) Tj ET`)
    ops.push(`BT /F1 9.5 Tf ${COL.chapter} ${y} Td (${pdfText(clip(r.chapter, 22))}) Tj ET`)
    y -= LINE_H
  })
  ops.push(
    `BT /F1 8.5 Tf ${MARGIN} ${MARGIN - 12} Td (Page ${pageNo} of ${pageCount}) Tj ET`,
  )
  return ops.join('\n')
}

// Returns the PDF as bytes. Every string stays within Latin-1, so a byte
// offset is a character offset and the xref table can be written by hand.
export function pdfOf(rows, { title = 'Visitors', sub = '' } = {}) {
  const pages = []
  for (let i = 0; i < Math.max(1, rows.length); i += ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + ROWS_PER_PAGE))
  }
  const objects = [] // 1-based: index 0 unused
  const add = (body) => {
    objects.push(body)
    return objects.length
  }
  const catalog = add(null)
  const pagesObj = add(null)
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const pageIds = []
  pages.forEach((pageRows, idx) => {
    const content = pageContent(pageRows, idx + 1, pages.length, title, sub, idx * ROWS_PER_PAGE + 1)
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const page = add(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${stream} 0 R >>`,
    )
    pageIds.push(page)
  })
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`
  objects[pagesObj - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let out = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return bytes
}
