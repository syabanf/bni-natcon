import { useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

/*
 * First sign-in — two things the app will not go past.
 *
 * The account still carries the password generated from the chapter and first
 * name at import time, so the attendee picks one of their own here. And an
 * attendee who has not yet agreed to the data notice agrees here too: being
 * imported from the committee's ticket sheet is not the same as that person
 * agreeing to it, so we ask before showing them anything.
 *
 * Both can be outstanding, or only one — somebody who set a password before
 * the notice existed sees the notice alone.
 */
export default function SetPassword() {
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)

  const needsPassword = !!user?.must_set_password
  const needsConsent = !!user?.must_consent

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (needsConsent && !agreed) {
      setError('Please tick the box to agree before continuing.')
      return
    }
    if (needsPassword) {
      if (password !== confirm) {
        setError('The two passwords do not match.')
        return
      }
      if (password.length < 8) {
        setError('Use at least 8 characters.')
        return
      }
    }
    setBusy(true)
    try {
      // Consent first: if the password call fails, the agreement they just
      // gave is still on record and they are not asked for it again.
      if (needsConsent) await api.recordConsent()
      if (needsPassword) await api.setPassword(password)
      setAuth(token, { ...user, must_set_password: false, must_consent: false })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell single">
        <section className="auth-pane form">
          <div className="auth-form-inner">
            <p className="auth-eyebrow">One last step</p>
            <h2 className="auth-title">
              {needsPassword ? 'Choose your password' : 'Before you start'}
            </h2>
            <p className="auth-sub">
              Hi {user?.name?.split(' ')[0]} —{' '}
              {needsPassword
                ? "you signed in with the password we generated for you. Pick your own now; you'll use it for the rest of Natcon."
                : 'one short notice to agree to before we open the app.'}
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={submit}>
              {needsPassword && (
              <>
              <div className="auth-input">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  aria-label="New password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="auth-reveal"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="auth-input">
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  aria-label="Repeat password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>
              </>
              )}

              {needsConsent && (
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    I agree that by using the Natcon 2026 app I give the committee my{' '}
                    <b>name and email address</b>, so that the booths I choose to visit can
                    follow up with me and the committee can run the event. Scanning a booth
                    is my choice; a booth only receives my details once I let it scan my QR.
                  </span>
                </label>
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={busy || (needsConsent && !agreed)}
              >
                {busy ? 'Saving…' : needsPassword ? 'Save and continue' : 'Agree and continue'}
              </button>
            </form>

            <p className="auth-hint">At least 8 characters. Anything you&apos;ll remember on the day.</p>
            <div className="auth-foot">
              <button type="button" className="auth-admin-link" onClick={logout}>
                Sign in as someone else
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
