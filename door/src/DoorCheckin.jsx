import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { api } from './api'

const CameraScanner = lazy(() => import('./CameraScanner'))

function fmtClock(d) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/*
 * The door crew's screen. One place, three jobs, because it is the same crew
 * with the same scanner at the same door (MoM 19 Aug 2026):
 *
 *   Attendance — scan into a learning class; anyone not registered for that
 *                room is rejected clearly.
 *   Goodiebag  — hand one over, once per attendee.
 *   Pin        — same, for the collectible pin.
 *
 * All three are scans rather than ticks: in a queue nobody reliably finds the
 * right row in a list of several hundred people.
 */
export default function DoorCheckin({ onUnauthorized }) {
  const [seminars, setSeminars] = useState([])
  const [seminarId, setSeminarId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [result, setResult] = useState(null) // {kind:'ok'|'dup'|'err', title, sub}
  const [recent, setRecent] = useState([])
  const [manual, setManual] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  // 'attendance' | 'goodiebag' | 'pin'
  const [mode, setMode] = useState('attendance')
  const [counts, setCounts] = useState(null)
  // Switching rooms clears the result panel, so a "switched room" message
  // has to survive that reset — park it here until the effect runs.
  const pendingResultRef = useRef(null)

  useEffect(() => {
    api
      .seminars({ onUnauthorized })
      .then((d) => {
        const list = d.seminars || []
        setSeminars(list)
        if (list.length > 0) setSeminarId(list[0].id)
      })
      .catch(() => {})
  }, [onUnauthorized])

  const loadDetail = (id) => {
    if (!id) return
    api.seminarDetail(id).then(setDetail).catch(() => setDetail(null))
  }

  useEffect(() => {
    setResult(pendingResultRef.current)
    pendingResultRef.current = null
    setRecent([])
    loadDetail(seminarId)
  }, [seminarId])

  // A scanned "SEMINAR:<id>" poster switches the room instead of being
  // treated as an attendee code — the door crew can point the camera at
  // the printed room sign to get on the right session.
  const handleScan = (raw) => {
    const room = String(raw).trim().toUpperCase().match(/^SEMINAR[:\s-]*(\d+)$/)
    if (room) {
      const id = Number(room[1])
      const target = seminars.find((x) => x.id === id)
      if (!target) {
        setResult({ kind: 'err', title: 'Unknown room', sub: 'That class QR is not in this event' })
        return
      }
      const notice = { kind: 'ok', title: `Switched to ${target.room}`, sub: target.title }
      if (id === seminarId) {
        setResult(notice) // already on this room — no effect will fire
      } else {
        pendingResultRef.current = notice
        setSeminarId(id)
      }
      return
    }
    if (mode === 'attendance') checkin(raw)
    else handOver(String(raw).trim())
  }

  const loadCounts = () => api.redeemCounts().then(setCounts).catch(() => {})

  useEffect(() => {
    if (mode !== 'attendance') loadCounts()
  }, [mode])

  // Handing over a pin or a goodiebag. The refusal matters as much as the
  // success: a second scan has to say who already collected it and when,
  // otherwise the crew cannot tell a queue-jumper from their own double tap.
  const handOver = async (code) => {
    try {
      const res = await api.redeem(code, mode)
      setResult({
        kind: 'ok',
        title: mode === 'pin' ? 'Pin handed over' : 'Goodiebag handed over',
        sub: `${res.name} · ${res.chapter || res.company || res.member_code}`,
      })
      setRecent((r) => [{ name: res.name, at: fmtClock(new Date()) }, ...r].slice(0, 6))
      loadCounts()
    } catch (err) {
      const at = err.body?.redeemed_at ? ` at ${err.body.redeemed_at.slice(11, 16)}` : ''
      setResult(
        err.status === 409
          ? {
              kind: 'dup',
              title: 'Already collected',
              sub: `${err.body?.name || 'This attendee'} took it${at}`,
            }
          : { kind: 'err', title: 'Rejected', sub: err.message },
      )
    }
  }

  const checkin = async (code) => {
    if (!seminarId || !code) return
    try {
      const res = await api.seminarCheckin(seminarId, code)
      if (res.duplicate) {
        setResult({ kind: 'dup', title: 'Already checked in', sub: `${res.member_name} is already recorded as present` })
      } else {
        setResult({
          kind: 'ok',
          title: 'Attendance recorded',
          sub: `${res.member_name} · ${res.member_chapter}`,
        })
        setRecent((r) => [{ name: res.member_name, at: fmtClock(new Date()) }, ...r].slice(0, 6))
      }
      loadDetail(seminarId)
    } catch (err) {
      setResult({ kind: 'err', title: 'Rejected', sub: err.message })
    }
  }

  const submitManual = (e) => {
    e.preventDefault()
    const code = manual.trim()
    if (code) {
      handleScan(code)
      setManual('')
    }
  }

  const selected = seminars.find((s) => s.id === seminarId)

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Door Check-in</h1>
          <p className="micro">
            One scanner for the door: class attendance, goodiebags and pins — each handed over once
            per attendee
          </p>
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>What are you scanning for?
        </h2>
        <p className="panel-sub">Switch before the queue starts — the scanner does what this says</p>
        <div className="door-modes">
          {[
            { key: 'attendance', label: 'Class attendance', hint: 'into a learning class' },
            { key: 'goodiebag', label: 'Goodiebag', hint: 'one per attendee' },
            { key: 'pin', label: 'Pin', hint: 'one per attendee' },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              className={`door-mode${mode === m.key ? ' on' : ''}`}
              onClick={() => {
                setMode(m.key)
                setResult(null)
                setRecent([])
              }}
            >
              <b>{m.label}</b>
              <small>{m.hint}</small>
            </button>
          ))}
        </div>
        {mode !== 'attendance' && counts && (
          <div className="door-stats">
            <div className="stat-card">
              <div className="num accent">{mode === 'pin' ? counts.pins : counts.goodiebags}</div>
              <div className="label">Handed over</div>
            </div>
            <div className="stat-card">
              <div className="num">{counts.members}</div>
              <div className="label">Attendees</div>
            </div>
            <div className="stat-card">
              <div className="num">
                {counts.members - (mode === 'pin' ? counts.pins : counts.goodiebags)}
              </div>
              <div className="label">Still to collect</div>
            </div>
          </div>
        )}
      </div>

      {mode === 'attendance' && (
      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Choose Learning Session
        </h2>
        <p className="panel-sub">Each door crew covers one room</p>
        <select
          className="door-select"
          value={seminarId ?? ''}
          onChange={(e) => setSeminarId(Number(e.target.value))}
        >
          {seminars.map((s) => (
            <option key={s.id} value={s.id}>
              {s.room} — {s.title}
            </option>
          ))}
        </select>
        {detail && (
          <div className="door-stats">
            <div className="stat-card">
              <div className="num accent">{detail.seminar.attended_count ?? 0}</div>
              <div className="label">Attended</div>
            </div>
            <div className="stat-card">
              <div className="num">{detail.seminar.seats_taken}</div>
              <div className="label">Registered</div>
            </div>
            <div className="stat-card">
              <div className="num">
                {detail.seminar.seats_taken > 0
                  ? Math.round(((detail.seminar.attended_count ?? 0) / detail.seminar.seats_taken) * 100)
                  : 0}
                %
              </div>
              <div className="label">Attendance</div>
            </div>
          </div>
        )}
      </div>
      )}

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">{mode === 'attendance' ? '03' : '02'}</span>Scan Attendees
        </h2>
        <p className="panel-sub">
          {mode === 'attendance'
            ? `${selected ? `${selected.room} door` : 'Loading…'} · camera or manual input — scanning a printed room QR switches the session`
            : `Handing over ${mode === 'pin' ? 'pins' : 'goodiebags'} · camera or manual input — a ticket number, member code, email or phone all work`}
        </p>

        {cameraOn ? (
          <Suspense fallback={<div className="empty">Starting camera…</div>}>
            <CameraScanner
              onScan={handleScan}
              onError={(msg) => {
                setCameraError(msg)
                setCameraOn(false)
              }}
            />
          </Suspense>
        ) : (
          <button className="md-secondary" onClick={() => setCameraOn(true)}>
            📷 Turn on Camera Scanner
          </button>
        )}
        {cameraError && <div className="error">Camera unavailable ({cameraError}) — use the manual input.</div>}

        <form className="door-manual" onSubmit={submitManual}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Manual input: ticket number, member code, email or phone"
          />
          <button type="submit" className="md-add">
            Check-in
          </button>
        </form>

        {result && (
          <div className={`door-result ${result.kind}`}>
            <b>{result.title}</b>
            <span>{result.sub}</span>
          </div>
        )}

        {recent.length > 0 && (
          <div className="door-recent">
            {recent.map((r, i) => (
              <div key={`${r.name}-${i}`} className="door-recent-row">
                <span>✓ {r.name}</span>
                <small>{r.at}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
