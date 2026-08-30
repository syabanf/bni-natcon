import { useEffect, useState } from 'react'
import { api } from './api'
import { exportSheet } from './excel'
import Modal from './Modal'

// Networking tables master data: generate a block of tables before the
// event, then fine-tune hall/capacity per table. Occupancy is live, so a
// table that still has someone seated cannot be deleted.
export default function Tables({ onUnauthorized }) {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(null) // null | { id, table_no, hall, capacity }
  const [gen, setGen] = useState({ count: 12, hall: '', capacity: 10 })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [seatRows, setSeatRows] = useState([])
  const [showSeats, setShowSeats] = useState(false)
  const [session, setSession] = useState(null)
  const [minutes, setMinutes] = useState(15)

  const load = () =>
    api
      .tables({ onUnauthorized })
      .then((d) => setRows(d.tables || []))
      .catch((e) => setError(e.message))

  // Occupancy lives on the table rows, so refreshing the seating without
  // refreshing those leaves the header saying "0 seated" above a list of
  // people. Same click, both numbers.
  const loadSeats = () =>
    Promise.all([
      api.tableSeats({ onUnauthorized }).then((d) => setSeatRows(d.seats || [])),
      load(),
    ]).catch(() => {})

  const loadSession = () =>
    api
      .networkingSession({ onUnauthorized })
      .then(setSession)
      .catch(() => {})

  useEffect(() => {
    load()
    loadSession()
    // The committee watches this screen while the round runs, so it has to
    // agree with the attendees' phones without anyone pressing refresh.
    const t = setInterval(loadSession, 10000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRound = async () => {
    setBusy(true)
    setError('')
    try {
      const s = await api.startNetworkingSession(Number(minutes))
      setSession(s)
      setNotice(`Round ${s.round} started — ${minutes} minutes.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const stopRound = async () => {
    setBusy(true)
    try {
      setSession(await api.stopNetworkingSession())
      setNotice('Round stopped.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const generate = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.generateTables({
        count: Number(gen.count),
        hall: gen.hall,
        capacity: Number(gen.capacity),
      })
      const first = res.tables?.[0]?.table_no
      const last = res.tables?.[res.tables.length - 1]?.table_no
      setNotice(
        `${res.created} tables generated${first ? ` — table ${first} to ${last}, ${gen.capacity} seats each` : ''}. Print their QR codes from the QR Prints page.`
      )
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.updateTable(form.id, {
        name: form.name,
        hall: form.hall,
        capacity: Number(form.capacity),
      })
      setNotice(`Table ${form.table_no} updated.`)
      setForm(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const del = async (t) => {
    if (!window.confirm(`Delete table ${t.table_no}?`)) return
    setError('')
    try {
      await api.deleteTable(t.id)
      setNotice(`Table ${t.table_no} deleted.`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const seats = (rows || []).reduce((sum, t) => sum + t.capacity, 0)
  const seated = (rows || []).reduce((sum, t) => sum + t.occupied, 0)

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Speed Networking — Tables</h1>
          <p className="micro">
            Generate the tables for the hall, then print their QR codes — attendees scan the QR on
            their table to join its network
          </p>
        </div>
        <div className="head-right">
          <span className="pill live">
            {rows ? `${rows.length} tables · ${seats} seats · ${seated} seated` : 'Loading…'}
          </span>
          <button
            className="md-secondary"
            onClick={() => {
              const next = !showSeats
              setShowSeats(next)
              if (next) loadSeats()
            }}
          >
            {showSeats ? 'Hide who is seated' : '◍ Who is seated'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error" onClick={() => setError('')}>
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" onClick={() => setNotice('')}>
          {notice}
        </div>
      )}

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>The Round
        </h2>
        <p className="panel-sub">
          Attendees count down to the moment this sets — not to a timer in their own browser, which
          used to restart every time they refreshed
        </p>
        <div className="round-control">
          <div className={`round-state${session?.running ? ' live' : ''}`}>
            {session?.running ? (
              <>
                <b>Round {session.round} is running</b>
                <small>ends at {session.ends_at?.slice(11, 16)}</small>
              </>
            ) : (
              <>
                <b>{session?.round ? `Round ${session.round} has ended` : 'No round yet'}</b>
                <small>
                  {session?.round
                    ? 'Everyone sees a stopped clock until the next one starts'
                    : 'Attendees see “waiting to start”'}
                </small>
              </>
            )}
          </div>
          <label className="md-field round-minutes">
            <span>Minutes</span>
            <input
              type="number"
              min="1"
              max="180"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <button className="md-add" onClick={startRound} disabled={busy}>
            {session?.running ? '↻ Start next round' : '▶ Start round'}
          </button>
          {session?.running && (
            <button className="md-secondary" onClick={stopRound} disabled={busy}>
              ■ Stop
            </button>
          )}
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Generate Tables
        </h2>
        <p className="panel-sub">
          Numbering continues after the highest existing table, so you can add more rounds later
        </p>
        <form className="table-gen" onSubmit={generate}>
          <label className="md-field">
            <span>How many</span>
            <input
              type="number"
              min="1"
              max="500"
              value={gen.count}
              onChange={(e) => setGen({ ...gen, count: e.target.value })}
              required
            />
          </label>
          <label className="md-field">
            <span>Hall</span>
            <input
              value={gen.hall}
              onChange={(e) => setGen({ ...gen, hall: e.target.value })}
              placeholder="optional — e.g. Hall B"
            />
          </label>
          <label className="md-field">
            <span>Seats per table</span>
            <input
              type="number"
              min="1"
              value={gen.capacity}
              onChange={(e) => setGen({ ...gen, capacity: e.target.value })}
              required
            />
          </label>
          <button className="md-add" disabled={busy} type="submit">
            {busy ? 'Generating…' : '✦ Generate'}
          </button>
        </form>
      </div>

      {showSeats && (
        <div className="panel report-panel">
          <h2>
            <span className="sec-no">03</span>Who is seated right now
          </h2>
          <p className="panel-sub">
            The seating only exists in the attendees' phones otherwise — this is the committee's
            copy, and the one to export before the room is cleared
          </p>
          <div className="head-right" style={{ marginBottom: 10 }}>
            <span className="pill live">{seatRows.length} seated</span>
            <button className="md-secondary" onClick={loadSeats}>
              ⟳ Refresh
            </button>
            <button
              className="md-secondary"
              disabled={seatRows.length === 0}
              onClick={() =>
                exportSheet(
                  seatRows.map((x) => ({
                    Table: x.table_no,
                    'Table Name': x.table_name,
                    Seat: x.seat_no,
                    'Member Code': x.member_code,
                    Name: x.name,
                    Chapter: x.chapter,
                    Company: x.company,
                    Classification: x.classification,
                    Phone: x.phone,
                    'Joined At': x.joined_at,
                  })),
                  'Seating',
                  'natcon2026-networking-seating.xlsx',
                )
              }
            >
              ↓ Export Excel
            </button>
          </div>
          {seatRows.length === 0 ? (
            <div className="empty">Nobody has scanned a table yet.</div>
          ) : (
            <div className="seat-groups">
              {Object.entries(
                seatRows.reduce((acc, x) => {
                  const key = `${x.table_no}`
                  ;(acc[key] = acc[key] || []).push(x)
                  return acc
                }, {}),
              ).map(([tableNo, people]) => (
                <div className="seat-group" key={tableNo}>
                  <h4>
                    Table {tableNo}
                    {people[0].table_name ? ` · ${people[0].table_name}` : ''}
                    <span className="pill live">{people.length}</span>
                  </h4>
                  <ol className="seat-list">
                    {people.map((x) => (
                      <li key={x.member_id}>
                        <b>{x.name}</b>
                        <small>
                          {x.chapter}
                          {x.company ? ` · ${x.company}` : ''}
                          {x.classification ? ` · ${x.classification}` : ''}
                        </small>
                        <span className="seat-when">{x.joined_at.slice(11, 16)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">{showSeats ? '04' : '03'}</span>All Tables
        </h2>
        <p className="panel-sub">Occupancy is live — a seated table cannot be deleted</p>
        <div className="table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Name</th>
                <th>Hall</th>
                <th className="num">Seated</th>
                <th className="num">Capacity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((t) => (
                <tr key={t.id}>
                  <td className="mono">#{t.table_no}</td>
                  <td>{t.name || <span className="muted">— unnamed</span>}</td>
                  <td>{t.hall}</td>
                  <td className="num">{t.occupied}</td>
                  <td className="num">{t.capacity}</td>
                  <td className="md-actions">
                    <button
                      onClick={() =>
                        setForm({
                          id: t.id, table_no: t.table_no, name: t.name || '',
                          hall: t.hall, capacity: t.capacity,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button className="danger" onClick={() => del(t)} disabled={t.occupied > 0}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No tables yet — generate a block above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={`Edit Table ${form.table_no}`} onClose={() => setForm(null)}>
          <form className="modal-form" onSubmit={submit}>
            <label className="md-field">
              <span>
                Name<em> — optional; "Table 7" alone is a fine name</em>
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Startup Corner"
                autoFocus
              />
            </label>
            <label className="md-field">
              <span>Hall</span>
              <input value={form.hall} onChange={(e) => setForm({ ...form, hall: e.target.value })} />
            </label>
            <label className="md-field">
              <span>
                Capacity<em> — cannot go below the seats already taken</em>
              </span>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                required
              />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={busy} type="submit">
                Save Changes
              </button>
              <button type="button" className="md-cancel" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
