import { useCallback, useState } from 'react'
import { api, getToken, setToken, clearToken } from './api'
import Dashboard from './Dashboard'
import Report from './Report'
import { MembersPage, TenantsPage, SeminarsPage } from './MasterData'

const MENU = [
  { key: 'dash', label: 'Dashboard', icon: '▦' },
  { key: 'members', label: 'Peserta', icon: '◉' },
  { key: 'tenants', label: 'Tenant', icon: '▤' },
  { key: 'seminars', label: 'Seminar', icon: '◈' },
  { key: 'report', label: 'Laporan', icon: '≣' },
]

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
        <div className="hint">
          Demo: <code>admin@natcon.id</code> · password <code>natcon2026</code>
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
        {view === 'report' && <Report onUnauthorized={onLogout} />}
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
