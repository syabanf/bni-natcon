import { useEffect, useState } from 'react'
import { api, clearToken, getToken, setToken } from './api'
import DoorCheckin from './DoorCheckin'

// Vite is told the app lives under /door/, so every asset and every route it
// owns hangs off that. BASE_URL is '/' in the test environment, which is
// exactly what the tests want.
const BASE = import.meta.env.BASE_URL
export const LOGIN_PATH = `${BASE}login`
export const HOME_PATH = BASE
const asset = (name) => BASE + name

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
  const [showPassword, setShowPassword] = useState(false)

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
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-pane form">
          <form className="auth-form-inner" onSubmit={submit}>
            <p className="auth-eyebrow">Door Crew</p>
            <img className="auth-logo" src={asset('brand/logo-horizontal.png')} alt="BNI Natcon 2026" />
            <p className="auth-sub">
              Sign in to scan attendees into a learning class, and to hand over goodiebags and pins.
            </p>

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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              {/* A door crew types this on a phone, standing up, in a hurry. */}
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
          </form>
        </section>

        <aside className="auth-pane hero" aria-hidden="true">
          <div className="auth-hero-inner">
            <img className="auth-hero-logo" src={asset('brand/logo-stacked-white.png')} alt="" />
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

  // The address bar follows the screen: /door/login while signed out,
  // /door once in. Nothing here reads the URL — there are only two screens
  // and the session decides which — but a crew member who bookmarks the page
  // or is handed a link should land on the one that says what it is.
  useEffect(() => {
    if (checking) return
    const want = user ? HOME_PATH : LOGIN_PATH
    if (window.location.pathname !== want) {
      window.history.replaceState(null, '', want + window.location.search)
    }
  }, [checking, user])

  const signOut = () => {
    clearToken()
    setUser(null)
  }

  if (checking) return <div className="empty">Loading…</div>
  if (!user) return <Login onSignedIn={setUser} />

  return (
    <div className="door-shell">
      <header className="door-top">
        <img className="logo-mark" src={asset('brand/logo-horizontal.png')} alt="BNI Natcon 2026" />
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
