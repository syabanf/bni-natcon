import { useEffect, useState } from 'react'
import { api } from '../../api/client'

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function timeAgo(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'baru saja'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} mnt lalu`
  const hours = Math.floor(mins / 60)
  return `${hours} jam lalu`
}

const POLL_MS = 5000

export default function Dashboard() {
  const [booth, setBooth] = useState(null)
  const [stats, setStats] = useState(null)
  const [visitors, setVisitors] = useState([])

  useEffect(() => {
    api.booth().then(setBooth).catch(() => {})

    const load = () => {
      api.boothStats().then(setStats).catch(() => {})
      api
        .boothVisitors(10)
        .then((data) => setVisitors(data.visitors || []))
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <div className="tenant-head">
        <div>
          <h2>Dashboard Booth</h2>
          <p>{booth ? `${booth.name} · Live` : 'Memuat…'}</p>
        </div>
        <span className="pill green">LIVE</span>
      </div>

      <div className="tenant-stats">
        <div className="stat">
          <div className="st-num" style={{ color: 'var(--red)' }}>
            {stats?.total_scans ?? '–'}
          </div>
          <div className="st-label">Total scan</div>
        </div>
        <div className="stat">
          <div className="st-num">{stats?.scans_today ?? '–'}</div>
          <div className="st-label">Scan hari ini</div>
        </div>
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Pengunjung terbaru
      </div>
      <div className="visitor-list">
        {visitors.map((v, i) => (
          <div className="visitor" key={`${v.name}-${v.visited_at}-${i}`}>
            <div className="v-av">{initials(v.name)}</div>
            <div className="v-info">
              <h5>{v.name}</h5>
              <p>{v.chapter}</p>
            </div>
            <div className="v-time">{timeAgo(v.visited_at)}</div>
          </div>
        ))}
      </div>
      {visitors.length === 0 && (
        <div className="empty-note">Belum ada pengunjung — scan QR peserta pertama di tab Scanner.</div>
      )}
      <div className="empty-note">
        Data lengkap pengunjung dapat diekspor panitia setelah acara — leads untuk follow-up tenant.
      </div>
      <div style={{ height: 16 }} />
    </>
  )
}
