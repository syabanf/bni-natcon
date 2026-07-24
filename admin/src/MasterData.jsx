import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/*
 * Master data CRUD: Peserta / Tenant / Seminar.
 * One generic section component per entity: table + inline add/edit form.
 */

const TABS = [
  { key: 'members', label: 'Peserta' },
  { key: 'tenants', label: 'Tenant' },
  { key: 'seminars', label: 'Seminar' },
]

function Field({ label, ...props }) {
  return (
    <label className="md-field">
      {label}
      <input {...props} />
    </label>
  )
}

function useCrud({ list, create, update, remove, empty }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null) // null | {..., id?} (id => editing)
  const [error, setError] = useState('')
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
      } else {
        await create(form)
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
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return { rows, form, setForm, error, busy, submit, del, empty }
}

function SectionShell({ no, title, sub, crud, addLabel, children, renderForm }) {
  return (
    <div className="panel">
      <div className="md-head">
        <div>
          <h2>
            <span className="sec-no">{no}</span>
            {title}
          </h2>
          <p className="panel-sub">{sub}</p>
        </div>
        {!crud.form && (
          <button className="md-add" onClick={() => crud.setForm({ ...crud.empty })}>
            + {addLabel}
          </button>
        )}
      </div>
      {crud.error && <div className="error">{crud.error}</div>}
      {crud.form && (
        <form className="md-form" onSubmit={crud.submit}>
          {renderForm(crud.form, (patch) => crud.setForm({ ...crud.form, ...patch }))}
          <div className="md-form-actions">
            <button className="btn" disabled={crud.busy} type="submit">
              {crud.form.id ? 'Simpan Perubahan' : 'Tambah'}
            </button>
            <button type="button" className="md-cancel" onClick={() => crud.setForm(null)}>
              Batal
            </button>
          </div>
        </form>
      )}
      {children}
    </div>
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

function MembersSection() {
  const crud = useCrud({
    list: () => api.members().then((d) => d.members || []),
    create: (f) => api.createMember(f),
    update: (id, f) => api.updateMember(id, f),
    remove: (id) => api.deleteMember(id),
    empty: { name: '', email: '', chapter: '', company: '' },
  })

  return (
    <SectionShell
      no="01"
      title="Peserta"
      sub="Member code & password default (natcon2026) dibuat otomatis"
      crud={crud}
      addLabel="Tambah Peserta"
      renderForm={(f, set) => (
        <>
          <Field label="Nama" value={f.name} onChange={(e) => set({ name: e.target.value })} required />
          <Field label="Email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} required />
          <Field label="Chapter" value={f.chapter} onChange={(e) => set({ chapter: e.target.value })} />
          <Field label="Perusahaan" value={f.company} onChange={(e) => set({ company: e.target.value })} />
        </>
      )}
    >
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
    </SectionShell>
  )
}

function TenantsSection() {
  const crud = useCrud({
    list: () => api.tenants().then((d) => d.tenants || []),
    create: (f) => api.createTenant(f),
    update: (id, f) => api.updateTenant(id, f),
    remove: (id) => api.deleteTenant(id),
    empty: { name: '', category: '', booth: '', initials: '', email: '' },
  })

  return (
    <SectionShell
      no="02"
      title="Tenant"
      sub="Akun scanner booth (booth-xxx@natcon.id / natcon2026) dibuat otomatis"
      crud={crud}
      addLabel="Tambah Tenant"
      renderForm={(f, set) => (
        <>
          <Field label="Nama" value={f.name} onChange={(e) => set({ name: e.target.value })} required />
          <Field label="Kategori" value={f.category} onChange={(e) => set({ category: e.target.value })} />
          <Field label="Booth" value={f.booth} onChange={(e) => set({ booth: e.target.value })} placeholder="A-03" required />
          <Field label="Inisial" value={f.initials} onChange={(e) => set({ initials: e.target.value })} placeholder="otomatis" />
          {!f.id && (
            <Field label="Email login (opsional)" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="otomatis dari booth" />
          )}
        </>
      )}
    >
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
    </SectionShell>
  )
}

function SeminarsSection() {
  const crud = useCrud({
    list: () => api.seminars().then((d) => d.seminars || []),
    create: (f) => api.createSeminar({ ...f, slot: +f.slot, capacity: +f.capacity }),
    update: (id, f) => api.updateSeminar(id, { ...f, slot: +f.slot, capacity: +f.capacity }),
    remove: (id) => api.deleteSeminar(id),
    empty: { slot: 1, room: '', title: '', speaker: '', capacity: 40 },
  })

  return (
    <SectionShell
      no="03"
      title="Seminar"
      sub="Sesi paralel — peserta hanya bisa memilih satu seminar per slot"
      crud={crud}
      addLabel="Tambah Seminar"
      renderForm={(f, set) => (
        <>
          <Field label="Slot" type="number" min="1" value={f.slot} onChange={(e) => set({ slot: e.target.value })} required />
          <Field label="Ruang" value={f.room} onChange={(e) => set({ room: e.target.value })} required />
          <Field label="Judul" value={f.title} onChange={(e) => set({ title: e.target.value })} required />
          <Field label="Pembicara" value={f.speaker} onChange={(e) => set({ speaker: e.target.value })} />
          <Field label="Kapasitas" type="number" min="1" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} required />
        </>
      )}
    >
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
          {crud.rows.map((s) => (
            <tr key={s.id}>
              <td className="mono">#{s.slot}</td>
              <td>
                <b>{s.room}</b>
              </td>
              <td>
                <b>{s.title}</b>
                <small>{s.speaker}</small>
              </td>
              <td className="num">
                {s.seats_taken}/{s.capacity}
              </td>
              <RowActions
                onEdit={() =>
                  crud.setForm({
                    id: s.id, slot: s.slot, room: s.room, title: s.title,
                    speaker: s.speaker, capacity: s.capacity,
                  })
                }
                onDelete={() => crud.del(s.id, s.title)}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  )
}

export default function MasterData() {
  const [tab, setTab] = useState('members')

  return (
    <div>
      <div className="md-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'members' && <MembersSection />}
      {tab === 'tenants' && <TenantsSection />}
      {tab === 'seminars' && <SeminarsSection />}
    </div>
  )
}
