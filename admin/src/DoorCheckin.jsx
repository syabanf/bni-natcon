import { Suspense, lazy, useEffect, useState } from 'react'
import { api } from './api'

const CameraScanner = lazy(() => import('./CameraScanner'))

function fmtClock(d) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/*
 * Mode panitia pintu: pilih seminar, scan QR peserta (kamera atau input
 * manual) — hadir tercatat sekali per peserta, dan yang belum terdaftar
 * di seminar tsb ditolak dengan jelas.
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
    setResult(null)
    setRecent([])
    loadDetail(seminarId)
  }, [seminarId])

  const checkin = async (code) => {
    if (!seminarId || !code) return
    try {
      const res = await api.seminarCheckin(seminarId, code)
      if (res.duplicate) {
        setResult({ kind: 'dup', title: 'Sudah check-in', sub: `${res.member_name} sudah tercatat hadir` })
      } else {
        setResult({
          kind: 'ok',
          title: 'Hadir tercatat',
          sub: `${res.member_name} · ${res.member_chapter}`,
        })
        setRecent((r) => [{ name: res.member_name, at: fmtClock(new Date()) }, ...r].slice(0, 6))
      }
      loadDetail(seminarId)
    } catch (err) {
      setResult({ kind: 'err', title: 'Ditolak', sub: err.message })
    }
  }

  const submitManual = (e) => {
    e.preventDefault()
    const code = manual.trim()
    if (code) {
      checkin(code)
      setManual('')
    }
  }

  const selected = seminars.find((s) => s.id === seminarId)

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Check-in Pintu</h1>
          <p className="micro">Scan QR peserta di pintu ruang seminar — hadir vs terdaftar tercatat live</p>
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>Pilih Seminar
        </h2>
        <p className="panel-sub">Panitia pintu bertugas untuk satu ruang</p>
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
              <div className="label">Hadir</div>
            </div>
            <div className="stat-card">
              <div className="num">{detail.seminar.seats_taken}</div>
              <div className="label">Terdaftar</div>
            </div>
            <div className="stat-card">
              <div className="num">
                {detail.seminar.seats_taken > 0
                  ? Math.round(((detail.seminar.attended_count ?? 0) / detail.seminar.seats_taken) * 100)
                  : 0}
                %
              </div>
              <div className="label">Kehadiran</div>
            </div>
          </div>
        )}
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Scan Peserta
        </h2>
        <p className="panel-sub">
          {selected ? `Pintu ${selected.room}` : 'Memuat…'} · kamera atau input manual
        </p>

        {cameraOn ? (
          <Suspense fallback={<div className="empty">Menyiapkan kamera…</div>}>
            <CameraScanner
              onScan={checkin}
              onError={(msg) => {
                setCameraError(msg)
                setCameraOn(false)
              }}
            />
          </Suspense>
        ) : (
          <button className="md-secondary" onClick={() => setCameraOn(true)}>
            📷 Nyalakan Kamera Scanner
          </button>
        )}
        {cameraError && <div className="error">Kamera tidak tersedia ({cameraError}) — gunakan input manual.</div>}

        <form className="door-manual" onSubmit={submitManual}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Input manual: NATCON-2026-XXXXX"
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
