import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'

// Unvisited booths stay on top so the user focuses on what's left;
// visited ones sink to the bottom of their group.
function sortByVisited(list) {
  return [...list].sort((a, b) => Number(a.visited) - Number(b.visited))
}

function TenantGroup({ title, subtitle, list }) {
  if (list.length === 0) return null
  return (
    <>
      <div className="section-title" style={{ marginLeft: 20 }}>
        {title}{' '}
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>· {subtitle}</span>
      </div>
      <div className="tenant-grid">
        {sortByVisited(list).map((t) => (
          <div key={t.id} className={`tenant-card${t.visited ? ' scanned' : ''}`}>
            <div className="t-check">
              <Icon name="check" size={12} />
            </div>
            <div className="t-logo">{t.initials}</div>
            <h5>{t.name}</h5>
            <p>
              {t.category} · {t.kind === 'sponsor' ? 'Sponsor' : 'Booth'} {t.booth}
            </p>
            {t.description && <p className="t-desc">{t.description}</p>}
            <div className="t-status">
              {t.visited ? (
                <span className="pill green">Scanned</span>
              ) : (
                <span className="pill gray">Not visited yet</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function Passport() {
  const [tenants, setTenants] = useState(null)

  useEffect(() => {
    api
      .tenants()
      .then((data) => setTenants(data.tenants || []))
      .catch(() => setTenants([]))
  }, [])

  if (tenants === null) {
    return <div className="loading-note">Loading tenants…</div>
  }

  const sponsors = tenants.filter((t) => t.kind === 'sponsor')
  const booths = tenants.filter((t) => t.kind !== 'sponsor')
  const visited = tenants.filter((t) => t.visited).length
  const total = tenants.length
  const pct = total ? Math.round((visited / total) * 100) : 0

  return (
    <>
      <div className="hero-greet">
        <h2>Tenant Passport</h2>
        <p>Visit sponsors &amp; booths, have them scan your QR. No stamps, no paper.</p>
      </div>
      <div style={{ height: 14 }} />

      <div className="card progress-card">
        <div className="progress-head">
          <h4>Visit progress</h4>
          <span>
            {visited} of {total} tenants
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-note">
          Every tenant that scans your QR = <b>1 collectible pin</b>. Visit all {total} tenants to
          complete your set and claim the exclusive Natcon pin at the redemption desk.
        </div>
      </div>

      <div className="doorprize-banner">
        <div className="db-ic">
          <Icon name="award" size={19} />
        </div>
        <div>
          <h5>Your pins: {visited}</h5>
          <p>Claim your pins at the redemption desk · Main Lobby, from 15:00</p>
        </div>
      </div>

      <TenantGroup title="Sponsors" subtitle={`${sponsors.length} sponsors`} list={sponsors} />
      <TenantGroup title="Booths" subtitle={`${booths.length} booths`} list={booths} />
      <div style={{ height: 24 }} />
    </>
  )
}
