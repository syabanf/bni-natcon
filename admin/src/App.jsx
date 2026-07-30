import { useCallback, useState } from 'react'
import { api, getToken, setToken, clearToken, isMockMode, setMockMode } from './api'
import Dashboard from './Dashboard'
import { ReportLeads, ReportSeminars, ReportCoupons } from './Report'
import { MembersPage, TenantsPage, SeminarsPage } from './MasterData'
import DoorCheckin from './DoorCheckin'

const MENU = [
  { key: 'dash', label: 'Dashboard', icon: '▦' },
  { key: 'members', label: 'Peserta', icon: '◉' },
  { key: 'tenants', label: 'Tenant', icon: '▤' },
  { key: 'seminars', label: 'Seminar', icon: '◈' },
  { key: 'door', label: 'Check-in Pintu', icon: '▣' },
]

const REPORT_MENU = [
  { key: 'report-leads', label: 'Leads Tenant', icon: '≣' },
  { key: 'report-seminars', label: 'Reg. Seminar', icon: '≣' },
  { key: 'report-coupons', label: 'Kupon Peserta', icon: '≣' },
]

function MockToggle({ onChange }) {
  const [mock, setMock] = useState(isMockMode())
  return (
    <button
      type="button"
      className={`mock-toggle${mock ? ' on' : ''}`}
      onClick={() => {
        const next = !mock
        setMockMode(next)
        setMock(next)
        onChange?.(next)
      }}
    >
      <span className="mt-dot" />
      {mock ? 'Mode Demo (Mock) aktif — data lokal, tanpa server' : 'Mode API — klik untuk coba Mode Demo (Mock)'}
    </button>
  )
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
        <p>Dashboard panitia — monitoring, master data &amp; laporan</p>
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
        <MockToggle onChange={() => setError('')} />
        <div className="hint">
          Demo: <code>admin@natcon.id</code> · password <code>natcon2026</code> (mode mock: password bebas)
        </div>
      </form>
    </div>
  )
}

function Shell({ onLogout }) {
  const [view, setView] = useState('dash')

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="logo">BNI</div>
          <div>
            <b>Natcon 2026</b>
            <small>Admin Panel</small>
          </div>
          {isMockMode() && <span className="demo-chip">DEMO</span>}
        </div>
        <nav className="sb-menu">
          {MENU.map((m) => (
            <button
              key={m.key}
              className={view === m.key ? 'active' : ''}
              onClick={() => setView(m.key)}
            >
              <span className="sb-ic">{m.icon}</span>
              {m.label}
            </button>
          ))}
          <div className="sb-section">Laporan</div>
          {REPORT_MENU.map((m) => (
            <button
              key={m.key}
              className={view === m.key ? 'active' : ''}
              onClick={() => setView(m.key)}
            >
              <span className="sb-ic">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
        <div className="sb-foot">
          <button className="sb-logout" onClick={onLogout}>
            ← Keluar
          </button>
        </div>
      </aside>

      <main className="content">
        {view === 'dash' && <Dashboard onUnauthorized={onLogout} />}
        {view === 'members' && <MembersPage />}
        {view === 'tenants' && <TenantsPage />}
        {view === 'seminars' && <SeminarsPage />}
        {view === 'door' && <DoorCheckin onUnauthorized={onLogout} />}
        {view === 'report-leads' && <ReportLeads onUnauthorized={onLogout} />}
        {view === 'report-seminars' && <ReportSeminars onUnauthorized={onLogout} />}
        {view === 'report-coupons' && <ReportCoupons onUnauthorized={onLogout} />}
      </main>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))

  const logout = useCallback(() => {
    clearToken()
    setAuthed(false)
  }, [])

  return authed ? <Shell onLogout={logout} /> : <Login onLogin={() => setAuthed(true)} />
}
