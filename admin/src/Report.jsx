import { useEffect, useState } from 'react'
import { api } from './api'
import { exportSheet } from './excel'

function fmtTime(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const PREVIEW_ROWS = 8

function ReportSection({ no, title, sub, columns, rows, onExport, exportDisabled }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS)

  return (
    <div className="panel report-panel">
      <div className="report-head">
        <div>
          <h2>
            <span className="sec-no">{no}</span>
            {title}
          </h2>
          <p className="panel-sub">
            {sub} · {rows.length} baris
          </p>
        </div>
        <button className="md-secondary" onClick={onExport} disabled={exportDisabled}>
          ⇓ Export Excel
        </button>
      </div>
      <table className="md-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty">
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > PREVIEW_ROWS && (
        <button className="show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${rows.length})`}
        </button>
      )}
    </div>
  )
}

export default function Report({ onUnauthorized }) {
  const [visits, setVisits] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [members, setMembers] = useState([])

  useEffect(() => {
    const opts = { onUnauthorized }
    api.visitReport(opts).then((d) => setVisits(d.visits || [])).catch(() => {})
    api.registrationReport(opts).then((d) => setRegistrations(d.registrations || [])).catch(() => {})
    api.members(opts).then((d) => setMembers(d.members || [])).catch(() => {})
  }, [onUnauthorized])

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Laporan</h1>
          <p className="micro">Preview & export Excel — leads tenant, seminar, dan peserta</p>
        </div>
      </div>

      <ReportSection
        no="01"
        title="Kunjungan Booth (Leads Tenant)"
        sub="Semua scan — bahan follow-up tenant setelah acara"
        columns={['Peserta', 'Member Code', 'Chapter', 'Perusahaan', 'Tenant', 'Booth', 'Waktu']}
        rows={visits.map((v) => [
          v.member_name, v.member_code, v.chapter, v.company, v.tenant_name, v.booth, fmtTime(v.visited_at),
        ])}
        exportDisabled={visits.length === 0}
        onExport={() =>
          exportSheet(
            visits.map((v) => ({
              Peserta: v.member_name, 'Member Code': v.member_code, Chapter: v.chapter,
              Perusahaan: v.company, Tenant: v.tenant_name, Booth: v.booth, Waktu: v.visited_at,
            })),
            'Leads', 'natcon2026-leads-tenant.xlsx'
          )
        }
      />

      <ReportSection
        no="02"
        title="Registrasi Seminar"
        sub="Daftar hadir per ruang untuk panitia pintu"
        columns={['Peserta', 'Member Code', 'Chapter', 'Slot', 'Ruang', 'Seminar', 'Waktu Daftar']}
        rows={registrations.map((r) => [
          r.member_name, r.member_code, r.chapter, `#${r.slot}`, r.room, r.seminar_title, fmtTime(r.registered_at),
        ])}
        exportDisabled={registrations.length === 0}
        onExport={() =>
          exportSheet(
            registrations.map((r) => ({
              Peserta: r.member_name, 'Member Code': r.member_code, Chapter: r.chapter,
              Slot: r.slot, Ruang: r.room, Seminar: r.seminar_title, 'Waktu Daftar': r.registered_at,
            })),
            'Registrasi', 'natcon2026-registrasi-seminar.xlsx'
          )
        }
      />

      <ReportSection
        no="03"
        title="Peserta & Kupon Door Prize"
        sub="Jumlah kupon per peserta untuk undian gala dinner"
        columns={['Member Code', 'Nama', 'Email', 'Chapter', 'Kupon']}
        rows={members.map((m) => [m.member_code, m.name, m.email, m.chapter, m.visits])}
        exportDisabled={members.length === 0}
        onExport={() =>
          exportSheet(
            members.map((m) => ({
              'Member Code': m.member_code, Nama: m.name, Email: m.email,
              Chapter: m.chapter, Perusahaan: m.company, Kupon: m.visits,
            })),
            'Peserta', 'natcon2026-peserta-kupon.xlsx'
          )
        }
      />
    </>
  )
}
