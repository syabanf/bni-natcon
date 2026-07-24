import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const POLL_MS = 5000

function timeAgo(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'baru saja'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} mnt lalu`
  return `${Math.floor(mins / 60)} jam lalu`
}

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function StatCard({ value, label, accent }) {
  return (
    <div className="stat-card">
      <div className={`num${accent ? ' accent' : ''}`}>{value ?? '–'}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export default function Dashboard({ onUnauthorized }) {
  const [overview, setOverview] = useState(null)
  const [tenants, setTenants] = useState([])
  const [seminars, setSeminars] = useState([])
  const [activity, setActivity] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(() => {
    const opts = { onUnauthorized }
    api.overview(opts).then(setOverview).catch(() => {})
    api.tenants(opts).then((d) => setTenants(d.tenants || [])).catch(() => {})
    api.seminars(opts).then((d) => setSeminars(d.seminars || [])).catch(() => {})
    api.activity(15, opts).then((d) => setActivity(d.activity || [])).catch(() => {})
    setUpdatedAt(new Date())
  }, [onUnauthorized])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const maxScan = Math.max(1, ...tenants.map((t) => t.scan_count))

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Dashboard</h1>
          <p className="micro">Monitoring langsung · Jakarta Convention Center</p>
        </div>
        <div className="head-right">
          <span className="pill live">LIVE</span>
          {updatedAt && <span className="updated">diperbarui {updatedAt.toLocaleTimeString('id-ID')}</span>}
        </div>
      </div>

      <section className="stats-grid">
        <StatCard value={overview?.total_members} label="Peserta terdaftar" />
        <StatCard value={overview?.total_tenants} label="Tenant / booth" />
        <StatCard value={overview?.total_visits} label="Total scan kunjungan" accent />
        <StatCard value={overview?.visits_today} label="Scan hari ini" accent />
        <StatCard value={overview?.members_with_visit} label="Peserta aktif (≥1 scan)" />
        <StatCard value={overview?.seminar_registrations} label="Registrasi seminar" />
      </section>

      <section className="columns">
        <div className="panel">
          <h2>
            <span className="sec-no">01</span>Peringkat Booth
          </h2>
          <p className="panel-sub">Jumlah scan per tenant — kandidat booth terbaik</p>
          <div className="rank-list">
            {tenants.map((t, i) => (
              <div className="rank-row" key={t.id}>
                <span className="rank-no">#{i + 1}</span>
                <span className="rank-ini">{t.initials}</span>
                <div className="rank-info">
                  <div className="rank-name">
                    {t.name} <small>· {t.booth}</small>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(t.scan_count / maxScan) * 100}%` }} />
                  </div>
                </div>
                <span className="rank-count">{t.scan_count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-right">
          <div className="panel">
            <h2>
              <span className="sec-no">02</span>Kapasitas Seminar
            </h2>
            <p className="panel-sub">Sesi paralel</p>
            {seminars.map((s) => {
              const pct = Math.round((s.seats_taken / s.capacity) * 100)
              return (
                <div className="seminar-row" key={s.id}>
                  <div className="seminar-top">
                    <b>{s.room}</b>
                    <span>
                      {s.seats_taken}/{s.capacity} · {pct}%
                    </span>
                  </div>
                  <div className="seminar-title">{s.title}</div>
                  <div className="bar-track">
                    <div className={`bar-fill${pct >= 80 ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="panel">
            <h2>
              <span className="sec-no">03</span>Aktivitas Terbaru
            </h2>
            <p className="panel-sub">Scan kunjungan lintas semua booth</p>
            <div className="feed">
              {activity.map((a, i) => (
                <div className="feed-row" key={`${a.visited_at}-${i}`}>
                  <span className="feed-av">{initials(a.member_name)}</span>
                  <div className="feed-info">
                    <b>{a.member_name}</b>
                    <small>
                      di {a.tenant_name} · {a.booth}
                    </small>
                  </div>
                  <span className="feed-time">{timeAgo(a.visited_at)}</span>
                </div>
              ))}
              {activity.length === 0 && <div className="empty">Belum ada aktivitas scan.</div>}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
