import { useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

/*
 * First sign-in. The account still carries the password generated from the
 * chapter and first name at import time, so nothing else in the app opens
 * until the attendee picks one of their own.
 */
export default function SetPassword() {
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await api.setPassword(password)
      setAuth(token, { ...user, must_set_password: false })
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
            <h2 className="auth-title">Choose your password</h2>
            <p className="auth-sub">
              Hi {user?.name?.split(' ')[0]} — you signed in with the password we generated for you.
              Pick your own now; you&apos;ll use it for the rest of Natcon.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={submit}>
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
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save and continue'}
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
