import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'

const AGENDA = [
  { time: '08:00', title: 'Registration & Tenant Expo opens', place: 'Main Lobby · Hall A' },
  { time: '10:00', title: 'Opening Ceremony', place: 'Plenary Hall' },
  { time: '13:00', title: 'Parallel Seminars', place: 'Merapi & Rinjani Rooms' },
  { time: '16:00', title: 'Speed Networking', place: 'Hall B · 40 tables × 8 people' },
  { time: '19:00', title: 'Gala Dinner & Lucky Draw', place: 'Plenary Hall' },
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
            <p>BNI Natcon 2026 · Jakarta Convention Center</p>
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
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1, opacity: 0.9 }}>BNI</div>
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
          <div className="st-label">Seminar picked</div>
        </div>
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Quick menu
      </div>
      <div className="quick-grid">
        <button className="quick" onClick={() => navigate('/qr')}>
          <span className="q-ic">
            <Icon name="qr" size={18} />
          </span>
          <h4>My QR Code</h4>
          <p>One QR for everything: booths &amp; seminars</p>
        </button>
        <button className="quick" onClick={() => navigate('/passport')}>
          <span className="q-ic">
            <Icon name="pin" size={18} />
          </span>
          <h4>Tenant Passport</h4>
          <p>Collect scans, claim your pin</p>
        </button>
        <button className="quick" onClick={() => navigate('/seminar')}>
          <span className="q-ic">
            <Icon name="mic" size={18} />
          </span>
          <h4>Parallel Seminars</h4>
          <p>Pick a session, claim a totebag</p>
        </button>
        <button className="quick" onClick={() => navigate('/network')}>
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
