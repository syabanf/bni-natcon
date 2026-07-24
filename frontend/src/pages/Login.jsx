import { useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token, user } = await api.login(email, password)
      setAuth(token, user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">BNI</div>
        <h1>BNI Natcon 2026</h1>
        <p>National Conference · Business Network International Indonesia</p>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@natcon.id"
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

        <div className="login-hint">
          Akun demo (password <code>natcon2026</code>):
          <br />
          Peserta: <code>reddie@natcon.id</code>, <code>sinta@natcon.id</code>
          <br />
          Tenant: <code>booth-a03@natcon.id</code> (Kopi Nusantara)
        </div>
      </form>
    </div>
  )
}
