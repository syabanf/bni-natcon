import { useEffect, useState } from 'react'
import { api } from './api'
import { exportSheet, exportSheets } from './excel'
import { BarChart, HBarChart } from './Charts'

function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
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
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {rows.length > PREVIEW_ROWS && (
        <button className="show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all (${rows.length})`}
        </button>
      )}
    </>
  )
}

function ReportShell({ title, sub, onExport, exportDisabled, extraExport, children }) {
  return (
    <>
      <div className="content-head">
        <div>
          <h1>{title}</h1>
          <p className="micro">{sub}</p>
        </div>
        <div className="head-right">
          {extraExport && (
            <button className="md-secondary" onClick={extraExport.onClick} disabled={exportDisabled}>
              ⇓ {extraExport.label}
            </button>
          )}
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
          return { label: `${String(h).padStart(2, '0')}`, hint: `${String(h).padStart(2, '0')}:00`, value: perHour[h] || 0 }
        })
      : []

  return (
    <ReportShell
      title="Report — Tenant Leads"
      sub="Every booth visit scan · tenant follow-up material"
      exportDisabled={visits.length === 0}
      extraExport={{
        label: 'Per tenant (no phone)',
        // The handout for the tenants themselves: one sheet per booth,
        // that booth's visitors and its own notes — and no phone numbers,
        // because the attendees consented to a scan, not to a call list.
        onClick: () => {
          const byTenant = {}
          for (const v of visits) {
            const key = `${v.booth} ${v.tenant_name}`
            byTenant[key] = byTenant[key] || []
            byTenant[key].push({
              Attendee: v.member_name, 'Member Code': v.member_code,
              Chapter: v.chapter, Company: v.company,
              Note: v.note || '', Time: v.visited_at,
            })
          }
          exportSheets(
            Object.entries(byTenant)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, rows]) => ({ name, rows })),
            'natcon2026-leads-per-tenant.xlsx'
          )
        },
      }}
      onExport={() =>
        exportSheet(
          visits.map((v) => ({
            Attendee: v.member_name, 'Member Code': v.member_code, Chapter: v.chapter,
            Company: v.company, Tenant: v.tenant_name, Booth: v.booth, Time: v.visited_at,
          })),
          'Leads', 'natcon2026-tenant-leads.xlsx'
        )
      }
    >
      <div className="chart-grid">
        <div className="panel">
          <h2>
            <span className="sec-no">01</span>Scans per Booth
          </h2>
          <p className="panel-sub">Recorded visits per tenant</p>
          {boothData.length > 0 ? <BarChart data={boothData} valueLabel="scans" /> : <div className="empty">No data yet.</div>}
        </div>
        <div className="panel">
          <h2>
            <span className="sec-no">02</span>Scans per Hour
          </h2>
          <p className="panel-sub">Traffic distribution through the day</p>
          {hourData.length > 0 ? <BarChart data={hourData} valueLabel="scans" /> : <div className="empty">No data yet.</div>}
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">03</span>Visit Details
        </h2>
        <p className="panel-sub">{visits.length} rows · newest first</p>
        <ReportTable
          columns={['Attendee', 'Member Code', 'Chapter', 'Company', 'Tenant', 'Booth', 'Time']}
          rows={visits.map((v) => [
            v.member_name, v.member_code, v.chapter, v.company, v.tenant_name, v.booth, fmtTime(v.visited_at),
          ])}
        />
      </div>
    </ReportShell>
  )
}

/* ===== 02 — Learning class registrations ===== */

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
      title="Report — Learning Class Registrations"
      sub="Attendance sheet per room for the door crew"
      exportDisabled={registrations.length === 0}
      onExport={() =>
        exportSheet(
          registrations.map((r) => ({
            Attendee: r.member_name, 'Member Code': r.member_code, Chapter: r.chapter,
            Slot: r.slot, Room: r.room, Class: r.seminar_title, Attended: r.attended ? 'Yes' : 'Not yet', 'Registered At': r.registered_at,
          })),
          'Registrations', 'natcon2026-class-registrations.xlsx'
        )
      }
    >
      <div className="panel report-panel">
        <h2>
          <span className="sec-no">01</span>Seat Fill
        </h2>
        <p className="panel-sub">Seats taken vs capacity per class</p>
        <HBarChart
          data={seminars.map((s) => ({
            label: s.room,
            sub: s.title,
            value: s.seats_taken,
            total: s.capacity,
          }))}
          valueLabel="seats"
        />
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">02</span>Registered Attendees
        </h2>
        <p className="panel-sub">{registrations.length} rows · ordered by room</p>
        <ReportTable
          columns={['Attendee', 'Member Code', 'Chapter', 'Slot', 'Room', 'Class', 'Attended', 'Registered At']}
          rows={registrations.map((r) => [
            r.member_name, r.member_code, r.chapter, `#${r.slot}`, r.room, r.seminar_title,
            r.attended ? <span key="h" className="pill-hadir yes">Yes</span> : <span key="h" className="pill-hadir">Not yet</span>,
            fmtTime(r.registered_at),
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
    api.allMembers({ onUnauthorized }).then(setMembers).catch(() => {})
  }, [onUnauthorized])

  // Distribution: how many members hold 0, 1, 2, … coupons.
  const dist = {}
  for (const m of members) dist[m.visits] = (dist[m.visits] || 0) + 1
  const maxCoupon = Math.max(0, ...Object.keys(dist).map(Number))
  const distData = Array.from({ length: maxCoupon + 1 }, (_, i) => ({
    label: `${i}`,
    hint: `${i} pins`,
    value: dist[i] || 0,
  }))

  const top = [...members].sort((a, b) => b.visits - a.visits).slice(0, 10)

  return (
    <ReportShell
      title="Report — Attendee Pins"
      sub="How many booths each attendee reached — the lucky draw is separate, and open to everyone"
      exportDisabled={members.length === 0}
      onExport={() =>
        exportSheet(
          members.map((m) => ({
            'Member Code': m.member_code, Name: m.name, Email: m.email,
            Chapter: m.chapter, Company: m.company, Pins: m.visits,
          })),
          'Attendees', 'natcon2026-attendee-pins.xlsx'
        )
      }
    >
      <div className="chart-grid">
        <div className="panel">
          <h2>
            <span className="sec-no">01</span>Pin Distribution
          </h2>
          <p className="panel-sub">Attendees per pin count</p>
          {members.length > 0 ? <BarChart data={distData} valueLabel="attendees" /> : <div className="empty">No data yet.</div>}
        </div>
        <div className="panel">
          <h2>
            <span className="sec-no">02</span>Top Collectors
          </h2>
          <p className="panel-sub">Top 10 pin collectors</p>
          <HBarChart
            data={top.map((m) => ({ label: m.name, sub: m.chapter, value: m.visits }))}
            valueLabel="pins"
          />
        </div>
      </div>

      <div className="panel report-panel">
        <h2>
          <span className="sec-no">03</span>All Attendees
        </h2>
        <p className="panel-sub">{members.length} rows</p>
        <ReportTable
          columns={['Member Code', 'Name', 'Email', 'Chapter', 'Pins']}
          rows={members.map((m) => [m.member_code, m.name, m.email, m.chapter, m.visits])}
        />
      </div>
    </ReportShell>
  )
}
