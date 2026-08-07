import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'

// Unvisited tenants stay on top so the user focuses on what's left;
// visited ones sink to the bottom of their group.
function sortByVisited(list) {
  return [...list].sort((a, b) => Number(a.visited) - Number(b.visited))
}

function TenantCard({ t, sponsor }) {
  return (
    <div className={`tenant-card${t.visited ? ' scanned' : ''}${sponsor ? ' sponsor' : ''}`}>
      {sponsor && <span className="t-ribbon">Sponsor</span>}
      <div className="t-check">
        <Icon name="check" size={12} />
      </div>
      <div className="t-logo">{t.initials}</div>
      <h5>{t.name}</h5>
      <p>
        {sponsor ? t.category : `${t.category} · Booth ${t.booth}`}
      </p>
      {t.contact_name && (
        <p className="t-contact">
          {t.contact_name}
          {t.chapter ? ` · ${t.chapter}` : ''}
        </p>
      )}
      {t.description && <p className="t-desc">{t.description}</p>}
      <div className="t-status">
        {t.visited ? (
          <span className="pill green">Scanned</span>
        ) : (
          <span className="pill gray">Not visited yet</span>
        )}
      </div>
    </div>
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
  const sponsorsVisited = sponsors.filter((t) => t.visited).length
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

      {sponsors.length > 0 && (
        <>
          <div className="sponsor-band">
            <span className="sb-label">Official Sponsors</span>
            <h4>They make Natcon 2026 happen</h4>
            <p>
              {sponsors.length} sponsor{sponsors.length > 1 ? 's' : ''} back this year's conference —
              stop by their stands to say thanks and collect a pin.
            </p>
            <span className="sb-progress">
              {sponsorsVisited}/{sponsors.length} sponsor stands visited
            </span>
          </div>
          <div className="tenant-grid">
            {sortByVisited(sponsors).map((t) => (
              <TenantCard key={t.id} t={t} sponsor />
            ))}
          </div>
        </>
      )}

      <div className="section-title" style={{ marginLeft: 20 }}>
        Booths{' '}
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>
          · {booths.length} booths
        </span>
      </div>
      <div className="tenant-grid">
        {sortByVisited(booths).map((t) => (
          <TenantCard key={t.id} t={t} />
        ))}
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}
