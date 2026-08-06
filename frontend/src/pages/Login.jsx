import { useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import ForgotPassword from './ForgotPassword'
import { WitCredit } from '../components/Layout'

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'

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

/*
 * One sign-in for everyone: the account decides where you land — attendees
 * go to their pass, booth/sponsor accounts straight to the scanner.
 */
export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const mock = useAuthStore((s) => s.mock)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)
  // Set when one email opens more than one attendee account.
  const [choice, setChoice] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.login(email.trim(), password)
      if (res.choose) {
        setChoice(res)
      } else {
        setAuth(res.token, res.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const pick = async (account) => {
    setError('')
    setBusy(true)
    try {
      const { token, user } = await api.selectAccount(choice.choice_token, account.id)
      setAuth(token, user)
    } catch (err) {
      setError(err.message)
      setChoice(null)
    } finally {
      setBusy(false)
    }
  }

  if (choice) {
    return (
      <div className="auth-page">
        <div className="auth-shell single">
          <section className="auth-pane form">
            <div className="auth-form-inner">
              <p className="auth-eyebrow">Two tickets, one email</p>
              <h2 className="auth-title">Which one are you?</h2>
              <p className="auth-sub">
                This address holds more than one Natcon ticket. Pick the pass you want to use —
                each has its own QR, pins and breakout class.
              </p>
              {error && <div className="auth-error">{error}</div>}
              <div className="account-picks">
                {choice.accounts.map((a) => (
                  <button
                    type="button"
                    className="account-pick"
                    key={a.id}
                    onClick={() => pick(a)}
                    disabled={busy}
                  >
                    <span className="ap-name">{a.name}</span>
                    <span className="ap-meta">
                      {a.member_code}
                      {a.chapter ? ` · ${a.chapter}` : ''}
                    </span>
                    {a.company && <span className="ap-meta">{a.company}</span>}
                  </button>
                ))}
              </div>
              <div className="auth-foot">
                <button type="button" className="auth-admin-link" onClick={() => setChoice(null)}>
                  ← Back to sign in
                </button>
              </div>
              <WitCredit />
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (recovering) {
    return (
      <ForgotPassword onDone={() => setRecovering(false)} onCancel={() => setRecovering(false)} />
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-pane form">
          <div className="auth-form-inner">
            <p className="auth-eyebrow">Welcome to</p>
            <img
              className="auth-logo"
              src="/brand/logo-horizontal.png"
              alt="BNI Indonesia National Conference 2026 — Accelerate"
            />
            <p className="auth-sub">
              Sign in for your digital pass, breakout classes, and speed networking.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={submit}>
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
                  autoFocus
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

              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <button type="button" className="auth-forgot" onClick={() => setRecovering(true)}>
              Forgot your password?
            </button>

            <p className="auth-hint">
              Password = your <b>chapter + first name</b>, lowercase without spaces — e.g. Heritage +
              Abraham → <code>heritageabraham</code>
            </p>

            <div className="auth-foot">
              <MockToggle />
              {mock && (
                <p className="auth-note">Demo mode stays on this device and accepts any password.</p>
              )}
              <a className="auth-admin-link" href={ADMIN_URL} target="_blank" rel="noreferrer">
                Committee? Open the admin panel ↗
              </a>
            </div>
            <WitCredit />
          </div>
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
