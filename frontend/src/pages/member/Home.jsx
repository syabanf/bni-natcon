import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { dayLabel, groupByDay, timeOf } from '../../agenda'
import { scanCode } from '../../pass'
import { useAuthStore } from '../../store/auth'

// The agenda is the committee's rundown, read live from the API — it used to
// be a list baked into the bundle, which meant a change to the day's timing
// needed a redeploy (MoM 19 Aug 2026).

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function SponsorCell({ sp }) {
  return (
    <div className="sponsor-cell">
      {sp.logo_url ? <img src={sp.logo_url} alt={sp.name} loading="lazy" /> : <span className="sponsor-name">{sp.name}</span>}
    </div>
  )
}

// Diamond and Platinum carry the wall. Every tier below them — strategic
// partners, supporters — waits behind one "More partners" button and opens
// as a sheet, so the headline tiers keep the weight they paid for and the
// rest are still one tap away, never invisible.
function HomeSponsorWall({ headline, partners, showPartners, setShowPartners }) {
  return (
    <>
      <div className="section-title" style={{ marginLeft: 20 }}>
        Thank you to our sponsors
      </div>
      <div className="card sponsor-wall">
        {headline.map((g) => (
          <div className="sponsor-group" key={g.tier}>
            <div className={`sponsor-tier tier-${g.tier}`}>{g.label}</div>
            <div className={`sponsor-grid grid-${g.tier}`}>
              {g.sponsors.map((sp) => (
                <SponsorCell sp={sp} key={sp.id} />
              ))}
            </div>
          </div>
        ))}
        {partners.length > 0 && (
          <button type="button" className="sponsor-more" onClick={() => setShowPartners(true)}>
            More partners →
          </button>
        )}
      </div>

      {showPartners && (
        <div className="sponsor-sheet-backdrop" onClick={() => setShowPartners(false)}>
          <div className="sponsor-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sponsor-sheet-head">
              <h3>More partners</h3>
              <button type="button" className="sponsor-sheet-close" onClick={() => setShowPartners(false)}>
                Close
              </button>
            </div>
            {partners.map((g) => (
              <div className="sponsor-group" key={g.tier}>
                <div className={`sponsor-tier tier-${g.tier}`}>{g.label}</div>
                {/* The committee's composite artwork arrives as one image
                    carrying every supporter; it renders full-width, arranged
                    exactly as they laid it out. A tier listed logo-by-logo
                    still gets the grid. */}
                {g.sponsors.length === 1 && g.sponsors[0].logo_url ? (
                  <img
                    className="sponsor-sheet-full"
                    src={g.sponsors[0].logo_url}
                    alt={g.label}
                    loading="lazy"
                  />
                ) : (
                  <div className={`sponsor-grid ${g.tier === 'strategic' ? 'grid-platinum' : 'grid-supported'}`}>
                    {g.sponsors.map((sp) => (
                      <SponsorCell sp={sp} key={sp.id} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const cachedUser = useAuthStore((s) => s.user)
  const [user, setUser] = useState(cachedUser)
  const [stats, setStats] = useState(null)
  const [agenda, setAgenda] = useState(null)
  // Which redeem dialog is open: 'pin', 'goodiebag', or null.
  const [redeemInfo, setRedeemInfo] = useState(null)
  const [sponsors, setSponsors] = useState([])
  const [showPartners, setShowPartners] = useState(false)

  useEffect(() => {
    api
      .me()
      .then((data) => {
        setUser(data.user)
        setStats(data.stats)
      })
      .catch(() => {})
    // A missing agenda is not worth an error on the home screen — the card
    // says the programme is not published and everything else still works.
    api
      .rundown()
      .then((d) => setAgenda(d.rundown || []))
      .catch(() => setAgenda([]))
    // The wall is a thank-you, not a feature: if it cannot be fetched the
    // home screen simply does not show it.
    api
      .sponsors()
      .then((d) => setSponsors(d.groups || []))
      .catch(() => setSponsors([]))
  }, [])

  const firstName = user?.name?.split(' ')[0] || ''
  const days = groupByDay(agenda)

  return (
    <>
      <div className="hero-greet">
        <div className="hg-row">
          <div>
            <h2>Hello, {firstName}</h2>
            <p>BNI Natcon 2026 · Pullman Central Park Jakarta</p>
          </div>
          {/* The avatar is the door to the profile — where the pass gets
              corrected and the password changed. */}
          <Link className="avatar" to="/attendee/profile" aria-label="My profile">
            {initials(user?.name)}
          </Link>
        </div>
      </div>

      <div className="member-card">
        <div className="mc-top">
          <div>
            <div className="mc-label">Member Pass</div>
            <div className="mc-name">{user?.name}</div>
            <div className="mc-chapter">
              {user?.chapter}
              {user?.company ? ` · ${user.company}` : ''}
            </div>
          </div>
          <img className="mc-logo" src="/brand/logo-horizontal-white.png" alt="BNI Natcon 2026" />
        </div>
        <div className="mc-bottom">
          <div>
            <div className="mc-label" style={{ marginBottom: 2 }}>
              Member ID
            </div>
            <div className="mc-id">{user?.member_code}</div>
          </div>
          <div className="mc-qr">
            {scanCode(user) && <QRCodeSVG value={scanCode(user)} size={64} />}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="st-num">
            <span className="accent">{stats?.tenants_visited ?? '–'}</span>/{stats?.tenants_total ?? '–'}
          </div>
          <div className="st-label">Booths visited</div>
        </div>
        {/* Every attendee gets a free pin and goodiebag. The cards are a
            reminder, not a tracker — tapping one just says where to pick it
            up. */}
        <button type="button" className="stat stat-redeem" onClick={() => setRedeemInfo('pin')}>
          <div className="st-status free">
            <Icon name="pin" size={16} />
          </div>
          <div className="st-label">Free Pin</div>
        </button>
        <button
          type="button"
          className="stat stat-redeem"
          onClick={() => setRedeemInfo('goodiebag')}
        >
          <div className="st-status free">
            <Icon name="award" size={16} />
          </div>
          <div className="st-label">Free Goodiebag</div>
        </button>
      </div>

      {redeemInfo && (
        <div className="redeem-overlay" onClick={() => setRedeemInfo(null)}>
          <div
            className="redeem-dialog"
            role="dialog"
            aria-label={`Free ${redeemInfo === 'pin' ? 'pin' : 'goodiebag'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4>{redeemInfo === 'pin' ? 'Free pin' : 'Free goodiebag'}</h4>
            <p>
              This event comes with a free {redeemInfo === 'pin' ? 'pin' : 'goodiebag'} for
              every attendee — don&apos;t forget to redeem yours before you head home!
            </p>
            <button type="button" className="btn" onClick={() => setRedeemInfo(null)}>
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginLeft: 20 }}>
        Quick menu
      </div>
      <div className="quick-grid">
        <button className="quick" onClick={() => navigate('/attendee/qr')}>
          <span className="q-ic">
            <Icon name="qr" size={18} />
          </span>
          <h4>My QR Code</h4>
          <p>One QR for everything: booths &amp; classes</p>
        </button>
        <button className="quick" onClick={() => navigate('/attendee/passport')}>
          <span className="q-ic">
            <Icon name="pin" size={18} />
          </span>
          <h4>Tenant Passport</h4>
          <p>Visit the booths, win the grand prize</p>
        </button>
        <button className="quick" onClick={() => navigate('/attendee/seminar')}>
          <span className="q-ic">
            <Icon name="mic" size={18} />
          </span>
          <h4>Learning Session</h4>
          <p>Two sessions — pick the class you like, seats are limited</p>
        </button>
        <button className="quick" onClick={() => navigate('/attendee/network')}>
          <span className="q-ic">
            <Icon name="users" size={18} />
          </span>
          <h4>Speed Networking</h4>
          <p>Scan your table · 10 people auto-connected</p>
        </button>
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        {days.length > 1 ? 'Agenda' : "Today's agenda"}
      </div>
      <div className="card agenda-strip">
        {agenda === null && <div className="agenda-item">Loading the day…</div>}
        {agenda?.length === 0 && (
          <div className="agenda-item">The programme is not published yet.</div>
        )}
        {days.map((day) => (
          <div key={day.date}>
            {/* Named only when the programme runs past one day — otherwise
                every attendee reads a date they already know. */}
            {days.length > 1 && <div className="agenda-day">{dayLabel(day.date)}</div>}
            {day.blocks.map((a) => (
              <div
                className={`agenda-item${a.kind === 'break' ? ' agenda-item--break' : ''}`}
                key={a.id}
              >
                <div className="agenda-time">{timeOf(a.starts_at)}</div>
                <div>
                  <h5>{a.title}</h5>
                  {/* The subtitle packs several sub-items into one field,
                      separated by " · " — one line each, like the poster. */}
                  {(a.place || '')
                    .split(' · ')
                    .filter(Boolean)
                    .map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* The sponsor wall, in the order the committee ranks it: Diamond,
          Platinum, then everyone who supported the day. The grouping and the
          order both come from the API, so this renders what it is given
          rather than deciding who outranks whom. */}
      {(() => {
        // Diamond and Platinum carry the wall; every tier below them —
        // strategic partners, supporters — waits behind one modest button,
        // so the headline tiers keep the weight they paid for.
        const headline = sponsors.filter((g) => g.tier === 'diamond' || g.tier === 'platinum')
        const partners = sponsors.filter((g) => g.tier !== 'diamond' && g.tier !== 'platinum')
        return headline.length > 0 || partners.length > 0 ? (
          <HomeSponsorWall
            headline={headline}
            partners={partners}
            showPartners={showPartners}
            setShowPartners={setShowPartners}
          />
        ) : null
      })()}

      <div style={{ height: 24 }} />
    </>
  )
}
