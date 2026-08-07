import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// Prefer the structured speaker rows; fall back to the plain-text columns
// for classes that were typed in before speakers became first-class.
function speakerNames(seminar, role) {
  return (seminar.speakers || [])
    .filter((p) => p.role === role)
    .map((p) => p.name)
    .join('; ')
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function DetailShell({ title, sub, onBack, children }) {
  return (
    <>
      <button className="back-btn" onClick={onBack}>
        ← Back to list
      </button>
      <div className="content-head">
        <div>
          <h1>{title}</h1>
          <p className="micro">{sub}</p>
        </div>
      </div>
      {children}
    </>
  )
}

function InfoGrid({ items }) {
  return (
    <div className="info-grid">
      {items.map(([label, value]) => (
        <div className="info-item" key={label}>
          <small>{label}</small>
          <b>{value || '—'}</b>
        </div>
      ))}
    </div>
  )
}

function SimpleTable({ columns, rows, emptyText }) {
  return (
    <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ===== Detail Peserta ===== */

export function MemberDetail({ id, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.memberDetail(id).then(setData).catch((e) => setError(e.message))
  }, [id])

  if (error) return <DetailShell title="Attendee Detail" sub="" onBack={onBack}><div className="error">{error}</div></DetailShell>
  if (!data) return <DetailShell title="Attendee Detail" sub="Loading…" onBack={onBack} />

  const { user, visits, registrations } = data
  return (
    <DetailShell title={user.name} sub={`Attendee detail · ${user.member_code}`} onBack={onBack}>
      <div className="detail-hero">
        <div className="dh-avatar">{initials(user.name)}</div>
        <InfoGrid
          items={[
            ['Member Code', user.member_code],
            ['Email', user.email],
            ['Chapter', user.chapter],
            ['Company', user.company],
          ]}
        />
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="num accent">{visits.length}</div>
          <div className="label">Pins collected</div>
        </div>
        <div className="stat-card">
          <div className="num">{visits.length}</div>
          <div className="label">Booths visited</div>
        </div>
        <div className="stat-card">
          <div className="num">{registrations.length}</div>
          <div className="label">Classes joined</div>
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>Booth Visit History
        </h2>
        <p className="panel-sub">Every scan = 1 pin</p>
        <SimpleTable
          columns={['Tenant', 'Booth', 'Waktu Scan']}
          rows={visits.map((v) => [<b key="t">{v.tenant_name}</b>, v.booth, fmtTime(v.visited_at)])}
          emptyText="No booth visits yet."
        />
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Registered Breakout Classes
        </h2>
        <p className="panel-sub">One class per parallel slot</p>
        <SimpleTable
          columns={['Slot', 'Room', 'Title', 'Registered At']}
          rows={registrations.map((r) => [`#${r.slot}`, <b key="r">{r.room}</b>, r.title, fmtTime(r.registered_at)])}
          emptyText="No class registrations yet."
        />
      </div>
    </DetailShell>
  )
}

/* ===== Detail Tenant ===== */

export function TenantDetail({ id, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.tenantDetail(id).then(setData).catch((e) => setError(e.message))
  }, [id])

  if (error) return <DetailShell title="Tenant Detail" sub="" onBack={onBack}><div className="error">{error}</div></DetailShell>
  if (!data) return <DetailShell title="Tenant Detail" sub="Loading…" onBack={onBack} />

  const { tenant, total_scans, scans_today, visitors } = data
  return (
    <DetailShell
      title={tenant.name}
      sub={`${tenant.kind === 'sponsor' ? 'Official sponsor' : 'Booth tenant'} · ${tenant.booth}`}
      onBack={onBack}
    >
      <div className="detail-hero">
        <div className={`dh-avatar${tenant.kind === 'sponsor' ? '' : ' tenant'}`}>{tenant.initials}</div>
        <InfoGrid
          items={[
            ['Kind', tenant.kind === 'sponsor' ? 'Official sponsor' : 'Booth tenant'],
            ['Booth', tenant.booth],
            ['Category', tenant.category],
            ['Booth contact', tenant.contact_name || '—'],
            ['BNI Chapter', tenant.chapter || '—'],
            ['Scanner login', tenant.owner_email],
          ]}
        />
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="num accent">{total_scans}</div>
          <div className="label">Total scan</div>
        </div>
        <div className="stat-card">
          <div className="num">{scans_today}</div>
          <div className="label">Scan hari ini</div>
        </div>
        <div className="stat-card">
          <div className="num">{visitors.length}</div>
          <div className="label">Pengunjung unik</div>
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>Daftar Pengunjung (Leads)
        </h2>
        <p className="panel-sub">Terbaru di atas · bahan follow-up tenant</p>
        <SimpleTable
          columns={['Attendee', 'Chapter', 'Company', 'Time']}
          rows={visitors.map((v) => [<b key="n">{v.name}</b>, v.chapter, v.company, fmtTime(v.visited_at)])}
          emptyText="No visitors yet."
        />
      </div>
    </DetailShell>
  )
}

/* ===== Breakout class detail ===== */

// The committee registers walk-ups and phone-ins straight into a class.
// Accepts a member code, email, or phone number — whatever they have to hand.
function RegisterAttendee({ seminarId, onDone }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await api.registerSeminarMember(seminarId, value.trim())
      setMsg({
        ok: true,
        text: res.duplicate
          ? `${res.member_name} was already registered for this class.`
          : `${res.member_name} registered.`,
      })
      setValue('')
      onDone()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="register-row" onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Member code, email, or phone"
        aria-label="Attendee to register"
      />
      <button className="md-add" type="submit" disabled={busy}>
        {busy ? 'Registering…' : '+ Register'}
      </button>
      {msg && <div className={msg.ok ? 'notice' : 'error'}>{msg.text}</div>}
    </form>
  )
}

export function SeminarDetail({ id, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.seminarDetail(id).then(setData).catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const unregister = async (a) => {
    if (!window.confirm(`Remove ${a.name} from this class?`)) return
    try {
      await api.unregisterSeminarMember(id, a.member_code)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <DetailShell title="Breakout Class" sub="" onBack={onBack}><div className="error">{error}</div></DetailShell>
  if (!data) return <DetailShell title="Breakout Class" sub="Loading…" onBack={onBack} />

  const { seminar, attendees } = data
  const pct = Math.round((seminar.seats_taken / seminar.capacity) * 100)
  return (
    <DetailShell title={seminar.title} sub={`Breakout class · ${seminar.room} · Slot #${seminar.slot}`} onBack={onBack}>
      <div className="detail-hero">
        <div className="dh-avatar tenant">{seminar.room.replace('R. ', '').slice(0, 2).toUpperCase()}</div>
        <InfoGrid
          items={[
            ['Room', seminar.room],
            ['Speaker(s)', speakerNames(seminar, 'speaker') || seminar.speaker],
            ['Moderator', speakerNames(seminar, 'moderator') || seminar.moderator || '—'],
            ['Parallel slot', `#${seminar.slot}`],
            ['Capacity', `${seminar.capacity} seats`],
          ]}
        />
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>Seat Fill
        </h2>
        <p className="panel-sub">
          {seminar.seats_taken}/{seminar.capacity} seats · {pct}% · attended {seminar.attended_count ?? 0}
        </p>
        <div className="bar-track" style={{ height: 12 }}>
          <div className={`bar-fill${pct >= 80 ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Registered Attendees
        </h2>
        <p className="panel-sub">Attendance sheet for the door crew</p>
        <RegisterAttendee seminarId={id} onDone={load} />
        <SimpleTable
          columns={['Attendee', 'Member Code', 'Chapter', 'Attended', 'Registered At', '']}
          rows={attendees.map((a) => [
            <b key="n">{a.name}</b>,
            a.member_code,
            a.chapter,
            a.checked_in ? (
              <span key="h" className="pill-hadir yes">Yes {a.checked_in_at ? `· ${fmtTime(a.checked_in_at)}` : ''}</span>
            ) : (
              <span key="h" className="pill-hadir">Not yet</span>
            ),
            fmtTime(a.registered_at),
            <button key="x" className="row-remove" onClick={() => unregister(a)}>
              Remove
            </button>,
          ])}
          emptyText="No registered attendees yet."
        />
      </div>
    </DetailShell>
  )
}
