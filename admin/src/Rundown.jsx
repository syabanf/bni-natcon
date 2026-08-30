import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import Modal from './Modal'

/*
 * The event schedule, in one-hour blocks (MoM 19 Aug 2026).
 *
 * This is the only place the day's timing is written down. The attendee
 * agenda reads it, learning classes sit inside its blocks, and "two sessions
 * that do not clash" is answered by comparing them — so the committee edits
 * hours here rather than in three different screens.
 */

// Blocks are stored with a timezone, but the committee thinks in local
// Jakarta hours, so the form works in whole hours on a date they pick. The
// conference is one day, but not everything is on it: the Gold Club breakfast
// is the morning after, and a schedule that could only hold 3 September had
// nowhere to put it.
export const EVENT_DATE = '2026-09-03'
export const EVENT_TZ = '+07:00'
export const EVENT_DATES = ['2026-09-03', '2026-09-04']

export const KINDS = [
  { key: 'registration', label: 'Registration' },
  { key: 'plenary', label: 'Plenary' },
  { key: 'learning', label: 'Learning Session' },
  { key: 'networking', label: 'Networking' },
  { key: 'break', label: 'Break' },
  { key: 'doorprize', label: 'Doorprize' },
]

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00 – 23:00

export const hhmm = (iso) => (iso || '').slice(11, 16)
export const hourOf = (iso) => parseInt(hhmm(iso).slice(0, 2), 10)
export const dateOf = (iso) => (iso || '').slice(0, 10)

// The form speaks a date and whole hours; the API speaks timestamps.
export const toIso = (date, hour) =>
  `${date}T${String(hour).padStart(2, '0')}:00:00${EVENT_TZ}`

export function blockLength(block) {
  // Measured, not subtracted: a block can end on the next date.
  const hours = Math.round(
    (new Date(block.ends_at) - new Date(block.starts_at)) / 3_600_000,
  )
  return hours === 1 ? '1 hour' : `${hours} hours`
}

// Thursday 3 September — the committee reads dates, not ISO strings.
export function dayLabel(date) {
  const d = new Date(`${date}T00:00:00${EVENT_TZ}`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta',
  })
}

// One heading per date, in the order the days run.
export function groupByDay(rows) {
  const days = []
  for (const b of [...rows].sort((a, z) => a.starts_at.localeCompare(z.starts_at))) {
    const date = dateOf(b.starts_at)
    const last = days[days.length - 1]
    if (last && last.date === date) last.blocks.push(b)
    else days.push({ date, blocks: [b] })
  }
  return days
}

// Two blocks of the same kind at the same time is usually a typo, and it is
// the kind of typo that only shows up on the day.
export function overlapping(blocks) {
  const clashes = new Set()
  for (const a of blocks) {
    for (const b of blocks) {
      if (a.id === b.id) continue
      if (a.starts_at < b.ends_at && b.starts_at < a.ends_at) {
        clashes.add(a.id)
        clashes.add(b.id)
      }
    }
  }
  return clashes
}

const emptyForm = { date: EVENT_DATE, hour: 9, hours: 1, title: '', place: '', kind: 'plenary' }

export default function Rundown({ onUnauthorized }) {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .rundown({ onUnauthorized })
      .then((d) => setRows(d.rundown || []))
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clashes = useMemo(() => overlapping(rows || []), [rows])
  const days = useMemo(() => groupByDay(rows || []), [rows])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    // A block that runs past midnight lands on the next date, which the
    // Date arithmetic handles and string concatenation would not.
    const startsAt = new Date(toIso(form.date, form.hour))
    const endsAt = new Date(startsAt.getTime() + Number(form.hours) * 3_600_000)
    const body = {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      title: form.title,
      place: form.place,
      kind: form.kind,
    }
    try {
      if (form.id) await api.updateRundown(form.id, body)
      else await api.createRundown(body)
      setForm(null)
      setNotice(form.id ? 'Block updated.' : 'Block added.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (block) => {
    if (!confirm(`Remove “${block.title}” from the rundown?`)) return
    try {
      await api.deleteRundown(block.id)
      setNotice('Block removed. Classes that sat in it now have no time — give them a new block.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Rundown</h1>
          <p className="micro">
            The day in one-hour blocks — this is what attendees see as the agenda, and where
            learning classes get their time
          </p>
        </div>
        <div className="head-right">
          <span className="pill live">{rows?.length ?? 0} blocks</span>
          <button className="md-add" onClick={() => setForm({ ...emptyForm })}>
            + Add Block
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

      {rows === null && <div className="empty">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="empty">
          The day is empty. Add the first block — registration usually opens it.
        </div>
      )}

      {rows && rows.length > 0 && days.map((day) => (
        <div className="table-scroll" key={day.date}>
          {/* The conference is one day, but the Gold Club breakfast is the
              morning after — so the day is named rather than assumed. */}
          <div className="day-head">{dayLabel(day.date)}</div>
          <table className="md-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Length</th>
                <th>Kind</th>
                <th>What happens</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {day.blocks.map((b) => (
                <tr key={b.id} className={clashes.has(b.id) ? 'row-warn' : ''}>
                  <td className="mono">
                    {hhmm(b.starts_at)} – {hhmm(b.ends_at)}
                  </td>
                  <td>{blockLength(b)}</td>
                  <td>
                    <span className={`kind-pill kind-${b.kind}`}>
                      {KINDS.find((k) => k.key === b.kind)?.label || b.kind}
                    </span>
                  </td>
                  <td>
                    <b>{b.title}</b>
                    {b.place && <small>{b.place}</small>}
                    {clashes.has(b.id) && <small className="warn">overlaps another block</small>}
                  </td>
                  <td className="row-actions">
                    <button
                      className="md-secondary"
                      onClick={() =>
                        setForm({
                          id: b.id,
                          date: dateOf(b.starts_at),
                          hour: hourOf(b.starts_at),
                          hours: Math.round(
                            (new Date(b.ends_at) - new Date(b.starts_at)) / 3_600_000,
                          ),
                          title: b.title,
                          place: b.place,
                          kind: b.kind,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button className="md-danger" onClick={() => remove(b)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {form && (
        <Modal title={form.id ? 'Edit Block' : 'Add Block'} onClose={() => setForm(null)}>
          <form className="modal-form" onSubmit={submit}>
            <label className="md-field">
              <span>Day</span>
              <select
                className="door-select"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              >
                {EVENT_DATES.map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="md-field">
              <span>Starts at</span>
              <select
                className="door-select"
                value={form.hour}
                onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </label>
            <label className="md-field">
              <span>Length</span>
              <select
                className="door-select"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((h) => (
                  <option key={h} value={h}>
                    {h === 1 ? '1 hour' : `${h} hours`}
                  </option>
                ))}
              </select>
            </label>
            <label className="md-field">
              <span>Kind</span>
              <select
                className="door-select"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="md-field">
              <span>What happens</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Opening Ceremony"
                required
                autoFocus
              />
            </label>
            <label className="md-field">
              <span>
                Place<em> — shown under the title on the attendee agenda</em>
              </span>
              <input
                value={form.place}
                onChange={(e) => setForm({ ...form, place: e.target.value })}
                placeholder="Grand Ballroom"
              />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={busy} type="submit">
                {form.id ? 'Save Changes' : 'Add'}
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
