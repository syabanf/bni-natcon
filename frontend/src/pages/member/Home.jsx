import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function Home() {
  const navigate = useNavigate()
  const cachedUser = useAuthStore((s) => s.user)
  const [user, setUser] = useState(cachedUser)
  const [stats, setStats] = useState(null)
  const [agenda, setAgenda] = useState(null)
  const [sponsors, setSponsors] = useState([])

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
          <div className="avatar">{initials(user?.name)}</div>
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
        {/* The pin and the goodiebag are not something to win or redeem —
            every attendee gets both. These two say so and remind people to
            pick them up; there is nothing to tap and nothing to claim. */}
        <div className="stat">
          <div className="st-num">
            <span className="accent">Free</span>
          </div>
          <div className="st-label">Pin — pick yours up at the desk</div>
        </div>
        <div className="stat">
          <div className="st-num">
            <span className="accent">Free</span>
          </div>
          <div className="st-label">Goodiebag — pick yours up at the desk</div>
        </div>
      </div>

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
              <div className="agenda-item" key={a.id}>
                <div className="agenda-time">{timeOf(a.starts_at)}</div>
                <div>
                  <h5>{a.title}</h5>
                  <p>{a.place}</p>
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
      {sponsors.length > 0 && (
        <>
          <div className="section-title" style={{ marginLeft: 20 }}>
            Thank you to our sponsors
          </div>
          <div className="card sponsor-wall">
            {sponsors.map((g) => (
              <div className="sponsor-group" key={g.tier}>
                <div className={`sponsor-tier tier-${g.tier}`}>{g.label}</div>
                <div className={`sponsor-grid grid-${g.tier}`}>
                  {g.sponsors.map((sp) => (
                    <div className="sponsor-cell" key={sp.id}>
                      {sp.logo_url ? (
                        <img src={sp.logo_url} alt={sp.name} loading="lazy" />
                      ) : (
                        <span className="sponsor-name">{sp.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 24 }} />
    </>
  )
}
