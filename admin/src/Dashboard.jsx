import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const POLL_MS = 5000

function timeAgo(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)} h ago`
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
          <p className="micro">Live monitoring · Pullman Central Park Jakarta</p>
        </div>
        <div className="head-right">
          <span className="pill live">LIVE</span>
          {updatedAt && <span className="updated">updated {updatedAt.toLocaleTimeString('en-GB')}</span>}
        </div>
      </div>

      <section className="stats-grid">
        <StatCard value={overview?.total_members} label="Registered attendees" />
        <StatCard value={overview?.total_sponsors} label="Sponsors" accent />
        <StatCard value={overview?.total_booths} label="Booths" />
        <StatCard value={overview?.total_visits} label="Total visit scans" accent />
        <StatCard value={overview?.visits_today} label="Scans today" accent />
        <StatCard value={overview?.seminar_registrations} label="Class registrations" />
      </section>

      <section className="columns">
        <div className="panel">
          <h2>
            <span className="sec-no">01</span>Booth Ranking
          </h2>
          <p className="panel-sub">Scans per tenant — best-booth candidates</p>
          <div className="rank-list">
            {tenants.map((t, i) => (
              <div className="rank-row" key={t.id}>
                <span className="rank-no">#{i + 1}</span>
                <span className="rank-ini">{t.initials}</span>
                <div className="rank-info">
                  <div className="rank-name">
                    {t.name} <small>· {t.booth}</small>
                    {t.kind === 'sponsor' && <span className="kind-pill sponsor">Sponsor</span>}
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
              <span className="sec-no">02</span>Learning Class Quota
            </h2>
            <p className="panel-sub">Parallel learning classes</p>
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
              <span className="sec-no">03</span>Latest Activity
            </h2>
            <p className="panel-sub">Visit scans across all booths</p>
            <div className="feed">
              {activity.map((a, i) => (
                <div className="feed-row" key={`${a.visited_at}-${i}`}>
                  <span className="feed-av">{initials(a.member_name)}</span>
                  <div className="feed-info">
                    <b>{a.member_name}</b>
                    <small>
                      at {a.tenant_name} · {a.booth}
                    </small>
                  </div>
                  <span className="feed-time">{timeAgo(a.visited_at)}</span>
                </div>
              ))}
              {activity.length === 0 && <div className="empty">No scan activity yet.</div>}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
