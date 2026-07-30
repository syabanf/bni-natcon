import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import Modal from './Modal'
import { parseSheet } from './excel'
import { MemberDetail, TenantDetail, SeminarDetail } from './Detail'

/*
 * Master data pages: Peserta / Tenant / Seminar.
 * CRUD runs through modal popups; Peserta & Tenant support Excel import.
 */

function Field({ label, hint, ...props }) {
  return (
    <label className="md-field">
      <span>
        {label}
        {hint && <em> — {hint}</em>}
      </span>
      <input {...props} />
    </label>
  )
}

function useCrud({ list, create, update, remove }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null) // null | object (id present => edit)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // list dibuat inline oleh pemanggil (identitasnya berubah tiap render);
  // simpan di ref supaya load stabil dan effect mount hanya jalan sekali.
  const listRef = useRef(list)
  listRef.current = list

  const load = useCallback(() => {
    listRef.current()
      .then(setRows)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (form.id) {
        await update(form.id, form)
        setNotice('Changes saved.')
      } else {
        await create(form)
        setNotice('Record added.')
      }
      setForm(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const del = async (id, label) => {
    if (!window.confirm(`Delete ${label}? Related data (scans/registrations) is deleted too.`)) return
    setError('')
    try {
      await remove(id)
      setNotice(`${label} deleted.`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return { rows, form, setForm, error, setError, notice, setNotice, busy, submit, del, load }
}

function ImportButton({ label, aliases, upload, onDone }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const rows = (await parseSheet(file, aliases)).filter((r) => Object.values(r).some(Boolean))
      if (rows.length === 0) {
        onDone({ error: 'File is empty or the header row was not recognized.' })
        return
      }
      const res = await upload(rows)
      onDone(res)
    } catch (err) {
      onDone({ error: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <button className="md-secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Importing…' : `⇪ ${label}`}
      </button>
    </>
  )
}

function PageHead({ title, sub, children }) {
  return (
    <div className="content-head">
      <div>
        <h1>{title}</h1>
        <p className="micro">{sub}</p>
      </div>
      <div className="head-right">{children}</div>
    </div>
  )
}

function Notices({ crud, importResult, clearImport }) {
  return (
    <>
      {crud.error && (
        <div className="error" onClick={() => crud.setError('')}>
          {crud.error}
        </div>
      )}
      {crud.notice && (
        <div className="notice" onClick={() => crud.setNotice('')}>
          {crud.notice}
        </div>
      )}
      {importResult && (
        <div className={importResult.error ? 'error' : 'notice'} onClick={clearImport}>
          {importResult.error
            ? `Import failed: ${importResult.error}`
            : `Import finished — ${importResult.created} created, ${importResult.failed} failed.`}
          {importResult.errors?.length > 0 && (
            <ul>
              {importResult.errors.slice(0, 5).map((e) => (
                <li key={e.row}>
                  Row {e.row} ({e.label}): {e.error}
                </li>
              ))}
              {importResult.errors.length > 5 && <li>… {importResult.errors.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function RowActions({ onDetail, onEdit, onDelete }) {
  return (
    <td className="md-actions">
      {onDetail && (
        <button className="detail" onClick={onDetail}>
          Detail
        </button>
      )}
      <button onClick={onEdit}>Edit</button>
      <button className="danger" onClick={onDelete}>
        Delete
      </button>
    </td>
  )
}

/* ================= Peserta ================= */

const MEMBERS_PAGE_SIZE = 25

export function MembersPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const crud = useCrud({
    list: () =>
      api.members({ q, page, limit: MEMBERS_PAGE_SIZE }).then((d) => {
        setTotal(d.total ?? (d.members || []).length)
        return d.members || []
      }),
    create: (f) => api.createMember(f),
    update: (id, f) => api.updateMember(id, f),
    remove: (id) => api.deleteMember(id),
  })
  const [importResult, setImportResult] = useState(null)
  const [detailId, setDetailId] = useState(null)

  // Muat ulang saat pencarian/halaman berubah (mount sudah ditangani useCrud).
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    crud.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page])

  const totalPages = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE))

  if (detailId) {
    return (
      <MemberDetail
        id={detailId}
        onBack={() => {
          setDetailId(null)
          crud.load()
        }}
      />
    )
  }

  return (
    <>
      <PageHead title="Master Data — Attendees" sub="Member code & default password are generated automatically">
        <ImportButton
          label="Import Excel"
          aliases={{
            name: ['nama', 'name'],
            email: ['email', 'e-mail'],
            chapter: ['chapter'],
            company: ['perusahaan', 'company', 'bisnis'],
          }}
          upload={(rows) => api.bulkMembers(rows)}
          onDone={(res) => {
            setImportResult(res)
            crud.load()
          }}
        />
        <button className="md-add" onClick={() => crud.setForm({ name: '', email: '', chapter: '', company: '' })}>
          + Add Attendee
        </button>
      </PageHead>
      <p className="import-hint">
        Excel format: columns <b>Name</b>, <b>Email</b>, <b>Chapter</b>, <b>Company</b> (first row = header).
      </p>

      <div className="list-toolbar">
        <input
          className="search-input"
          placeholder="Search name, email, member code, or chapter…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <span className="list-count">{total} attendees</span>
      </div>

      <Notices crud={crud} importResult={importResult} clearImport={() => setImportResult(null)} />

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Member Code</th>
            <th>Name</th>
            <th>Email</th>
            <th>Chapter</th>
            <th className="num">Pins</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {crud.rows.map((m) => (
            <tr key={m.id}>
              <td className="mono">{m.member_code}</td>
              <td>
                <b>{m.name}</b>
                <small>{m.company}</small>
              </td>
              <td>{m.email}</td>
              <td>{m.chapter}</td>
              <td className="num">{m.visits}</td>
              <RowActions
                onDetail={() => setDetailId(m.id)}
                onEdit={() =>
                  crud.setForm({ id: m.id, name: m.name, email: m.email, chapter: m.chapter, company: m.company })
                }
                onDelete={() => crud.del(m.id, m.name)}
              />
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="pager">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ‹ Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next ›
        </button>
      </div>

      {crud.form && (
        <Modal title={crud.form.id ? 'Edit Attendee' : 'Add Attendee'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Name" value={crud.form.name} onChange={(e) => crud.setForm({ ...crud.form, name: e.target.value })} required autoFocus />
            <Field label="Email" type="email" value={crud.form.email} onChange={(e) => crud.setForm({ ...crud.form, email: e.target.value })} required />
            <Field label="Chapter" value={crud.form.chapter} onChange={(e) => crud.setForm({ ...crud.form, chapter: e.target.value })} />
            <Field label="Company" value={crud.form.company} onChange={(e) => crud.setForm({ ...crud.form, company: e.target.value })} />
            {crud.error && <div className="error">{crud.error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={crud.busy} type="submit">
                {crud.form.id ? 'Save Changes' : 'Add'}
              </button>
              <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/* ================= Tenant ================= */

export function TenantsPage() {
  const crud = useCrud({
    list: () => api.tenants().then((d) => d.tenants || []),
    create: (f) => api.createTenant(f),
    update: (id, f) => api.updateTenant(id, f),
    remove: (id) => api.deleteTenant(id),
  })
  const [importResult, setImportResult] = useState(null)
  const [detailId, setDetailId] = useState(null)

  if (detailId) {
    return (
      <TenantDetail
        id={detailId}
        onBack={() => {
          setDetailId(null)
          crud.load()
        }}
      />
    )
  }

  return (
    <>
      <PageHead title="Master Data — Tenants" sub="Booth/sponsor scanner accounts are generated automatically (booth-xxx@natcon.id)">
        <ImportButton
          label="Import Excel"
          aliases={{
            name: ['nama', 'name'],
            category: ['kategori', 'category'],
            booth: ['booth'],
            initials: ['inisial', 'initials'],
            email: ['email', 'e-mail'],
            kind: ['kind', 'jenis', 'tipe'],
          }}
          upload={(rows) => api.bulkTenants(rows)}
          onDone={(res) => {
            setImportResult(res)
            crud.load()
          }}
        />
        <button
          className="md-add"
          onClick={() => crud.setForm({ name: '', category: '', booth: '', initials: '', email: '', kind: 'booth', description: '' })}
        >
          + Add Tenant
        </button>
      </PageHead>
      <p className="import-hint">
        Excel format: columns <b>Name</b>, <b>Category</b>, <b>Booth</b>, <b>Initials</b> (optional), <b>Email</b> (optional), <b>Kind</b> (booth/sponsor, optional).
      </p>

      <Notices crud={crud} importResult={importResult} clearImport={() => setImportResult(null)} />

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Booth</th>
            <th>Name</th>
            <th>Category</th>
            <th className="num">Scans</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {crud.rows.map((t) => (
            <tr key={t.id}>
              <td className="mono">{t.booth}</td>
              <td>
                <b>{t.name}</b>
                <small>
                  {t.kind === 'sponsor' ? '★ Sponsor' : 'Booth'} · {t.initials}
                </small>
              </td>
              <td>{t.category}</td>
              <td className="num">{t.scan_count}</td>
              <RowActions
                onDetail={() => setDetailId(t.id)}
                onEdit={() =>
                  crud.setForm({ id: t.id, name: t.name, category: t.category, booth: t.booth, initials: t.initials, kind: t.kind || 'booth', description: t.description || '' })
                }
                onDelete={() => crud.del(t.id, t.name)}
              />
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {crud.form && (
        <Modal title={crud.form.id ? 'Edit Tenant' : 'Add Tenant'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Name" value={crud.form.name} onChange={(e) => crud.setForm({ ...crud.form, name: e.target.value })} required autoFocus />
            <Field label="Category" value={crud.form.category} onChange={(e) => crud.setForm({ ...crud.form, category: e.target.value })} />
            <Field label="Booth" value={crud.form.booth} onChange={(e) => crud.setForm({ ...crud.form, booth: e.target.value })} placeholder="A-03" required />
            <Field label="Initials" hint="leave blank to auto-fill" value={crud.form.initials} onChange={(e) => crud.setForm({ ...crud.form, initials: e.target.value })} />
            <label className="md-field">
              <span>Kind — sponsors are listed on top of the passport</span>
              <select
                className="door-select"
                value={crud.form.kind || 'booth'}
                onChange={(e) => crud.setForm({ ...crud.form, kind: e.target.value })}
              >
                <option value="booth">Booth</option>
                <option value="sponsor">Sponsor</option>
              </select>
            </label>
            <Field label="Description" hint="shown on the attendee passport" value={crud.form.description || ''} onChange={(e) => crud.setForm({ ...crud.form, description: e.target.value })} />
            {!crud.form.id && (
              <Field label="Login email" hint="leave blank to auto-fill" value={crud.form.email} onChange={(e) => crud.setForm({ ...crud.form, email: e.target.value })} />
            )}
            {crud.error && <div className="error">{crud.error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={crud.busy} type="submit">
                {crud.form.id ? 'Save Changes' : 'Add'}
              </button>
              <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/* ================= Seminar ================= */

export function SeminarsPage() {
  const crud = useCrud({
    list: () => api.seminars().then((d) => d.seminars || []),
    create: (f) => api.createSeminar({ ...f, slot: +f.slot, capacity: +f.capacity }),
    update: (id, f) => api.updateSeminar(id, { ...f, slot: +f.slot, capacity: +f.capacity }),
    remove: (id) => api.deleteSeminar(id),
  })

  const [detailId, setDetailId] = useState(null)

  if (detailId) {
    return (
      <SeminarDetail
        id={detailId}
        onBack={() => {
          setDetailId(null)
          crud.load()
        }}
      />
    )
  }

  return (
    <>
      <PageHead title="Master Data — Seminars" sub="Attendees can only pick one seminar per slot">
        <button
          className="md-add"
          onClick={() => crud.setForm({ slot: 1, room: '', title: '', speaker: '', capacity: 40, description: '', cover_url: '' })}
        >
          + Add Seminar
        </button>
      </PageHead>

      <Notices crud={crud} importResult={null} clearImport={() => {}} />

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Room</th>
            <th>Title</th>
            <th className="num">Filled</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {crud.rows.map((sm) => (
            <tr key={sm.id}>
              <td className="mono">#{sm.slot}</td>
              <td>
                <b>{sm.room}</b>
              </td>
              <td>
                <b>{sm.title}</b>
                <small>{sm.speaker}</small>
              </td>
              <td className="num">
                {sm.seats_taken}/{sm.capacity}
              </td>
              <RowActions
                onDetail={() => setDetailId(sm.id)}
                onEdit={() =>
                  crud.setForm({
                    id: sm.id, slot: sm.slot, room: sm.room, title: sm.title,
                    speaker: sm.speaker, capacity: sm.capacity,
                    description: sm.description || '', cover_url: sm.cover_url || '',
                  })
                }
                onDelete={() => crud.del(sm.id, sm.title)}
              />
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {crud.form && (
        <Modal title={crud.form.id ? 'Edit Seminar' : 'Add Seminar'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Slot" type="number" min="1" value={crud.form.slot} onChange={(e) => crud.setForm({ ...crud.form, slot: e.target.value })} required />
            <Field label="Room" value={crud.form.room} onChange={(e) => crud.setForm({ ...crud.form, room: e.target.value })} required autoFocus />
            <Field label="Title" value={crud.form.title} onChange={(e) => crud.setForm({ ...crud.form, title: e.target.value })} required />
            <Field label="Speaker" value={crud.form.speaker} onChange={(e) => crud.setForm({ ...crud.form, speaker: e.target.value })} />
            <Field label="Capacity" type="number" min="1" value={crud.form.capacity} onChange={(e) => crud.setForm({ ...crud.form, capacity: e.target.value })} required />
            <Field label="Description" hint="shown on the attendee seminar detail" value={crud.form.description || ''} onChange={(e) => crud.setForm({ ...crud.form, description: e.target.value })} />
            <Field label="Cover image URL" hint="optional — gradient cover when blank" value={crud.form.cover_url || ''} onChange={(e) => crud.setForm({ ...crud.form, cover_url: e.target.value })} />
            {crud.error && <div className="error">{crud.error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={crud.busy} type="submit">
                {crud.form.id ? 'Save Changes' : 'Add'}
              </button>
              <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
