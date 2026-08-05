import { useEffect, useState } from 'react'
import { api } from './api'
import Modal from './Modal'

// Networking tables master data: generate a block of tables before the
// event, then fine-tune hall/capacity per table. Occupancy is live, so a
// table that still has someone seated cannot be deleted.
export default function Tables({ onUnauthorized }) {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(null) // null | { id, table_no, hall, capacity }
  const [gen, setGen] = useState({ count: 12, hall: 'Hall B', capacity: 8 })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .tables({ onUnauthorized })
      .then((d) => setRows(d.tables || []))
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      await api.updateTable(form.id, { hall: form.hall, capacity: Number(form.capacity) })
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
          <span className="sec-no">01</span>Generate Tables
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
              placeholder="Hall B"
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

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>All Tables
        </h2>
        <p className="panel-sub">Occupancy is live — a seated table cannot be deleted</p>
        <div className="table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th>Table</th>
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
                  <td>{t.hall}</td>
                  <td className="num">{t.occupied}</td>
                  <td className="num">{t.capacity}</td>
                  <td className="md-actions">
                    <button
                      onClick={() =>
                        setForm({ id: t.id, table_no: t.table_no, hall: t.hall, capacity: t.capacity })
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
                  <td colSpan={5} className="empty">
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
              <span>Hall</span>
              <input value={form.hall} onChange={(e) => setForm({ ...form, hall: e.target.value })} autoFocus />
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
