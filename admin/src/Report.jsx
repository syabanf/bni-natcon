import { useEffect, useState } from 'react'
import { api } from './api'
import { exportSheet } from './excel'
import { BarChart, HBarChart } from './Charts'

function fmtTime(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const PREVIEW_ROWS = 10

function ReportTable({ columns, rows }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS)
  return (
    <>
      <div className="table-scroll">
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
      </div>
      {rows.length > PREVIEW_ROWS && (
        <button className="show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${rows.length})`}
        </button>
      )}
    </>
  )
}

function ReportShell({ title, sub, onExport, exportDisabled, children }) {
  return (
    <>
      <div className="content-head">
        <div>
          <h1>{title}</h1>
          <p className="micro">{sub}</p>
        </div>
        <div className="head-right">
          <button className="md-secondary" onClick={onExport} disabled={exportDisabled}>
            ⇓ Export Excel
          </button>
        </div>
      </div>
      {children}
    </>
  )
}

/* ===== 01 — Leads Tenant (kunjungan booth) ===== */

export function ReportLeads({ onUnauthorized }) {
  const [visits, setVisits] = useState([])

  useEffect(() => {
    api.visitReport({ onUnauthorized }).then((d) => setVisits(d.visits || [])).catch(() => {})
  }, [onUnauthorized])

  const perBooth = {}
  const perHour = {}
  for (const v of visits) {
    const key = `${v.booth}`
    perBooth[key] = perBooth[key] || { label: v.booth, hint: v.tenant_name, value: 0 }
    perBooth[key].value++
    const h = new Date(v.visited_at).getHours()
    perHour[h] = (perHour[h] || 0) + 1
  }
  const boothData = Object.values(perBooth).sort((a, b) => b.value - a.value)
  const hours = Object.keys(perHour).map(Number).sort((a, b) => a - b)
  const hourData =
    hours.length > 0
      ? Array.from({ length: hours[hours.length - 1] - hours[0] + 1 }, (_, i) => {
          const h = hours[0] + i
          return { label: `${String(h).padStart(2, '0')}`, hint: `Pukul ${String(h).padStart(2, '0')}.00`, value: perHour[h] || 0 }
        })
      : []

  return (
    <ReportShell
      title="Laporan — Leads Tenant"
      sub="Semua scan kunjungan booth · bahan follow-up tenant"
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
    >
      <div className="chart-grid">
        <div className="panel">
          <h2>
            <span className="sec-no">01</span>Scan per Booth
          </h2>
          <p className="panel-sub">Jumlah kunjungan tercatat per tenant</p>
          {boothData.length > 0 ? <BarChart data={boothData} valueLabel="scan" /> : <div className="empty">Belum ada data.</div>}
        </div>
        <div className="panel">
          <h2>
            <span className="sec-no">02</span>Scan per Jam
          </h2>
          <p className="panel-sub">Distribusi traffic sepanjang hari</p>
          {hourData.length > 0 ? <BarChart data={hourData} valueLabel="scan" /> : <div className="empty">Belum ada data.</div>}
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">03</span>Rincian Kunjungan
        </h2>
        <p className="panel-sub">{visits.length} baris · terbaru di atas</p>
        <ReportTable
          columns={['Peserta', 'Member Code', 'Chapter', 'Perusahaan', 'Tenant', 'Booth', 'Waktu']}
          rows={visits.map((v) => [
            v.member_name, v.member_code, v.chapter, v.company, v.tenant_name, v.booth, fmtTime(v.visited_at),
          ])}
        />
      </div>
    </ReportShell>
  )
}

/* ===== 02 — Registrasi Seminar ===== */

export function ReportSeminars({ onUnauthorized }) {
  const [registrations, setRegistrations] = useState([])
  const [seminars, setSeminars] = useState([])

  useEffect(() => {
    const opts = { onUnauthorized }
    api.registrationReport(opts).then((d) => setRegistrations(d.registrations || [])).catch(() => {})
    api.seminars(opts).then((d) => setSeminars(d.seminars || [])).catch(() => {})
  }, [onUnauthorized])

  return (
    <ReportShell
      title="Laporan — Registrasi Seminar"
      sub="Daftar hadir per ruang untuk panitia pintu"
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
    >
      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>Keterisian Kursi
        </h2>
        <p className="panel-sub">Kursi terisi vs kapasitas per seminar</p>
        <HBarChart
          data={seminars.map((s) => ({
            label: s.room,
            sub: s.title,
            value: s.seats_taken,
            total: s.capacity,
          }))}
          valueLabel="kursi"
        />
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Daftar Peserta Terdaftar
        </h2>
        <p className="panel-sub">{registrations.length} baris · urut per ruang</p>
        <ReportTable
          columns={['Peserta', 'Member Code', 'Chapter', 'Slot', 'Ruang', 'Seminar', 'Waktu Daftar']}
          rows={registrations.map((r) => [
            r.member_name, r.member_code, r.chapter, `#${r.slot}`, r.room, r.seminar_title, fmtTime(r.registered_at),
          ])}
        />
      </div>
    </ReportShell>
  )
}

/* ===== 03 — Kupon Peserta ===== */

export function ReportCoupons({ onUnauthorized }) {
  const [members, setMembers] = useState([])

  useEffect(() => {
    api.members({ onUnauthorized }).then((d) => setMembers(d.members || [])).catch(() => {})
  }, [onUnauthorized])

  // Distribution: how many members hold 0, 1, 2, … coupons.
  const dist = {}
  for (const m of members) dist[m.visits] = (dist[m.visits] || 0) + 1
  const maxCoupon = Math.max(0, ...Object.keys(dist).map(Number))
  const distData = Array.from({ length: maxCoupon + 1 }, (_, i) => ({
    label: `${i}`,
    hint: `${i} kupon`,
    value: dist[i] || 0,
  }))

  const top = [...members].sort((a, b) => b.visits - a.visits).slice(0, 10)

  return (
    <ReportShell
      title="Laporan — Kupon Peserta"
      sub="Kupon door prize per peserta untuk undian gala dinner"
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
    >
      <div className="chart-grid">
        <div className="panel">
          <h2>
            <span className="sec-no">01</span>Distribusi Kupon
          </h2>
          <p className="panel-sub">Jumlah peserta per jumlah kupon</p>
          {members.length > 0 ? <BarChart data={distData} valueLabel="peserta" /> : <div className="empty">Belum ada data.</div>}
        </div>
        <div className="panel">
          <h2>
            <span className="sec-no">02</span>Peserta Teraktif
          </h2>
          <p className="panel-sub">10 kolektor kupon terbanyak</p>
          <HBarChart
            data={top.map((m) => ({ label: m.name, sub: m.chapter, value: m.visits }))}
            valueLabel="kupon"
          />
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">03</span>Semua Peserta
        </h2>
        <p className="panel-sub">{members.length} baris</p>
        <ReportTable
          columns={['Member Code', 'Nama', 'Email', 'Chapter', 'Kupon']}
          rows={members.map((m) => [m.member_code, m.name, m.email, m.chapter, m.visits])}
        />
      </div>
    </ReportShell>
  )
}
