import { useState } from 'react'
import { api } from '../api/client'

/*
 * Password recovery for attendees. There is no email delivery at an event, so
 * identity is proved with two things printed on the ticket: the BNI chapter
 * and the phone number registered with it. Match both and you may pick a new
 * password; the API rate-limits attempts the same way it does sign-in.
 */
export default function ForgotPassword({ onDone, onCancel }) {
  const [step, setStep] = useState('verify') // verify | choose | done
  const [chapter, setChapter] = useState('')
  const [phone, setPhone] = useState('')
  const [found, setFound] = useState(null)
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.forgotPassword(chapter.trim(), phone.trim())
      setResetToken(res.reset_token)
      setFound(res)
      setStep('choose')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = async (e) => {
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
      await api.resetPassword(resetToken, password)
      setStep('done')
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
            <p className="auth-eyebrow">Forgot password</p>

            {step === 'verify' && (
              <>
                <h2 className="auth-title">Let&apos;s find your account</h2>
                <p className="auth-sub">
                  Enter your BNI chapter and the phone number on your Natcon ticket. If they match,
                  you can set a new password right away.
                </p>
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={verify}>
                  <div className="auth-input">
                    <input
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value)}
                      placeholder="BNI chapter — e.g. Heritage"
                      aria-label="BNI chapter"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="auth-input">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number — e.g. 0811 2789 988"
                      aria-label="Phone number"
                      required
                    />
                  </div>
                  <button className="auth-submit" type="submit" disabled={busy}>
                    {busy ? 'Checking…' : 'Continue'}
                  </button>
                </form>
                <p className="auth-hint">
                  Either one on its own is not enough — both have to match the ticket. If they
                  don&apos;t, the registration desk can fix your details.
                </p>
              </>
            )}

            {step === 'choose' && (
              <>
                <h2 className="auth-title">Hi {found?.name?.split(' ')[0]}</h2>
                <p className="auth-sub">
                  Found your account: <b>{found?.email}</b>. Choose a new password.
                </p>
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={reset}>
                  <div className="auth-input">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password"
                      aria-label="New password"
                      autoComplete="new-password"
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
                      required
                    />
                  </div>
                  <button className="auth-submit" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Set new password'}
                  </button>
                </form>
              </>
            )}

            {step === 'done' && (
              <>
                <h2 className="auth-title">Password changed</h2>
                <p className="auth-sub">
                  Sign in with <b>{found?.email}</b> and your new password.
                </p>
                <button className="auth-submit" type="button" onClick={onDone}>
                  Back to sign in
                </button>
              </>
            )}

            {step !== 'done' && (
              <div className="auth-foot">
                <button type="button" className="auth-admin-link" onClick={onCancel}>
                  ← Back to sign in
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
