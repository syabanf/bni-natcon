import { useCallback, useState } from 'react'
import { api, getToken, setToken, clearToken, isMockMode, setMockMode } from './api'
import Dashboard from './Dashboard'
import { ReportLeads, ReportSeminars, ReportCoupons } from './Report'
import { MembersPage, TenantsPage, SeminarsPage } from './MasterData'
import DoorCheckin from './DoorCheckin'
import LuckyDraw from './LuckyDraw'
import Chapters from './Chapters'
import Tables from './Tables'
import QRPrints from './QRPrints'

const MENU = [
  { key: 'dash', label: 'Dashboard', icon: '▦' },
  { key: 'members', label: 'Attendees', icon: '◉' },
  { key: 'tenants', label: 'Tenants', icon: '▤' },
  { key: 'chapters', label: 'Chapters', icon: '⬡' },
  { key: 'seminars', label: 'Breakout Class', icon: '◈' },
  { key: 'tables', label: 'Tables', icon: '◍' },
  { key: 'door', label: 'Door Check-in', icon: '▣' },
  { key: 'qr', label: 'QR Prints', icon: '⧉' },
  { key: 'draw', label: 'Lucky Draw', icon: '✦' },
]

const REPORT_MENU = [
  { key: 'report-leads', label: 'Tenant Leads', icon: '≣' },
  { key: 'report-seminars', label: 'Class Reg.', icon: '≣' },
  { key: 'report-coupons', label: 'Attendee Pins', icon: '≣' },
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
      {mock ? 'Demo (Mock) mode is on — local data, no server' : 'API mode — tap to try Demo (Mock) mode'}
    </button>
  )
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@natcon.id')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token, user } = await api.login(email, password)
      if (user.role !== 'admin') {
        setError('This is not a committee/admin account')
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
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-pane form">
          <form className="auth-form-inner" onSubmit={submit}>
            <p className="auth-eyebrow">Committee access</p>
            <img
              className="auth-logo"
              src="/brand/logo-horizontal.png"
              alt="BNI Indonesia National Conference 2026 — Accelerate"
            />
            <p className="auth-sub">Sign in to the committee panel.</p>

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-input">
              <span className="auth-input-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                aria-label="Email"
                autoComplete="username"
                required
              />
            </div>

            <div className="auth-input">
              <span className="auth-input-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                required
                autoFocus
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <button className="auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="auth-foot">
              <MockToggle onChange={() => setError('')} />
            </div>
          </form>
        </section>

        <aside className="auth-pane hero" aria-hidden="true">
          <span className="auth-streak s1" />
          <span className="auth-streak s2" />
          <span className="auth-streak s3" />
          <div className="auth-hero-inner">
            <img className="auth-hero-logo" src="/brand/logo-stacked-white.png" alt="" />
            <span className="auth-hero-meta">3 September 2026 · Pullman Central Park Jakarta</span>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Shell({ onLogout }) {
  const [view, setView] = useState('dash')

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sb-brand">
          <img className="logo-mark sb" src="/brand/logo-horizontal.png" alt="BNI Natcon 2026" />
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
          <div className="sb-section">Reports</div>
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
            ← Log out
          </button>
        </div>
      </aside>

      <main className="content">
        {view === 'dash' && <Dashboard onUnauthorized={onLogout} />}
        {view === 'members' && <MembersPage />}
        {view === 'tenants' && <TenantsPage />}
        {view === 'chapters' && <Chapters onUnauthorized={onLogout} />}
        {view === 'seminars' && <SeminarsPage />}
        {view === 'tables' && <Tables onUnauthorized={onLogout} />}
        {view === 'door' && <DoorCheckin onUnauthorized={onLogout} />}
        {view === 'qr' && <QRPrints onUnauthorized={onLogout} />}
        {view === 'draw' && <LuckyDraw onUnauthorized={onLogout} />}
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
