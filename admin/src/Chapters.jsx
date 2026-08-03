import { useEffect, useState } from 'react'
import { api } from './api'
import Modal from './Modal'

// Chapters master data — fed automatically by member imports & CRUD,
// editable here (rename cascades to every member in the chapter).
export default function Chapters({ onUnauthorized }) {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(null) // null | {id?, name}
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .chapters({ onUnauthorized })
      .then((d) => setRows(d.chapters || []))
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (form.id) {
        await api.renameChapter(form.id, form.name)
        setNotice('Chapter renamed — its members were moved along.')
      } else {
        await api.createChapter(form.name)
        setNotice('Chapter added.')
      }
      setForm(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const del = async (c) => {
    if (!window.confirm(`Delete chapter "${c.name}"?`)) return
    setError('')
    try {
      await api.deleteChapter(c.id)
      setNotice(`Chapter "${c.name}" deleted.`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const total = rows?.reduce((sum, c) => sum + c.members, 0) ?? 0

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Master Data — Chapters</h1>
          <p className="micro">
            Fed automatically by member imports — rename cascades to every member in the chapter
          </p>
        </div>
        <div className="head-right">
          <button className="md-add" onClick={() => setForm({ name: '' })}>
            + Add Chapter
          </button>
        </div>
      </div>

      {error && (
        <div className="error" onClick={() => setError('')}>
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" onClick={() => setNotice('')}>
          {notice}
        </div>
      )}

      <div className="list-toolbar">
        <span className="list-count">
          {rows ? `${rows.length} chapters · ${total} members` : 'Loading…'}
        </span>
      </div>

      <div className="table-scroll">
        <table className="md-table">
          <thead>
            <tr>
              <th>Chapter</th>
              <th className="num">Members</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b>
                </td>
                <td className="num">{c.members}</td>
                <td className="md-actions">
                  <button onClick={() => setForm({ id: c.id, name: c.name })}>Rename</button>
                  <button className="danger" onClick={() => del(c)} disabled={c.members > 0}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  No chapters yet — import members or add one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? 'Rename Chapter' : 'Add Chapter'} onClose={() => setForm(null)}>
          <form className="modal-form" onSubmit={submit}>
            <label className="md-field">
              <span>
                Chapter name
                {form.id && <em> — every member in this chapter follows the new name</em>}
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={busy} type="submit">
                {form.id ? 'Save Changes' : 'Add'}
              </button>
              <button type="button" className="md-cancel" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
