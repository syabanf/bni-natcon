import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { toast } from '../../components/Toast'

/*
 * The attendee's own pen on their pass: the name and chapter printed on it,
 * and their password. Email stays put — it is the login; phone stays put —
 * it is a scanner key and the recovery factor, corrected at the desk.
 */
export default function Profile() {
  const navigate = useNavigate()
  const { token, user, setAuth } = useAuthStore()
  const [name, setName] = useState(user?.name || '')
  const [chapter, setChapter] = useState(user?.chapter || '')
  const [chapters, setChapters] = useState([])
  const [saving, setSaving] = useState(false)

  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [changing, setChanging] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    api.chapters().then((d) => setChapters(d.chapters || [])).catch(() => {})
  }, [])

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const d = await api.updateProfile(name, chapter)
      // The pass card everywhere reads from the store, so the correction has
      // to land there too.
      setAuth(token, d.user)
      toast('Profile saved — your pass now reads ' + d.user.name)
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw !== pw2) {
      toast('The passwords do not match')
      return
    }
    setChanging(true)
    try {
      await api.changePassword(current, pw)
      setCurrent('')
      setPw('')
      setPw2('')
      toast('Password changed')
    } catch (err) {
      toast(err.message)
    } finally {
      setChanging(false)
    }
  }

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={() => navigate('/attendee')}>
          ← Back
        </button>
        <h2>My Profile</h2>
        <p>What your pass says, and the password that opens it</p>
      </div>

      <form className="card profile-card" onSubmit={saveProfile}>
        <h4>
          <Icon name="users" size={15} /> Pass details
        </h4>
        <label className="profile-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="profile-field">
          <span>Chapter</span>
          <input
            list="chapter-options"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Your BNI chapter"
          />
          <datalist id="chapter-options">
            {chapters.map((c) => (
              <option value={c} key={c} />
            ))}
          </datalist>
        </label>
        <p className="profile-note">
          Email and phone stay as registered — they are your sign-in and recovery. The desk can
          correct them if needed.
        </p>
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form className="card profile-card" onSubmit={changePassword}>
        <h4>
          <Icon name="qr" size={15} /> Change password
        </h4>
        <label className="profile-field">
          <span>Current password</span>
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="profile-field">
          <span>New password</span>
          <input
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={8}
            required
          />
        </label>
        <label className="profile-field">
          <span>Repeat new password</span>
          <input
            type={show ? 'text' : 'password'}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>
        <button type="button" className="profile-show" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide passwords' : 'Show passwords'}
        </button>
        <button className="btn primary" type="submit" disabled={changing}>
          {changing ? 'Changing…' : 'Change password'}
        </button>
      </form>
      <div style={{ height: 24 }} />
    </>
  )
}
