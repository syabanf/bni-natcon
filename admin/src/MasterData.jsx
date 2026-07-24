import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import Modal from './Modal'
import { parseSheet } from './excel'

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

  const load = useCallback(() => {
    list()
      .then(setRows)
      .catch((e) => setError(e.message))
  }, [list])

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
        setNotice('Perubahan tersimpan.')
      } else {
        await create(form)
        setNotice('Data berhasil ditambahkan.')
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
    if (!window.confirm(`Hapus ${label}? Data terkait (scan/registrasi) ikut terhapus.`)) return
    setError('')
    try {
      await remove(id)
      setNotice(`${label} dihapus.`)
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
        onDone({ error: 'File kosong atau header tidak dikenali.' })
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
        {busy ? 'Mengimpor…' : `⇪ ${label}`}
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
            ? `Import gagal: ${importResult.error}`
            : `Import selesai — ${importResult.created} dibuat, ${importResult.failed} gagal.`}
          {importResult.errors?.length > 0 && (
            <ul>
              {importResult.errors.slice(0, 5).map((e) => (
                <li key={e.row}>
                  Baris {e.row} ({e.label}): {e.error}
                </li>
              ))}
              {importResult.errors.length > 5 && <li>… {importResult.errors.length - 5} lainnya</li>}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function RowActions({ onEdit, onDelete }) {
  return (
    <td className="md-actions">
      <button onClick={onEdit}>Ubah</button>
      <button className="danger" onClick={onDelete}>
        Hapus
      </button>
    </td>
  )
}

/* ================= Peserta ================= */

export function MembersPage() {
  const crud = useCrud({
    list: () => api.members().then((d) => d.members || []),
    create: (f) => api.createMember(f),
    update: (id, f) => api.updateMember(id, f),
    remove: (id) => api.deleteMember(id),
  })
  const [importResult, setImportResult] = useState(null)

  return (
    <>
      <PageHead title="Master Data — Peserta" sub="Member code & password default dibuat otomatis">
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
          + Tambah Peserta
        </button>
      </PageHead>
      <p className="import-hint">
        Format Excel: kolom <b>Nama</b>, <b>Email</b>, <b>Chapter</b>, <b>Perusahaan</b> (baris pertama = header).
      </p>

      <Notices crud={crud} importResult={importResult} clearImport={() => setImportResult(null)} />

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Member Code</th>
            <th>Nama</th>
            <th>Email</th>
            <th>Chapter</th>
            <th className="num">Kupon</th>
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

      {crud.form && (
        <Modal title={crud.form.id ? 'Ubah Peserta' : 'Tambah Peserta'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Nama" value={crud.form.name} onChange={(e) => crud.setForm({ ...crud.form, name: e.target.value })} required autoFocus />
            <Field label="Email" type="email" value={crud.form.email} onChange={(e) => crud.setForm({ ...crud.form, email: e.target.value })} required />
            <Field label="Chapter" value={crud.form.chapter} onChange={(e) => crud.setForm({ ...crud.form, chapter: e.target.value })} />
            <Field label="Perusahaan" value={crud.form.company} onChange={(e) => crud.setForm({ ...crud.form, company: e.target.value })} />
            {crud.error && <div className="error">{crud.error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={crud.busy} type="submit">
                {crud.form.id ? 'Simpan Perubahan' : 'Tambah'}
              </button>
              <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
                Batal
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

  return (
    <>
      <PageHead title="Master Data — Tenant" sub="Akun scanner booth dibuat otomatis (booth-xxx@natcon.id)">
        <ImportButton
          label="Import Excel"
          aliases={{
            name: ['nama', 'name'],
            category: ['kategori', 'category'],
            booth: ['booth'],
            initials: ['inisial', 'initials'],
            email: ['email', 'e-mail'],
          }}
          upload={(rows) => api.bulkTenants(rows)}
          onDone={(res) => {
            setImportResult(res)
            crud.load()
          }}
        />
        <button
          className="md-add"
          onClick={() => crud.setForm({ name: '', category: '', booth: '', initials: '', email: '' })}
        >
          + Tambah Tenant
        </button>
      </PageHead>
      <p className="import-hint">
        Format Excel: kolom <b>Nama</b>, <b>Kategori</b>, <b>Booth</b>, <b>Inisial</b> (opsional), <b>Email</b> (opsional).
      </p>

      <Notices crud={crud} importResult={importResult} clearImport={() => setImportResult(null)} />

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Booth</th>
            <th>Nama</th>
            <th>Kategori</th>
            <th className="num">Scan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {crud.rows.map((t) => (
            <tr key={t.id}>
              <td className="mono">{t.booth}</td>
              <td>
                <b>{t.name}</b>
                <small>{t.initials}</small>
              </td>
              <td>{t.category}</td>
              <td className="num">{t.scan_count}</td>
              <RowActions
                onEdit={() =>
                  crud.setForm({ id: t.id, name: t.name, category: t.category, booth: t.booth, initials: t.initials })
                }
                onDelete={() => crud.del(t.id, t.name)}
              />
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {crud.form && (
        <Modal title={crud.form.id ? 'Ubah Tenant' : 'Tambah Tenant'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Nama" value={crud.form.name} onChange={(e) => crud.setForm({ ...crud.form, name: e.target.value })} required autoFocus />
            <Field label="Kategori" value={crud.form.category} onChange={(e) => crud.setForm({ ...crud.form, category: e.target.value })} />
            <Field label="Booth" value={crud.form.booth} onChange={(e) => crud.setForm({ ...crud.form, booth: e.target.value })} placeholder="A-03" required />
            <Field label="Inisial" hint="kosongkan untuk otomatis" value={crud.form.initials} onChange={(e) => crud.setForm({ ...crud.form, initials: e.target.value })} />
            {!crud.form.id && (
              <Field label="Email login" hint="kosongkan untuk otomatis" value={crud.form.email} onChange={(e) => crud.setForm({ ...crud.form, email: e.target.value })} />
            )}
            {crud.error && <div className="error">{crud.error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={crud.busy} type="submit">
                {crud.form.id ? 'Simpan Perubahan' : 'Tambah'}
              </button>
              <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
                Batal
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

  return (
    <>
      <PageHead title="Master Data — Seminar" sub="Peserta hanya bisa memilih satu seminar per slot">
        <button
          className="md-add"
          onClick={() => crud.setForm({ slot: 1, room: '', title: '', speaker: '', capacity: 40 })}
        >
          + Tambah Seminar
        </button>
      </PageHead>

      <Notices crud={crud} importResult={null} clearImport={() => {}} />

      <div className="table-scroll">
      <table className="md-table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Ruang</th>
            <th>Judul</th>
            <th className="num">Terisi</th>
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
                onEdit={() =>
                  crud.setForm({
                    id: sm.id, slot: sm.slot, room: sm.room, title: sm.title,
                    speaker: sm.speaker, capacity: sm.capacity,
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
        <Modal title={crud.form.id ? 'Ubah Seminar' : 'Tambah Seminar'} onClose={() => crud.setForm(null)}>
          <form className="modal-form" onSubmit={crud.submit}>
            <Field label="Slot" type="number" min="1" value={crud.form.slot} onChange={(e) => crud.setForm({ ...crud.form, slot: e.target.value })} required />
            <Field label="Ruang" value={crud.form.room} onChange={(e) => crud.setForm({ ...crud.form, room: e.target.value })} required autoFocus />
            <Field label="Judul" value={crud.form.title} onChange={(e) => crud.setForm({ ...crud.form, title: e.target.value })} required />
            <Field label="Pembicara" value={crud.form.speaker} onChange={(e) => crud.setForm({ ...crud.form, speaker: e.target.value })} />
            <Field label="Kapasitas" type="number" min="1" value={crud.form.capacity} onChange={(e) => crud.setForm({ ...crud.form, capacity: e.target.value })} required />
            {crud.error && <div className="error">{crud.error}</div>}
            <div className="modal-actions">
              <button className="btn" disabled={crud.busy} type="submit">
                {crud.form.id ? 'Simpan Perubahan' : 'Tambah'}
              </button>
              <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
                Batal
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
