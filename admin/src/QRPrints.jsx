import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from './api'

/*
 * QR print centre: print-ready cards for the physical event.
 *   Tables   — TABLE:<no>, scanned by attendees to join a table's network
 *   Classes  — SEMINAR:<id>, scanned on the Door Check-in page to switch room
 *   Tenants  — BOOTH:<code>, booth/sponsor signage
 *   Doors    — the sign-in URLs themselves, for registration desk & booth kits
 * Only the selected cards are printed (see the @media print rules).
 */

export const tableQRValue = (t) => `TABLE:${t.table_no}`
export const seminarQRValue = (s) => `SEMINAR:${s.id}`
export const tenantQRValue = (t) => `BOOTH:${t.booth}`

// Where the attendee/booth app is published. The QR is useless if this is
// wrong, so the card prints the address underneath it — a mistake is visible
// before the paper is cut, not after.
export const PUBLIC_APP_URL = (import.meta.env?.VITE_PUBLIC_APP_URL || 'https://bninatcon.com')
  .replace(/\/+$/, '')

export const doorQRValue = (path) => `${PUBLIC_APP_URL}${path}`

export const DOORS = [
  {
    key: 'door-attendee',
    path: '/login',
    eyebrow: 'Attendee',
    title: 'Sign in',
    sub: 'Scan to open your digital pass. First sign-in asks you to choose your own password.',
  },
  {
    key: 'door-tenant',
    path: '/tenant/login',
    eyebrow: 'Booth & Sponsor',
    title: 'Booth Scanner',
    sub: 'Scan to open the booth sign-in. Password comes from the committee.',
  },
]

const KINDS = [
  { key: 'tables', label: 'Networking Tables' },
  { key: 'seminars', label: 'Breakout Classes' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'doors', label: 'Sign-in Doors' },
]

const SIZES = { small: 132, medium: 190, large: 260 }

export default function QRPrints({ onUnauthorized }) {
  const [kind, setKind] = useState('tables')
  const [size, setSize] = useState('medium')
  // Door cards need no server round-trip — they are the published URLs.
  const [data, setData] = useState({ tables: null, seminars: null, tenants: null, doors: DOORS })
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
    if (kind === 'doors') {
      return rows.map((d) => ({
        key: d.key,
        value: doorQRValue(d.path),
        eyebrow: d.eyebrow,
        title: d.title,
        sub: d.sub,
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
            Print-ready QR cards — tables (scanned by attendees), class rooms (scanned on Door
            Check-in), booth signage, and the two sign-in doors
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
          paper (cut along the card edges). Table QRs are what attendees scan at Speed Networking;
          the <b>Sign-in Doors</b> cards open <code>{PUBLIC_APP_URL}</code> — put the attendee one
          on the registration desk and the booth one in the booth kit.
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
            {/* The spec's 4-module quiet zone, drawn inside the SVG — a card
                trimmed tight to the ink is the classic reason a printed QR
                will not scan. */}
            <QRCodeSVG value={c.value} size={SIZES[size]} marginSize={4} level="H" />
            <span className="qrc-sub">{c.sub}</span>
            <span className="qrc-code">{c.value}</span>
          </button>
        ))}
      </div>
    </>
  )
}
