import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { exportSheet } from './excel'

/*
 * Who is still signing in with the password the committee handed out.
 *
 * Every account — 866 attendees, 36 booths — starts on the same password, and
 * every attendee's email address is public. So until somebody signs in and
 * picks their own, anybody holding the briefing sheet can sign in as them.
 * The dashboard shows the totals; this page is the list behind them, because
 * "842 pending" is a number you cannot act on and "these 842 people" is.
 *
 * The list is ordered pending-first for the same reason: the accounts still
 * open are the ones worth a phone call.
 */

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'pending', label: 'Still on ours' },
  { key: 'done', label: 'Chose their own' },
]

function SummaryCard({ label, total, done, accent }) {
  const known = Number.isFinite(total) && Number.isFinite(done)
  const pending = known ? total - done : 0
  const pct = known && total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="stat-card">
      <div className={`num${accent ? ' accent' : ''}`}>{known ? `${done}/${total}` : '–'}</div>
      <div className="label">{label}</div>
      <div className="bar-track" style={{ height: 6, marginTop: 8 }}>
        <div className={`bar-fill${known && pct < 50 ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="micro" style={{ marginTop: 6 }}>
        {known
          ? pending === 0
            ? 'everyone has chosen their own'
            : `${pending} still on the password we handed out`
          : 'loading…'}
      </div>
    </div>
  )
}

export default function PasswordStatus({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api
      .passwordStatus({ status, q, page, limit: 100 }, { onUnauthorized })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [status, q, page, onUnauthorized])

  useEffect(() => {
    load()
  }, [load])

  const s = data?.summary
  const rows = data?.rows || []
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Password Setup</h1>
          <p className="micro">
            Everybody starts on the same password, so an account nobody has signed into yet is one
            anybody with the briefing sheet can sign into
          </p>
        </div>
        <div className="head-right">
          <button
            className="md-secondary"
            disabled={rows.length === 0}
            onClick={() =>
              exportSheet(
                rows.map((r) => ({
                  Name: r.name,
                  Email: r.email,
                  Type: r.role === 'tenant' ? 'Booth' : 'Attendee',
                  'Chapter / Booth': r.label,
                  'Member Code': r.member_code,
                  Password: r.changed ? 'their own' : 'still ours',
                })),
                'Password setup',
                'natcon2026-password-setup.xlsx',
              )
            }
          >
            ⇓ Export Excel
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <SummaryCard
          label="Attendees who chose their own"
          total={s?.members_total}
          done={s?.members_done}
          accent
        />
        <SummaryCard
          label="Booths &amp; sponsors who chose their own"
          total={s?.tenants_total}
          done={s?.tenants_done}
        />
      </section>

      <div className="panel">
        <div className="list-toolbar">
          <div className="kind-tabs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={status === f.key ? 'active' : ''}
                onClick={() => {
                  setStatus(f.key)
                  setPage(1)
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="search-input"
            placeholder="Search name, email, chapter or booth"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Chapter / Booth</th>
                <th>Email</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.role}-${r.id}`}>
                  <td>{r.name}</td>
                  <td>
                    <span className={`pill${r.role === 'tenant' ? ' red' : ''}`}>
                      {r.role === 'tenant' ? 'Booth' : 'Attendee'}
                    </span>
                  </td>
                  <td>{r.label || <span className="muted">—</span>}</td>
                  <td className="mono">{r.email}</td>
                  <td>
                    {r.changed ? (
                      <span className="pill-hadir yes">Chose their own</span>
                    ) : (
                      <span className="pill-hadir">Still on ours</span>
                    )}
                  </td>
                </tr>
              ))}
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-note">
                    Nobody matches that.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹ Previous
            </button>
            <span>
              Page {page} of {pages} · {data.total} accounts
            </span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next ›
            </button>
          </div>
        )}
      </div>
    </>
  )
}
