import { describe, expect, it } from 'vitest'
import { csvOf, pdfOf } from './visitorExport'

const rows = [
  { name: 'Sinta Dewi', email: 'sinta@natcon.id', chapter: 'Star' },
  { name: 'Reddie "RW" Wijaya', email: 'reddie@natcon.id', chapter: 'Jakarta Elite' },
]

describe('the booth visitor export', () => {
  it('writes a CSV of name and email, and nothing else', () => {
    const csv = csvOf(rows)
    expect(csv.startsWith('﻿"Name","Email"')).toBe(true)
    expect(csv).toContain('"Sinta Dewi","sinta@natcon.id"')
    // A quote inside a name is doubled, the way spreadsheets expect.
    expect(csv).toContain('"Reddie ""RW"" Wijaya"')
    expect(csv).not.toContain('phone')
  })

  it('writes a PDF a reader can open, with every visitor on it', () => {
    const bytes = pdfOf(rows, { title: 'Visitors — SSCX International · A1', sub: 'test' })
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Type /Catalog')
    expect(text).toContain('/Count 1')
    expect(text).toContain('(Sinta Dewi)')
    expect(text).toContain('(sinta@natcon.id)')
    expect(text).toContain('(Jakarta Elite)')
    // Parentheses in a name are escaped so they cannot close the string.
    const withParens = pdfOf([{ name: 'A (B)', email: 'x@y.id' }])
    expect(new TextDecoder('latin1').decode(withParens)).toContain('(A \\(B\\))')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    // An em dash in the title folds to a hyphen rather than printing as "?".
    expect(text).toContain('(Visitors - SSCX International \xb7 A1)')
  })

  it('paginates a long list', () => {
    const many = Array.from({ length: 90 }, (_, i) => ({ name: `Visitor ${i + 1}`, email: `v${i + 1}@x.id` }))
    const text = new TextDecoder('latin1').decode(pdfOf(many))
    expect(text).toContain('/Count 3')
    expect(text).toContain('(Page 3 of 3)')
    expect(text).toContain('(Visitor 90)')
  })

  it('keeps the xref offsets honest', () => {
    const text = new TextDecoder('latin1').decode(pdfOf(rows))
    const startxref = Number(text.match(/startxref\n(\d+)/)[1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    const firstObj = Number(text.match(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/)[1])
    expect(text.slice(firstObj, firstObj + 7)).toBe('1 0 obj')
  })
})
