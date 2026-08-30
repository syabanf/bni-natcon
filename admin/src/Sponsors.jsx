import { useEffect, useState } from 'react'
import { api } from './api'
import { exportSheet } from './excel'

/*
 * The sponsor wall, as the committee ranked it.
 *
 * Separate from Tenants on purpose, and worth saying why on the page itself:
 * 25 of these have no stand, no scanner and nothing to stamp. They are a
 * credits wall, not part of the passport. Two of them exhibit as well and
 * appear in both places.
 *
 * Read-only for now — the tiers come from the artwork packs the committee
 * sent, and nothing in the app should quietly promote a sponsor.
 */

const TIER_NOTE = {
  diamond: 'Top of the wall, one logo per row on a phone',
  platinum: 'Two to a row',
  supported: 'Three to a row',
}

export default function Sponsors({ onUnauthorized }) {
  const [groups, setGroups] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .sponsors({ onUnauthorized })
      .then((d) => setGroups(d.groups || []))
      .catch((e) => setError(e.message))
  }, [onUnauthorized])

  const all = (groups || []).flatMap((g) => g.sponsors.map((s) => ({ ...s, tier: g.label })))

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Sponsors</h1>
          <p className="micro">
            The wall on the attendee home screen, in the order it is shown · sponsors are not
            exhibitors: most have no stand, and they are not part of the passport
          </p>
        </div>
        <div className="head-right">
          <button
            className="md-secondary"
            disabled={all.length === 0}
            onClick={() =>
              exportSheet(
                all.map((s) => ({ Tier: s.tier, Sponsor: s.name, Logo: s.logo_url })),
                'Sponsors',
                'natcon2026-sponsors.xlsx',
              )
            }
          >
            ⇓ Export Excel
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {groups === null && !error && <div className="empty-note">Loading…</div>}

      {(groups || []).map((g) => (
        <div className="panel" key={g.tier}>
          <h2>
            <span className="sec-no">{g.tier === 'diamond' ? '01' : g.tier === 'platinum' ? '02' : '03'}</span>
            {g.label}
          </h2>
          <p className="panel-sub">
            {g.sponsors.length} {g.sponsors.length === 1 ? 'company' : 'companies'} ·{' '}
            {TIER_NOTE[g.tier]}
          </p>
          <div className="table-scroll">
            <table className="md-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Logo</th>
                  <th>Sponsor</th>
                  <th>Tier</th>
                </tr>
              </thead>
              <tbody>
                {g.sponsors.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt={s.name}
                          style={{ height: 34, maxWidth: 130, objectFit: 'contain' }}
                        />
                      ) : (
                        <span className="muted">— no artwork</span>
                      )}
                    </td>
                    <td>{s.name}</td>
                    <td>
                      <span className={`pill${g.tier === 'diamond' ? ' red' : ''}`}>{g.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}
