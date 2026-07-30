import { useState } from 'react'
import Icon from '../components/Icon'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

const DEMO_PASSWORD = 'natcon2026'
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'

const QUICK_ACCOUNTS = [
  { email: 'reddie@natcon.id', label: 'Reddie', sub: 'Member', initials: 'RW', kind: 'member' },
  { email: 'sinta@natcon.id', label: 'Sinta', sub: 'Member', initials: 'SD', kind: 'member' },
  { email: 'agus@natcon.id', label: 'Agus', sub: 'Member', initials: 'AS', kind: 'member' },
  { email: 'booth-sp01@natcon.id', label: 'BNI Xpora', sub: 'Sponsor · SP-01', initials: 'BX', kind: 'tenant' },
  { email: 'booth-a03@natcon.id', label: 'Kopi Nusantara', sub: 'Booth · A-03', initials: 'KN', kind: 'tenant' },
  { email: 'booth-b01@natcon.id', label: 'TechNesia', sub: 'Booth · B-01', initials: 'TS', kind: 'tenant' },
]

const APPS = [
  {
    kind: 'member',
    icon: 'user',
    title: 'Attendee App',
    desc: 'QR pass, tenant passport, seminars',
  },
  {
    kind: 'tenant',
    icon: 'store',
    title: 'Tenant App',
    desc: 'Booth scanner & visitor dashboard',
  },
  {
    kind: 'admin',
    icon: 'chart',
    title: 'Admin Dashboard',
    desc: 'Committee monitoring & master data',
  },
]

function MockToggle() {
  const mock = useAuthStore((s) => s.mock)
  const setMock = useAuthStore((s) => s.setMock)
  return (
    <button
      type="button"
      className={`mock-toggle${mock ? ' on' : ''}`}
      onClick={() => setMock(!mock)}
    >
      <span className="mt-dot" />
      {mock ? 'Demo (Mock) mode is on — local data, no server' : 'API mode — tap to try Demo (Mock) mode'}
    </button>
  )
}

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const mock = useAuthStore((s) => s.mock)
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
          <p>Which app do you want to open?</p>
          <MockToggle />
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
          {error && <div className="login-error" style={{ marginTop: 14 }}>{error}</div>}
          <button
            type="button"
            className="ql-btn"
            style={{ width: '100%', marginTop: 14 }}
            onClick={() => doLogin('reddie@natcon.id', DEMO_PASSWORD)}
            disabled={busy}
          >
            <span className="ql-av">RW</span>
            <span className="ql-info">
              <b>{busy ? 'Signing in…' : 'Quick demo — sign in as Reddie'}</b>
              <small>Member · one tap, straight to the app</small>
            </span>
          </button>
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
          ← Choose another app
        </button>
        <div className="login-logo">BNI</div>
        <h1>{mode === 'member' ? 'Attendee App' : 'Tenant App'}</h1>
        <p>BNI Natcon 2026 · Jakarta Convention Center</p>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === 'member' ? 'name@natcon.id' : 'booth-a03@natcon.id'}
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="quick-login">
          <div className="ql-label">Quick login — demo accounts</div>
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

        <MockToggle />
        {mock && (
          <p className="mock-note">
            Demo mode: data lives on this device only and any password works. Scan booths with a demo
            member code (e.g. NATCON-2026-08154) or phone (+62811000154).
          </p>
        )}
      </form>
    </div>
  )
}
