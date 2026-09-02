import { memo, useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { assetUrl } from '../../api/client'
import { useTenantsStore } from '../../store/tenants'

// Unvisited tenants stay on top so the user focuses on what's left;
// visited ones sink to the bottom of their group.
function sortByVisited(list) {
  return [...list].sort((a, b) => Number(a.visited) - Number(b.visited))
}

// Every background refresh hands React a brand-new tenant object per card,
// so a plain memo would never hit. Compare what the card is made of instead:
// the tenant's data, field for field — a stand whose only change is a new
// scanned flag re-renders, thirty-five untouched ones do not.
const sameCard = (prev, next) =>
  prev.sponsor === next.sponsor &&
  (prev.t === next.t || JSON.stringify(prev.t) === JSON.stringify(next.t))

const TenantCard = memo(function TenantCard({ t, sponsor }) {
  // Two companies on one stand is the exception, so everything below stays on
  // the single-company path unless the API actually sent more than one.
  const shared = (t.companies || []).length > 1
  return (
    <div className={`tenant-card${t.visited ? ' scanned' : ''}${sponsor ? ' sponsor' : ''}`}>
      {/* The ribbon names the tier, not just the fact: a Diamond stand and a
          Platinum stand bought different things, and the card should say so. */}
      {sponsor && (
        <span className={`t-ribbon${t.sponsor_tier ? ` ${t.sponsor_tier}` : ''}`}>
          {t.sponsor_tier === 'diamond'
            ? 'Diamond Sponsor'
            : t.sponsor_tier === 'platinum'
              ? 'Platinum Sponsor'
              : 'Sponsor'}
        </span>
      )}
      <div className="t-check">
        <Icon name="check" size={12} />
      </div>
      {/* A stand shared by two companies shows both marks — C1 is Royal
          Medicalink and Aroma Bathi together. It is still ONE stand: one
          stamp, one scan, one card. Everywhere else there is exactly one
          company and this renders precisely what it always did. */}
      {shared ? (
        <div className="t-logos">
          {t.companies.map((c) => (
            <div className="t-logo-slot" key={c.name}>
              {c.logo_url ? (
                <img className="t-logo img" src={assetUrl(c.logo_url)} alt={c.name} />
              ) : (
                <span className="t-logo-name">{c.name}</span>
              )}
            </div>
          ))}
        </div>
      ) : t.logo_url ? (
        <img className="t-logo img" src={assetUrl(t.logo_url)} alt={t.name} />
      ) : (
        <div className="t-logo">{t.initials}</div>
      )}
      {shared ? (
        <h5>
          {t.companies.map((c, i) => (
            <span key={c.name}>
              {i > 0 && <span className="t-amp"> &amp; </span>}
              {c.name}
            </span>
          ))}
        </h5>
      ) : (
        <h5>{t.name}</h5>
      )}
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
}, sameCard)

export default function Passport() {
  // Whatever the store already holds is on screen at once; the list is then
  // refreshed behind it — on mount, and each time the attendee comes back to
  // this tab — so a stamp collected at a booth shows up without a reload.
  const stored = useTenantsStore((s) => s.tenants)
  const refresh = useTenantsStore((s) => s.refresh)
  // The one case with nothing to show: a first load that failed. The page
  // then opens on an empty list, exactly as it did before the store.
  const [unreachable, setUnreachable] = useState(false)

  useEffect(() => {
    let alive = true
    const revalidate = () =>
      refresh().then((list) => {
        if (alive && list === null) setUnreachable(true)
      })
    revalidate()
    const onVisible = () => {
      if (document.visibilityState === 'visible') revalidate()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', revalidate)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', revalidate)
    }
  }, [refresh])

  const tenants = stored ?? (unreachable ? [] : null)
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
        <p>Visit sponsors &amp; booths and have them scan your QR — every scan is a stamp.</p>
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
          One QR scan at a tenant or sponsor booth = <b>1 stamp</b>. The more stamps you collect,
          the more business opportunities you open — and the bigger your chance at the{' '}
          <b>grand prize</b>.
        </div>
      </div>

      <div className="doorprize-banner">
        <div className="db-ic">
          <Icon name="award" size={19} />
        </div>
        <div>
          <h5>Your stamps: {visited}</h5>
          <p>Every stamp brings you closer to the grand prize</p>
        </div>
      </div>

      {sponsors.length > 0 && (
        <>
          <div className="sponsor-band">
            <span className="sb-label">Official Sponsors</span>
            <h4>They make Natcon 2026 happen</h4>
            <p>
              {sponsors.length} sponsor{sponsors.length > 1 ? 's' : ''} back this year's conference —
              stop by their stands to say thanks and collect a stamp.
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
