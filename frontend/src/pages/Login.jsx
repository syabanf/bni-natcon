import { useState } from 'react'
import Icon from '../components/Icon'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

const DEMO_PASSWORD = 'natcon2026'
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'

const QUICK_ACCOUNTS = [
  { email: 'reddie@natcon.id', label: 'Reddie', sub: 'Peserta', initials: 'RW', kind: 'member' },
  { email: 'sinta@natcon.id', label: 'Sinta', sub: 'Peserta', initials: 'SD', kind: 'member' },
  { email: 'booth-a03@natcon.id', label: 'Kopi Nusantara', sub: 'Tenant · A-03', initials: 'KN', kind: 'tenant' },
  { email: 'booth-b01@natcon.id', label: 'TechNesia', sub: 'Tenant · B-01', initials: 'TS', kind: 'tenant' },
]

const APPS = [
  {
    kind: 'member',
    icon: 'user',
    title: 'Aplikasi Peserta',
    desc: 'QR pass, tenant passport, seminar',
  },
  {
    kind: 'tenant',
    icon: 'store',
    title: 'Aplikasi Tenant',
    desc: 'Scanner booth & dashboard pengunjung',
  },
  {
    kind: 'admin',
    icon: 'chart',
    title: 'Admin Dashboard',
    desc: 'Monitoring & master data panitia',
  },
]

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState(null) // null | 'member' | 'tenant'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const doLogin = async (loginEmail, loginPassword) => {
    setError('')
    setBusy(true)
    try {
      const { token, user } = await api.login(loginEmail, loginPassword)
      setAuth(token, user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    doLogin(email, password)
  }

  /* --- Step 1: quick access chooser --- */
  if (!mode) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">BNI</div>
          <h1>BNI Natcon 2026</h1>
          <p>Mau akses aplikasi yang mana?</p>
          <div className="app-chooser">
            {APPS.map((a) =>
              a.kind === 'admin' ? (
                <a key={a.kind} className="app-tile" href={ADMIN_URL} target="_blank" rel="noreferrer">
                  <span className="at-ic">
                    <Icon name={a.icon} size={18} />
                  </span>
                  <span className="at-info">
                    <b>{a.title}</b>
                    <small>{a.desc}</small>
                  </span>
                  <span className="at-go">↗</span>
                </a>
              ) : (
                <button key={a.kind} className="app-tile" onClick={() => setMode(a.kind)}>
                  <span className="at-ic">
                    <Icon name={a.icon} size={18} />
                  </span>
                  <span className="at-info">
                    <b>{a.title}</b>
                    <small>{a.desc}</small>
                  </span>
                  <span className="at-go">→</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  /* --- Step 2: login for the chosen app --- */
  const accounts = QUICK_ACCOUNTS.filter((a) => a.kind === mode)

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <button type="button" className="back-link" onClick={() => setMode(null)}>
          ← Pilih aplikasi lain
        </button>
        <div className="login-logo">BNI</div>
        <h1>{mode === 'member' ? 'Aplikasi Peserta' : 'Aplikasi Tenant'}</h1>
        <p>BNI Natcon 2026 · Jakarta Convention Center</p>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === 'member' ? 'nama@natcon.id' : 'booth-a03@natcon.id'}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>

        <div className="quick-login">
          <div className="ql-label">Quick login — akun demo</div>
          <div className="ql-grid">
            {accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                className={`ql-btn ${a.kind}`}
                onClick={() => doLogin(a.email, DEMO_PASSWORD)}
                disabled={busy}
              >
                <span className="ql-av">{a.initials}</span>
                <span className="ql-info">
                  <b>{a.label}</b>
                  <small>{a.sub}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
