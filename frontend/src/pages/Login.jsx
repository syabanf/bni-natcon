import { useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import ForgotPassword from './ForgotPassword'
import { WitCredit } from '../components/Layout'

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'

/*
 * Two doors into the same app. Attendees are handed /login on their ticket;
 * booth and sponsor crews are handed /tenant/login, which says "Booth
 * Scanner" and skips the attendee-only bits (password recovery is chapter +
 * ticket phone, which a booth account has neither of).
 *
 * Signing in at the wrong door still works — the account's role decides where
 * you land — so nobody is stranded at a desk with the wrong link.
 */
// Two tickets bought on one email are often bought under one name as well,
// and then the picker offers two buttons reading exactly the same thing.
// Numbering them is what makes the choice a choice; the member code below
// still says which is which (MoM 19 Aug 2026).
export function withTwinNumbers(accounts) {
  const seen = new Map()
  const counts = new Map()
  for (const a of accounts) {
    const key = (a.name || '').trim().toLowerCase()
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return accounts.map((a) => {
    const key = (a.name || '').trim().toLowerCase()
    const n = (seen.get(key) || 0) + 1
    seen.set(key, n)
    return { ...a, twinIndex: n, twinCount: counts.get(key) }
  })
}

const AUDIENCE = {
  attendee: {
    eyebrow: 'Welcome to',
    sub: 'Sign in for your digital pass, learning classes, and speed networking.',
    hint: (
      <>
        Email = the address your ticket was bought with. First password ={' '}
        <code>natcon2026</code> — the same one for everybody. You&apos;ll choose your own right
        after.
      </>
    ),
    showRecovery: true,
    // No booth or admin links here — attendees found them confusing, and
    // booth crews and the committee get their addresses from the handout.
    showAdminLink: false,
  },
  tenant: {
    eyebrow: 'Booth Scanner',
    sub: 'Sign in with the booth account to scan attendee QRs and see your visitors.',
    hint: (
      <>
        All lowercase. Login = <code>booth-&lt;booth code&gt;@natcon.id</code> — booth A14 →{' '}
        <code>booth-a14@natcon.id</code>. First password = <code>natcon2026</code>, the same one
        for every booth. You&apos;ll set your own right after.
      </>
    ),
    showRecovery: false,
    showAdminLink: false,
    otherHref: '/login',
    otherLabel: '← Attendee? Sign in here',
  },
}

export default function Login({ audience = 'attendee' }) {
  const copy = AUDIENCE[audience] ?? AUDIENCE.attendee
  const setAuth = useAuthStore((s) => s.setAuth)
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
                each has its own QR, pins and learning class.
              </p>
              {error && <div className="auth-error">{error}</div>}
              <div className="account-picks">
                {withTwinNumbers(choice.accounts).map((a) => (
                  <button
                    type="button"
                    className="account-pick"
                    key={a.id}
                    onClick={() => pick(a)}
                    disabled={busy}
                  >
                    <span className="ap-name">
                      {a.name}
                      {a.twinCount > 1 && <em className="ap-twin">#{a.twinIndex}</em>}
                    </span>
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
            <p className="auth-eyebrow">{copy.eyebrow}</p>
            <img
              className="auth-logo"
              src="/brand/logo-horizontal.png"
              alt="BNI Indonesia National Conference 2026 — Accelerate"
            />
            <p className="auth-sub">{copy.sub}</p>

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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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

            {copy.showRecovery && (
              <button type="button" className="auth-forgot" onClick={() => setRecovering(true)}>
                Forgot your password?
              </button>
            )}

            <p className="auth-hint">{copy.hint}</p>

            <div className="auth-foot">
              {copy.otherLabel && (
                <a className="auth-admin-link" href={copy.otherHref}>
                  {copy.otherLabel}
                </a>
              )}
              {copy.showAdminLink && (
                <a className="auth-admin-link" href={ADMIN_URL} target="_blank" rel="noreferrer">
                  Committee? Open the admin panel ↗
                </a>
              )}
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
