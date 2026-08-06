import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'

// Programme for 3 September 2026 at Pullman Central Park Jakarta. Doors open
// 07:30 and the ticket is valid until 18:30 (from the ticketing export).
const AGENDA = [
  { time: '07:30', title: 'Registration & door check-in', place: 'Main Lobby · claim your totebag' },
  { time: '09:00', title: 'Opening Ceremony', place: 'Grand Ballroom' },
  { time: '10:30', title: 'Sponsor & Booth Expo opens', place: 'Exhibition Foyer' },
  { time: '13:00', title: 'Breakout Classes', place: 'Breakout Rooms 1–4 · pick one' },
  { time: '15:30', title: 'Speed Networking', place: 'Grand Ballroom · 8 people per table' },
  { time: '17:00', title: 'Lucky Draw & Closing', place: 'Grand Ballroom' },
]

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

  useEffect(() => {
    api
      .me()
      .then((data) => {
        setUser(data.user)
        setStats(data.stats)
      })
      .catch(() => {})
  }, [])

  const firstName = user?.name?.split(' ')[0] || ''

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
            {user?.member_code && <QRCodeSVG value={user.member_code} size={64} />}
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
        <div className="stat">
          <div className="st-num">{stats?.coupons ?? '–'}</div>
          <div className="st-label">Pins collected</div>
        </div>
        <div className="stat">
          <div className="st-num">
            <span className="accent">{stats?.seminars_picked ?? '–'}</span>/{stats?.seminars_total ?? '–'}
          </div>
          <div className="st-label">Goodiebag</div>
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
          <p>Collect scans, claim your pin</p>
        </button>
        <button className="quick" onClick={() => navigate('/attendee/seminar')}>
          <span className="q-ic">
            <Icon name="mic" size={18} />
          </span>
          <h4>Breakout Class</h4>
          <p>Pick a class, claim your goodiebag</p>
        </button>
        <button className="quick" onClick={() => navigate('/attendee/network')}>
          <span className="q-ic">
            <Icon name="users" size={18} />
          </span>
          <h4>Speed Networking</h4>
          <p>Scan your table · 8 people auto-connected</p>
        </button>
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Today's agenda
      </div>
      <div className="card agenda-strip">
        {AGENDA.map((a) => (
          <div className="agenda-item" key={a.time}>
            <div className="agenda-time">{a.time}</div>
            <div>
              <h5>{a.title}</h5>
              <p>{a.place}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}
