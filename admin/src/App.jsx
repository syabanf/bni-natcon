import { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken, clearToken } from './api'
import MasterData from './MasterData'

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

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@natcon.id')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token, user } = await api.login(email, password)
      if (user.role !== 'admin') {
        setError('Akun ini bukan akun panitia/admin')
        return
      }
      setToken(token)
      onLogin(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">BNI</div>
        <h1>Natcon 2026 · Admin</h1>
        <p>Dashboard panitia — monitoring booth, seminar &amp; door prize</p>
        {error && <div className="error">{error}</div>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoFocus
          />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
        <div className="hint">
          Demo: <code>admin@natcon.id</code> · password <code>natcon2026</code>
        </div>
      </form>
    </div>
  )
}

function StatCard({ value, label, accent }) {
  return (
    <div className="stat-card">
      <div className={`num${accent ? ' accent' : ''}`}>{value ?? '–'}</div>
      <div className="label">{label}</div>
    </div>
  )
}

function Dashboard({ onLogout }) {
  const [view, setView] = useState('dash')
  const [overview, setOverview] = useState(null)
  const [tenants, setTenants] = useState([])
  const [seminars, setSeminars] = useState([])
  const [activity, setActivity] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(() => {
    const opts = { onUnauthorized: onLogout }
    api.overview(opts).then(setOverview).catch(() => {})
    api.tenants(opts).then((d) => setTenants(d.tenants || [])).catch(() => {})
    api.seminars(opts).then((d) => setSeminars(d.seminars || [])).catch(() => {})
    api.activity(15, opts).then((d) => setActivity(d.activity || [])).catch(() => {})
    setUpdatedAt(new Date())
  }, [onLogout])

  useEffect(() => {
    if (view !== 'dash') return undefined
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load, view])

  const maxScan = Math.max(1, ...tenants.map((t) => t.scan_count))

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="brand">
          <div className="logo">BNI</div>
          <div>
            <h1>Natcon 2026 — Admin Dashboard</h1>
            <p>Jakarta Convention Center · monitoring langsung</p>
          </div>
        </div>
        <div className="head-right">
          <nav className="view-nav">
            <button className={view === 'dash' ? 'active' : ''} onClick={() => setView('dash')}>
              Dashboard
            </button>
            <button className={view === 'master' ? 'active' : ''} onClick={() => setView('master')}>
              Master Data
            </button>
          </nav>
          {view === 'dash' && <span className="pill live">LIVE</span>}
          {view === 'dash' && updatedAt && (
            <span className="updated">diperbarui {updatedAt.toLocaleTimeString('id-ID')}</span>
          )}
          <button className="logout" onClick={onLogout}>
            Keluar
          </button>
        </div>
      </header>

      {view === 'master' && (
        <div style={{ marginTop: 28 }}>
          <MasterData />
        </div>
      )}

      {view === 'dash' && (
        <>
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
            <p className="panel-sub">Sesi paralel 13:00 – 14:30</p>
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
                    <div
                      className={`bar-fill${pct >= 80 ? ' warn' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
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
      )}
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))

  const logout = useCallback(() => {
    clearToken()
    setAuthed(false)
  }, [])

  return authed ? <Dashboard onLogout={logout} /> : <Login onLogin={() => setAuthed(true)} />
}
