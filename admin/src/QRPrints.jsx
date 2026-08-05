import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from './api'

/*
 * QR print centre: print-ready cards for the physical event.
 *   Tables   — TABLE:<no>, scanned by attendees to join a table's network
 *   Seminars — SEMINAR:<id>, scanned on the Door Check-in page to switch room
 *   Tenants  — BOOTH:<code>, booth/sponsor signage
 * Only the selected cards are printed (see the @media print rules).
 */

export const tableQRValue = (t) => `TABLE:${t.table_no}`
export const seminarQRValue = (s) => `SEMINAR:${s.id}`
export const tenantQRValue = (t) => `BOOTH:${t.booth}`

const KINDS = [
  { key: 'tables', label: 'Networking Tables' },
  { key: 'seminars', label: 'Seminars' },
  { key: 'tenants', label: 'Tenants' },
]

const SIZES = { small: 132, medium: 190, large: 260 }

export default function QRPrints({ onUnauthorized }) {
  const [kind, setKind] = useState('tables')
  const [size, setSize] = useState('medium')
  const [data, setData] = useState({ tables: null, seminars: null, tenants: null })
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    const opts = { onUnauthorized }
    api.tables(opts).then((d) => setData((s) => ({ ...s, tables: d.tables || [] }))).catch((e) => setError(e.message))
    api.seminars(opts).then((d) => setData((s) => ({ ...s, seminars: d.seminars || [] }))).catch(() => {})
    api.tenants(opts).then((d) => setData((s) => ({ ...s, tenants: d.tenants || [] }))).catch(() => {})
  }, [onUnauthorized])

  // Every card is selected by default — the common case is "print them all".
  const cards = useMemo(() => {
    const rows = data[kind]
    if (!rows) return null
    if (kind === 'tables') {
      return rows.map((t) => ({
        key: `table-${t.id}`,
        value: tableQRValue(t),
        eyebrow: t.hall,
        title: `Table ${t.table_no}`,
        sub: `${t.capacity} seats · scan to join this table`,
      }))
    }
    if (kind === 'seminars') {
      return rows.map((s) => ({
        key: `seminar-${s.id}`,
        value: seminarQRValue(s),
        eyebrow: `Session ${s.slot} · 13:00 – 14:30`,
        title: s.room,
        sub: s.title,
      }))
    }
    return rows.map((t) => ({
      key: `tenant-${t.id}`,
      value: tenantQRValue(t),
      eyebrow: t.kind === 'sponsor' ? '★ Sponsor' : 'Booth',
      title: t.booth,
      sub: t.name,
    }))
  }, [data, kind])

  const isOn = (key) => selected[key] !== false
  const chosen = (cards || []).filter((c) => isOn(c.key))

  const setAll = (on) => {
    const next = { ...selected }
    for (const c of cards || []) next[c.key] = on
    setSelected(next)
  }

  return (
    <>
      <div className="content-head no-print">
        <div>
          <h1>QR Prints</h1>
          <p className="micro">
            Print-ready QR cards — tables (scanned by attendees), seminar rooms (scanned on Door
            Check-in), and booth signage
          </p>
        </div>
        <div className="head-right">
          <span className="pill live">{chosen.length} selected</span>
          <button className="md-add" onClick={() => window.print()} disabled={chosen.length === 0}>
            ⎙ Print
          </button>
        </div>
      </div>

      {error && (
        <div className="error no-print" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <div className="panel report-panel no-print">
        <div className="qr-toolbar">
          <div className="qr-tabs">
            {KINDS.map((k) => (
              <button
                key={k.key}
                className={kind === k.key ? 'active' : ''}
                onClick={() => setKind(k.key)}
              >
                {k.label}
                {data[k.key] ? ` (${data[k.key].length})` : ''}
              </button>
            ))}
          </div>
          <div className="qr-toolbar-right">
            <label className="qr-size">
              Size
              <select className="door-select" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="small">Small — 4 per row</option>
                <option value="medium">Medium — 3 per row</option>
                <option value="large">Large — 2 per row</option>
              </select>
            </label>
            <button className="md-secondary" onClick={() => setAll(true)}>
              Select all
            </button>
            <button className="md-secondary" onClick={() => setAll(false)}>
              Clear
            </button>
          </div>
        </div>
        <p className="import-hint" style={{ marginBottom: 0 }}>
          Tap a card to include or exclude it, then hit <b>Print</b> — only the selected cards go on
          paper (cut along the card edges). Table QRs are what attendees scan at Speed Networking.
        </p>
      </div>

      {cards === null && <div className="empty no-print">Loading…</div>}
      {cards && cards.length === 0 && (
        <div className="empty no-print">Nothing to print here yet — add the data first.</div>
      )}

      <div className={`qr-sheet size-${size}`}>
        {(cards || []).map((c) => (
          <button
            key={c.key}
            type="button"
            className={`qr-card${isOn(c.key) ? '' : ' off'}`}
            onClick={() => setSelected((s) => ({ ...s, [c.key]: !isOn(c.key) }))}
          >
            <span className="qrc-eyebrow">{c.eyebrow}</span>
            <span className="qrc-title">{c.title}</span>
            <QRCodeSVG value={c.value} size={SIZES[size]} />
            <span className="qrc-sub">{c.sub}</span>
            <span className="qrc-code">{c.value}</span>
          </button>
        ))}
      </div>
    </>
  )
}
