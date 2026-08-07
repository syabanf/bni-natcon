import { useCallback, useEffect, useRef, useState } from 'react'
import { api, assetUrl } from './api'
import Modal from './Modal'
import {
  parseSheet,
  transformMemberRows,
  transformTenantRows,
  downloadTemplate,
  MEMBER_IMPORT_ALIASES,
  TENANT_IMPORT_ALIASES,
  MEMBER_TEMPLATE,
  TENANT_TEMPLATE,
  transformRegistrationRows,
  REGISTRATION_IMPORT_ALIASES,
  REGISTRATION_TEMPLATE,
} from './excel'
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

// Manual cover upload — the image is stored locally on the server
// (UPLOAD_DIR, served at /uploads/…) and the returned URL saved on the
// seminar. Gradient cover is used while empty.
function CoverUpload({ value, onChange, onError }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const { url } = await api.uploadImage(file)
      onChange(url)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="md-field">
      <span>
        Cover image<em> — optional, uploaded &amp; stored locally; gradient cover when blank</em>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      {value && <img className="cover-preview" src={assetUrl(value)} alt="Seminar cover preview" />}
      <div className="cover-actions">
        <button type="button" className="md-secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Uploading…' : value ? '⇪ Replace image' : '⇪ Upload image'}
        </button>
        {value && (
          <button type="button" className="md-cancel" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// Speakers and moderators as editable rows — name, optional title, and a
// photo uploaded to the API like the cover image.
function SpeakerEditor({ value, onChange, onError }) {
  const people = value || []
  const inputRef = useRef(null)
  const [uploadingAt, setUploadingAt] = useState(null)

  const patch = (i, next) => onChange(people.map((p, n) => (n === i ? { ...p, ...next } : p)))
  const add = () => onChange([...people, { name: '', role: 'speaker', title: '', photo_url: '' }])
  const remove = (i) => onChange(people.filter((_, n) => n !== i))

  const pickPhoto = (i) => {
    setUploadingAt(i)
    inputRef.current?.click()
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const i = uploadingAt
    setUploadingAt(null)
    if (!file || i === null) return
    try {
      const { url } = await api.uploadImage(file)
      patch(i, { photo_url: url })
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <div className="md-field">
      <span>
        Speakers &amp; moderator<em> — shown with their photo on the attendee class card</em>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <div className="speaker-rows">
        {people.map((p, i) => (
          <div className="speaker-row" key={i}>
            <button type="button" className="sr-photo" onClick={() => pickPhoto(i)} title="Upload photo">
              {p.photo_url ? <img src={assetUrl(p.photo_url)} alt="" /> : <span>+</span>}
            </button>
            <div className="sr-fields">
              <input
                value={p.name}
                placeholder="Name"
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <input
                value={p.title || ''}
                placeholder="Title / company (optional)"
                onChange={(e) => patch(i, { title: e.target.value })}
              />
            </div>
            <select value={p.role} onChange={(e) => patch(i, { role: e.target.value })}>
              <option value="speaker">Speaker</option>
              <option value="moderator">Moderator</option>
            </select>
            <button type="button" className="md-cancel" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="md-secondary" onClick={add}>
        + Add person
      </button>
    </div>
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

function TemplateButton({ template }) {
  return (
    <button className="md-secondary" onClick={() => downloadTemplate(template)}>
      ⇩ Download format
    </button>
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
            : `Import finished — ${importResult.created} created, ${importResult.updated || 0} updated, ${importResult.failed} failed${
                importResult.skippedDuplicates ? `, ${importResult.skippedDuplicates} in-file duplicates skipped` : ''
              }.`}
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
          aliases={MEMBER_IMPORT_ALIASES}
          upload={async (parsed) => {
            const { rows, skippedDuplicates } = transformMemberRows(parsed)
            if (rows.length === 0) return { error: 'No usable rows found in the file.' }
            const res = await api.bulkMembers(rows)
            return { ...res, skippedDuplicates }
          }}
          onDone={(res) => {
            setImportResult(res)
            crud.load()
          }}
        />
        <TemplateButton template={MEMBER_TEMPLATE} />
        <button className="md-add" onClick={() => crud.setForm({ name: '', email: '', chapter: '', company: '', phone: '', classification: '' })}>
          + Add Attendee
        </button>
      </PageHead>

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
              <td>
                {m.email}
                {m.phone && <small>{m.phone}</small>}
              </td>
              <td>
                {m.chapter}
                {m.classification && <small>{m.classification}</small>}
              </td>
              <td className="num">{m.visits}</td>
              <RowActions
                onDetail={() => setDetailId(m.id)}
                onEdit={() =>
                  crud.setForm({
                    id: m.id, name: m.name, email: m.email, chapter: m.chapter,
                    company: m.company, phone: m.phone || '', classification: m.classification || '',
                  })
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
            <Field label="Phone" hint="used by the booth scanner's manual input and the WhatsApp link at networking tables" value={crud.form.phone || ''} onChange={(e) => crud.setForm({ ...crud.form, phone: e.target.value })} />
            <Field label="Business classification" hint="shown next to this person at the networking table" value={crud.form.classification || ''} onChange={(e) => crud.setForm({ ...crud.form, classification: e.target.value })} />
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
  const [kindFilter, setKindFilter] = useState('all') // all | sponsor | booth
  const crud = useCrud({
    list: () => api.tenants().then((d) => d.tenants || []),
    create: (f) => api.createTenant(f),
    update: (id, f) => api.updateTenant(id, f),
    remove: (id) => api.deleteTenant(id),
  })
  const [importResult, setImportResult] = useState(null)
  const [detailId, setDetailId] = useState(null)

  const visibleTenants =
    kindFilter === 'all'
      ? crud.rows
      : crud.rows.filter((t) => (t.kind === 'sponsor') === (kindFilter === 'sponsor'))

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
          aliases={TENANT_IMPORT_ALIASES}
          upload={async (parsed) => {
            const { rows, skippedDuplicates } = transformTenantRows(parsed)
            if (rows.length === 0) return { error: 'No usable rows found in the file.' }
            const res = await api.bulkTenants(rows)
            return { ...res, skippedDuplicates }
          }}
          onDone={(res) => {
            setImportResult(res)
            crud.load()
          }}
        />
        <TemplateButton template={TENANT_TEMPLATE} />
        <button
          className="md-add"
          onClick={() =>
            crud.setForm({
              name: '', category: '', booth: '', initials: '', email: '',
              kind: kindFilter === 'sponsor' ? 'sponsor' : 'booth', description: '',
              contact_name: '', chapter: '',
            })
          }
        >
          + Add Tenant
        </button>
      </PageHead>

      <Notices crud={crud} importResult={importResult} clearImport={() => setImportResult(null)} />

      <div className="list-toolbar">
        <div className="kind-tabs">
          {[
            { key: 'all', label: 'All' },
            { key: 'sponsor', label: 'Sponsors' },
            { key: 'booth', label: 'Booths' },
          ].map((k) => (
            <button
              key={k.key}
              className={kindFilter === k.key ? 'active' : ''}
              onClick={() => setKindFilter(k.key)}
            >
              {k.label}
              {` (${
                k.key === 'all'
                  ? crud.rows.length
                  : crud.rows.filter((t) => (t.kind === 'sponsor') === (k.key === 'sponsor')).length
              })`}
            </button>
          ))}
        </div>
      </div>

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Booth</th>
            <th>Name</th>
            <th>Category</th>
            <th className="num">Scans</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visibleTenants.map((t) => (
            <tr key={t.id} className={t.kind === 'sponsor' ? 'sponsor-row' : ''}>
              <td>
                <span className={`kind-pill${t.kind === 'sponsor' ? ' sponsor' : ''}`}>
                  {t.kind === 'sponsor' ? 'Sponsor' : 'Booth'}
                </span>
              </td>
              <td className="mono">{t.booth}</td>
              <td>
                <b>{t.name}</b>
                <small>{t.contact_name ? `${t.contact_name}${t.chapter ? ` · ${t.chapter}` : ''}` : t.initials}</small>
              </td>
              <td>{t.category}</td>
              <td className="num">{t.scan_count}</td>
              <RowActions
                onDetail={() => setDetailId(t.id)}
                onEdit={() =>
                  crud.setForm({
                    id: t.id, name: t.name, category: t.category, booth: t.booth,
                    initials: t.initials, kind: t.kind || 'booth', description: t.description || '',
                    contact_name: t.contact_name || '', chapter: t.chapter || '',
                  })
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
            <Field
              label="Booth contact"
              hint="the BNI member manning the booth"
              value={crud.form.contact_name || ''}
              onChange={(e) => crud.setForm({ ...crud.form, contact_name: e.target.value })}
            />
            <Field
              label="BNI Chapter"
              hint="the contact's chapter"
              value={crud.form.chapter || ''}
              onChange={(e) => crud.setForm({ ...crud.form, chapter: e.target.value })}
            />
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
  const [importResult, setImportResult] = useState(null)
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
      <PageHead title="Master Data — Breakout Classes" sub="Classes sharing a slot run in parallel — an attendee picks one of them">
        <ImportButton
          label="Import Registrations"
          aliases={REGISTRATION_IMPORT_ALIASES}
          upload={async (parsed) => {
            const { rows, skippedDuplicates } = transformRegistrationRows(parsed)
            if (rows.length === 0) return { error: 'No rows with both an attendee and a room.' }
            const res = await api.bulkRegistrations(rows)
            crud.load()
            return { ...res, skippedDuplicates }
          }}
          onDone={setImportResult}
        />
        <TemplateButton template={REGISTRATION_TEMPLATE} />
        <button
          className="md-add"
          onClick={() => crud.setForm({ slot: 1, room: '', title: '', speaker: '', moderator: '', capacity: 60, description: '', cover_url: '', speakers: [] })}
        >
          + Add Class
        </button>
      </PageHead>

      <Notices crud={crud} importResult={importResult} clearImport={() => setImportResult(null)} />

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
                <small>
                  {sm.speaker}
                  {sm.moderator ? ` · mod. ${sm.moderator}` : ''}
                </small>
              </td>
              <td className="num">
                {sm.seats_taken}/{sm.capacity}
              </td>
              <RowActions
                onDetail={() => setDetailId(sm.id)}
                onEdit={() =>
                  crud.setForm({
                    id: sm.id, slot: sm.slot, room: sm.room, title: sm.title,
                    speaker: sm.speaker, moderator: sm.moderator || '', capacity: sm.capacity,
                    speakers: sm.speakers || [],
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
        <Modal title={crud.form.id ? 'Edit Breakout Class' : 'Add Breakout Class'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Slot" type="number" min="1" value={crud.form.slot} onChange={(e) => crud.setForm({ ...crud.form, slot: e.target.value })} required />
            <Field label="Room" value={crud.form.room} onChange={(e) => crud.setForm({ ...crud.form, room: e.target.value })} required autoFocus />
            <Field label="Title" value={crud.form.title} onChange={(e) => crud.setForm({ ...crud.form, title: e.target.value })} required />
            <Field label="Speaker(s)" hint="separate multiple speakers with a semicolon" value={crud.form.speaker} onChange={(e) => crud.setForm({ ...crud.form, speaker: e.target.value })} />
            <Field label="Moderator" value={crud.form.moderator || ''} onChange={(e) => crud.setForm({ ...crud.form, moderator: e.target.value })} />
            <Field label="Capacity" type="number" min="1" value={crud.form.capacity} onChange={(e) => crud.setForm({ ...crud.form, capacity: e.target.value })} required />
            <Field label="Description" hint="shown on the attendee class detail" value={crud.form.description || ''} onChange={(e) => crud.setForm({ ...crud.form, description: e.target.value })} />
            <SpeakerEditor
              value={crud.form.speakers}
              onChange={(speakers) => crud.setForm({ ...crud.form, speakers })}
              onError={(msg) => crud.setError(msg)}
            />
            <CoverUpload
              value={crud.form.cover_url || ''}
              onChange={(url) => crud.setForm({ ...crud.form, cover_url: url })}
              onError={(msg) => crud.setError(msg)}
            />
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
