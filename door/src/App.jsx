import { useEffect, useState } from 'react'
import { api, clearToken, getToken, setToken } from './api'
import DoorCheckin from './DoorCheckin'

/*
 * The door crew's app (MoM 19 Aug 2026).
 *
 * One screen, one job. It exists as its own app rather than a page in the
 * admin panel because the crew on a class door should not be handed the
 * committee's login — that one also opens the attendee list, the master data
 * and the draws. A door account can take attendance and hand over goodiebags
 * and pins; the server refuses it everything else.
 */
function Login({ onSignedIn }) {
  const [email, setEmail] = useState('door@natcon.id')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api.login(email.trim(), password)
      // An attendee's login opens nothing here, and saying so at the door is
      // kinder than a wall of 403s on the next screen.
      if (!['door', 'admin'].includes(res.user?.role)) {
        setError('That is not a door account. Ask the committee for the door login.')
        return
      }
      setToken(res.token)
      onSignedIn(res.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <section className="auth-pane form">
          <form className="auth-form" onSubmit={submit}>
            <p className="auth-eyebrow">Door Crew</p>
            <img className="auth-logo" src="/brand/logo-horizontal.png" alt="BNI Natcon 2026" />
            <p className="auth-sub">
              Sign in to scan attendees into a learning class, and to hand over goodiebags and pins.
            </p>
            <div className="auth-field">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="username"
              />
            </div>
            <div className="auth-field">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
        <aside className="auth-pane hero" aria-hidden="true">
          <div className="auth-hero-inner">
            <img className="auth-hero-logo" src="/brand/logo-stacked-white.png" alt="" />
            <span className="auth-hero-meta">3 September 2026 · Pullman Central Park Jakarta</span>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false))
  }, [])

  const signOut = () => {
    clearToken()
    setUser(null)
  }

  if (checking) return <div className="empty">Loading…</div>
  if (!user) return <Login onSignedIn={setUser} />

  return (
    <div className="door-shell">
      <header className="door-top">
        <img className="logo-mark" src="/brand/logo-horizontal.png" alt="BNI Natcon 2026" />
        <button className="md-secondary" onClick={signOut}>
          ← Log out
        </button>
      </header>
      <main className="content">
        <DoorCheckin onUnauthorized={signOut} />
      </main>
    </div>
  )
}
